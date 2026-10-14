-- Login / settings 2FA via WhatsApp OTP (purpose = login_2fa).
-- Reuses otp_requests hashing; does not change member phone or email.

-- ---------------------------------------------------------------------------
-- Members.twofactorenabled already exists (lowercase). Ensure default.
-- ---------------------------------------------------------------------------
alter table public."Members"
  alter column twofactorenabled set default false;

update public."Members"
set twofactorenabled = false
where twofactorenabled is null;

alter table public."Members"
  alter column twofactorenabled set not null;

-- Keep sync helper aligned with the real column name.
create or replace function public.sync_mfa_status_for_user(p_user_id uuid) returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  has_factor boolean;
begin
  select exists (
    select 1
    from auth.mfa_factors f
    where f.user_id = p_user_id
      and f.status = 'verified'
  ) into has_factor;

  update public."Members"
  set twofactorenabled = coalesce(has_factor, false),
      "LastModified" = now(),
      "LastModifiedBy" = 'sync_mfa_status_for_user'
  where "UserId" = p_user_id
    and "IsDeleted" = false;
end;
$$;

-- ---------------------------------------------------------------------------
-- otp_requests: allow login_2fa
-- ---------------------------------------------------------------------------
alter table public.otp_requests
  drop constraint if exists otp_requests_purpose_check;

alter table public.otp_requests
  add constraint otp_requests_purpose_check
  check (purpose = any (array[
    'booking'::text,
    'member_phone'::text,
    'member_email'::text,
    'login_2fa'::text
  ]));

alter table public.otp_requests
  drop constraint if exists otp_requests_shape_check;

alter table public.otp_requests
  add constraint otp_requests_shape_check
  check (
    (purpose = 'booking' and phone is not null)
    or (purpose = 'member_phone' and user_id is not null and phone is not null
        and phone_prefix is not null and phone_local is not null)
    or (purpose = 'member_email' and user_id is not null and email is not null)
    or (purpose = 'login_2fa' and user_id is not null and phone is not null)
  );

-- ---------------------------------------------------------------------------
-- Verify login_2fa OTP by request id (no phone/email mutation)
-- ---------------------------------------------------------------------------
create or replace function public.verify_login_2fa_otp(
  p_otp_request_id uuid,
  p_otp_code text
) returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'extensions'
as $fn$
declare
  v_request public.otp_requests%rowtype;
  v_salt text;
  v_hash text;
  v_computed_hash text;
begin
  if p_otp_request_id is null or nullif(trim(p_otp_code), '') is null then
    return jsonb_build_object('success', false, 'error', 'challenge and code are required');
  end if;

  select *
  into v_request
  from public.otp_requests
  where id = p_otp_request_id
    and purpose = 'login_2fa'
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

  v_computed_hash := encode(digest(v_salt || ':' || trim(p_otp_code), 'sha256'), 'hex');

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

  return jsonb_build_object(
    'success', true,
    'otp_request_id', v_request.id,
    'user_id', v_request.user_id
  );
end;
$fn$;

revoke all on function public.verify_login_2fa_otp(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_login_2fa_otp(uuid, text) to service_role;
