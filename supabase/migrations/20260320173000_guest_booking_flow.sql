-- Guest booking flow backend contracts (manual apply by developer)
-- This migration defines new tables and RPCs required by the frontend flow.

create extension if not exists pgcrypto;

create table if not exists public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  check_in date not null,
  check_out date not null,
  guests integer not null check (guests > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'released')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  full_name text null,
  email text null,
  phone text null,
  document_id text null,
  otp_verified_at timestamptz null,
  ip_hash text null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_holds_property_dates
  on public.booking_holds (property_id, check_in, check_out);

create index if not exists idx_booking_holds_expires_at
  on public.booking_holds (expires_at);

create table if not exists public.booking_manage_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  last_used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_manage_tokens_booking_id
  on public.booking_manage_tokens (booking_id);

create table if not exists public.booking_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key text not null,
  hits integer not null default 1,
  window_start timestamptz not null default now(),
  window_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_booking_rate_limits_scope_key_window
  on public.booking_rate_limits (scope, key, window_start);

create or replace function public.validate_booking_selection(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_nights integer;
  v_rules record;
  v_errors text[] := array[]::text[];
begin
  if p_property_id is null or p_check_in is null or p_check_out is null then
    return jsonb_build_object(
      'is_valid', false,
      'errors', jsonb_build_array('Missing required fields')
    );
  end if;

  if p_check_out <= p_check_in then
    v_errors := array_append(v_errors, 'Check-out date must be after check-in date');
  end if;

  if p_guests is null or p_guests < 1 then
    v_errors := array_append(v_errors, 'Guests must be at least 1');
  end if;

  select
    sx."MinStayDays" as min_stay_days,
    sx."MaxStayDays" as max_stay_days,
    sx."LeadTimeDays" as lead_time_days,
    sx."BufferDays" as buffer_days,
    coalesce(l."RentPrice", 0) as rent_price,
    coalesce(l."Capacity", ep."Capacity", 0) as max_guests
  into v_rules
  from public."EstateProperties" ep
  join public."Listings" l on l."EstatePropertyId" = ep."Id"
  left join public."SummerRentExtension" sx on sx."EstatePropertyId" = ep."Id"
  where ep."Id" = p_property_id
    and ep."IsDeleted" = false
    and l."IsDeleted" = false
    and l."IsActive" = true
  limit 1;

  if not found then
    v_errors := array_append(v_errors, 'Property not found or inactive');
  end if;

  v_nights := greatest((p_check_out - p_check_in), 0);

  if v_rules.min_stay_days is not null and v_nights < v_rules.min_stay_days then
    v_errors := array_append(v_errors, 'Minimum stay rule not met');
  end if;

  if v_rules.max_stay_days is not null and v_nights > v_rules.max_stay_days then
    v_errors := array_append(v_errors, 'Maximum stay rule exceeded');
  end if;

  if v_rules.lead_time_days is not null and p_check_in < (current_date + v_rules.lead_time_days) then
    v_errors := array_append(v_errors, 'Lead time rule not met');
  end if;

  if v_rules.max_guests > 0 and p_guests > v_rules.max_guests then
    v_errors := array_append(v_errors, 'Guest count exceeds property capacity');
  end if;

  return jsonb_build_object(
    'is_valid', array_length(v_errors, 1) is null,
    'errors', to_jsonb(coalesce(v_errors, array[]::text[])),
    'pricing', jsonb_build_object(
      'nightly_price', coalesce(v_rules.rent_price, 0),
      'nights', v_nights,
      'total_price', coalesce(v_rules.rent_price, 0) * v_nights
    ),
    'normalized_rules', jsonb_build_object(
      'min_stay_days', v_rules.min_stay_days,
      'max_stay_days', v_rules.max_stay_days,
      'lead_time_days', v_rules.lead_time_days,
      'buffer_days', v_rules.buffer_days,
      'max_guests', v_rules.max_guests
    )
  );
end;
$$;

create or replace function public.create_booking_hold(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_ip_hash text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_validation jsonb;
  v_hold_id uuid;
begin
  v_validation := public.validate_booking_selection(p_property_id, p_check_in, p_check_out, p_guests);
  if not coalesce((v_validation->>'is_valid')::boolean, false) then
    return jsonb_build_object('success', false, 'error', 'Validation failed', 'validation', v_validation);
  end if;

  if exists (
    select 1
    from public.booking_holds h
    where h.property_id = p_property_id
      and h.status = 'pending'
      and h.expires_at > now()
      and daterange(h.check_in, h.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected dates are temporarily held by another guest');
  end if;

  insert into public.booking_holds (
    property_id, check_in, check_out, guests, ip_hash, idempotency_key
  ) values (
    p_property_id, p_check_in, p_check_out, p_guests, p_ip_hash, p_idempotency_key
  )
  returning id into v_hold_id;

  return jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold_id,
      'expires_at', (select expires_at from public.booking_holds where id = v_hold_id)
    ),
    'validation', v_validation
  );
end;
$$;

create or replace function public.reconfirm_booking_hold(
  p_hold_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_hold public.booking_holds%rowtype;
begin
  select * into v_hold from public.booking_holds where id = p_hold_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Hold not found');
  end if;

  if v_hold.status <> 'pending' or v_hold.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'Hold expired');
  end if;

  return jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold.id,
      'property_id', v_hold.property_id,
      'check_in', v_hold.check_in,
      'check_out', v_hold.check_out,
      'guests', v_hold.guests,
      'expires_at', v_hold.expires_at
    )
  );
