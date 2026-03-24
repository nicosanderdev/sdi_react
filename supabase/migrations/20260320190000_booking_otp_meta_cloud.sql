create extension if not exists pgcrypto;

create table if not exists public.otp_requests (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid null references public.booking_holds (id) on delete set null,
  phone text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 3 and 5),
  verified boolean not null default false,
  request_ip text null,
  provider text not null default 'meta',
  whatsapp_message_id text null,
  whatsapp_status text not null default 'pending',
  sms_status text not null default 'not_sent',
  fallback_required_at timestamptz null,
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_otp_requests_phone_created_at
  on public.otp_requests (phone, created_at desc);

create index if not exists idx_otp_requests_phone_expires_at
  on public.otp_requests (phone, expires_at desc);

create index if not exists idx_otp_requests_hold_id
  on public.otp_requests (hold_id)
  where hold_id is not null;

create index if not exists idx_otp_requests_pending_fallback
  on public.otp_requests (fallback_required_at)
  where verified = false and sms_status = 'not_sent' and fallback_required_at is not null;

create table if not exists public.otp_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('phone', 'ip')),
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, key, window_start)
);

create index if not exists idx_otp_rate_limits_lookup
  on public.otp_rate_limits (scope, key, window_start desc);

create or replace function public.check_and_increment_otp_rate_limit(
  p_phone text,
  p_ip text default null,
  p_phone_max_hits integer default 3,
  p_ip_max_hits integer default 20,
  p_window_minutes integer default 10
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('minute', v_now) - ((extract(minute from v_now)::integer % p_window_minutes) * interval '1 minute');
  v_phone_hits integer;
  v_ip_hits integer;
begin
  insert into public.otp_rate_limits (scope, key, window_start, hits)
  values ('phone', p_phone, v_window_start, 1)
  on conflict (scope, key, window_start)
  do update set
    hits = public.otp_rate_limits.hits + 1,
    updated_at = now()
  returning hits into v_phone_hits;

  if v_phone_hits > p_phone_max_hits then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'phone_rate_limited',
      'phone_hits', v_phone_hits
    );
  end if;

  if p_ip is not null and length(trim(p_ip)) > 0 then
    insert into public.otp_rate_limits (scope, key, window_start, hits)
    values ('ip', p_ip, v_window_start, 1)
    on conflict (scope, key, window_start)
    do update set
      hits = public.otp_rate_limits.hits + 1,
      updated_at = now()
    returning hits into v_ip_hits;

    if v_ip_hits > p_ip_max_hits then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'ip_rate_limited',
        'ip_hits', v_ip_hits
      );
    end if;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'phone_hits', v_phone_hits,
    'ip_hits', coalesce(v_ip_hits, 0)
  );
end;
$$;

create or replace function public.verify_booking_otp(
  p_phone text,
  p_otp_code text,
  p_hold_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_request public.otp_requests%rowtype;
  v_salt text;
  v_hash text;
  v_computed_hash text;
begin
  select *
  into v_request
  from public.otp_requests
  where phone = p_phone
    and (p_hold_id is null or hold_id = p_hold_id)
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'OTP request not found');
  end if;

  if v_request.verified then
    return jsonb_build_object('success', false, 'error', 'OTP already used');
  end if;

  if v_request.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'OTP expired');
  end if;

  if v_request.attempts >= v_request.max_attempts then
    return jsonb_build_object('success', false, 'error', 'Max attempts exceeded');
  end if;

  v_salt := split_part(v_request.otp_hash, '$', 1);
  v_hash := split_part(v_request.otp_hash, '$', 2);

  if v_salt is null or v_salt = '' or v_hash is null or v_hash = '' then
    return jsonb_build_object('success', false, 'error', 'Stored OTP hash is invalid');
  end if;

  v_computed_hash := encode(digest(v_salt || ':' || p_otp_code, 'sha256'), 'hex');

  if v_computed_hash <> v_hash then
    update public.otp_requests
    set
      attempts = attempts + 1,
      updated_at = now()
    where id = v_request.id;

    return jsonb_build_object(
      'success', false,
      'error', 'Invalid OTP code',
      'attempts_left', greatest((v_request.max_attempts - (v_request.attempts + 1)), 0)
    );
  end if;

  update public.otp_requests
  set
    verified = true,
    verified_at = now(),
    updated_at = now()
  where id = v_request.id;

  if p_hold_id is not null then
    update public.booking_holds
    set
      phone = p_phone,
      otp_verified_at = now(),
      updated_at = now()
    where id = p_hold_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'otp_request_id', v_request.id
  );
end;
$$;