end;
$$;

create or replace function public.issue_booking_manage_token(
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_raw_token text;
  v_token_hash text;
begin
  v_raw_token := encode(gen_random_bytes(24), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  insert into public.booking_manage_tokens (booking_id, token_hash, expires_at)
  values (p_booking_id, v_token_hash, now() + interval '30 days');

  return jsonb_build_object(
    'success', true,
    'token', v_raw_token,
    'expires_at', now() + interval '30 days'
  );
end;
$$;

create or replace function public.get_booking_by_manage_token(
  p_token text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_token_hash text;
begin
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  update public.booking_manage_tokens
  set last_used_at = now()
  where token_hash = v_token_hash
    and revoked_at is null
    and expires_at > now();

  return jsonb_build_object(
    'success', true,
    'token_hash', v_token_hash,
    'note', 'Manual wiring required: join token to Bookings and project response schema'
  );
end;
$$;

create or replace function public.cancel_booking_by_manage_token(
  p_token text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_token_hash text;
begin
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object(
    'success', false,
    'token_hash', v_token_hash,
    'note', 'Manual wiring required: map token to Bookings row and update cancellation status'
  );
end;
$$;

create or replace function public.confirm_booking_from_hold(
  p_hold_id uuid,
  p_guest_payload jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_hold public.booking_holds%rowtype;
  v_booking_id uuid;
  v_manage_token jsonb;
  v_reservation_code text;
begin
  select * into v_hold from public.booking_holds where id = p_hold_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Hold not found');
  end if;

  if v_hold.status <> 'pending' or v_hold.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'Hold expired');
  end if;

  if v_hold.otp_verified_at is null then
    return jsonb_build_object('success', false, 'error', 'OTP verification required');
  end if;

  v_reservation_code := 'RSV-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  -- IMPORTANT: field names in public."Bookings" may differ by environment.
  -- Keep this insert as a contract template for manual adaptation.
  insert into public."Bookings" (
    "EstatePropertyId", "GuestId", "CheckInDate", "CheckOutDate", "GuestCount", "TotalAmount",
    "Status", "Created", "LastModified", "IsDeleted", "Notes"
  ) values (
    v_hold.property_id, null, v_hold.check_in, v_hold.check_out, v_hold.guests,
    coalesce((p_guest_payload->>'totalPrice')::numeric, 0), 0, now(), now(), false,
    concat('Guest booking ', v_reservation_code)
  )
  returning "Id" into v_booking_id;

  update public.booking_holds
  set
    status = 'confirmed',
    full_name = p_guest_payload->>'fullName',
    email = p_guest_payload->>'email',
    phone = p_guest_payload->>'phone',
    document_id = p_guest_payload->>'documentId',
    updated_at = now()
  where id = p_hold_id;

  v_manage_token := public.issue_booking_manage_token(v_booking_id);

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'reservation_code', v_reservation_code,
    'manage_token', v_manage_token->>'token',
    'manage_expires_at', v_manage_token->>'expires_at'
  );
end;
$$;

