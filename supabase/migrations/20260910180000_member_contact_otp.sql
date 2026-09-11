-- Member email/phone verification via otp_requests (hashed), WhatsApp/Resend delivery.
-- Guest booking OTP stays on the same table with purpose = 'booking'.

-- ---------------------------------------------------------------------------
-- otp_requests: purpose + member fields
-- ---------------------------------------------------------------------------
alter table public.otp_requests
  add column if not exists purpose text not null default 'booking',
  add column if not exists user_id uuid,
  add column if not exists email text,
  add column if not exists phone_prefix text,
  add column if not exists phone_local text;

update public.otp_requests
set purpose = 'booking'
where purpose is null or purpose = '';

alter table public.otp_requests
  alter column phone drop not null;

alter table public.otp_requests
  drop constraint if exists otp_requests_purpose_check;

alter table public.otp_requests
  add constraint otp_requests_purpose_check
  check (purpose = any (array['booking'::text, 'member_phone'::text, 'member_email'::text]));

alter table public.otp_requests
  drop constraint if exists otp_requests_shape_check;

alter table public.otp_requests
  add constraint otp_requests_shape_check
  check (
    (purpose = 'booking' and phone is not null)
    or (purpose = 'member_phone' and user_id is not null and phone is not null
        and phone_prefix is not null and phone_local is not null)
    or (purpose = 'member_email' and user_id is not null and email is not null)
  );

create index if not exists idx_otp_requests_member_purpose
  on public.otp_requests (user_id, purpose, created_at desc)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: edge functions use the service role. Drop world-readable policies.
-- ---------------------------------------------------------------------------
drop policy if exists otp_requests_anon_insert on public.otp_requests;
drop policy if exists otp_requests_anon_select on public.otp_requests;
drop policy if exists otp_requests_user_insert on public.otp_requests;
drop policy if exists otp_requests_user_select on public.otp_requests;

revoke all on table public.otp_requests from anon, authenticated;
grant all on table public.otp_requests to service_role;

-- ---------------------------------------------------------------------------
-- Guest verify: only booking-purpose rows
-- ---------------------------------------------------------------------------
create or replace function public.verify_booking_otp(
  p_phone text,
  p_otp_code text,
  p_hold_id uuid default null
) returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
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
    and purpose = 'booking'
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
$fn$;

-- ---------------------------------------------------------------------------
-- Member verify: hashed OTP, then stamp Members contact fields
-- ---------------------------------------------------------------------------
create or replace function public.verify_member_otp(
  p_user_id uuid,
  p_otp_code text,
  p_purpose text
) returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_request public.otp_requests%rowtype;
  v_salt text;
  v_hash text;
  v_computed_hash text;
  v_previous_email text;
begin
  if p_purpose is distinct from 'member_phone' and p_purpose is distinct from 'member_email' then
    return jsonb_build_object('success', false, 'error', 'invalid_purpose');
  end if;

  if p_user_id is null or nullif(trim(p_otp_code), '') is null then
    return jsonb_build_object('success', false, 'error', 'user_id and code are required');
  end if;

  select *
  into v_request
  from public.otp_requests
  where user_id = p_user_id
    and purpose = p_purpose
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

  select m."Email"
  into v_previous_email
  from public."Members" m
  where m."UserId" = p_user_id
    and m."IsDeleted" = false;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Member not found');
  end if;

  begin
    if p_purpose = 'member_phone' then
      update public."Members" m
      set
        "Phone" = v_request.phone_local,
        "PhonePrefix" = v_request.phone_prefix,
        "PhoneVerifiedAt" = timezone('utc', now()),
        "LastModified" = timezone('utc', now())
      where m."UserId" = p_user_id
        and m."IsDeleted" = false;
    else
      if exists (
        select 1
        from public."Members" other
        where other."IsDeleted" = false
          and other."UserId" is distinct from p_user_id
          and lower(coalesce(other."Email", '')) = lower(v_request.email)
      ) then
        return jsonb_build_object('success', false, 'error', 'Email already in use');
      end if;

      update public."Members" m
      set
        "Email" = v_request.email,
        "EmailVerifiedAt" = timezone('utc', now()),
        "LastModified" = timezone('utc', now())
      where m."UserId" = p_user_id
        and m."IsDeleted" = false;
    end if;
  exception
    when unique_violation then
      if p_purpose = 'member_phone' then
        return jsonb_build_object('success', false, 'error', 'Phone number already in use');
      end if;
      return jsonb_build_object('success', false, 'error', 'Email already in use');
  end;

  update public.otp_requests
  set
    verified = true,
    verified_at = now(),
    updated_at = now()
  where id = v_request.id;

  return jsonb_build_object(
    'success', true,
    'otp_request_id', v_request.id,
    'purpose', p_purpose,
    'email', v_request.email,
    'previous_email', v_previous_email,
    'phone', v_request.phone_local,
    'phone_prefix', v_request.phone_prefix
  );
end;
$fn$;

revoke all on function public.verify_member_otp(uuid, text, text) from public, anon, authenticated;
grant execute on function public.verify_member_otp(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- handle_new_user: PhonePrefix from metadata; OAuth email counts as verified
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_member_id uuid;
  v_plan_id uuid;
  v_phone text;
  v_phone_prefix text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_space_pos int;
  v_provider text;
  v_is_oauth boolean;
  v_email_verified_at timestamptz;
  v_now timestamptz := timezone('utc', now());
begin
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_phone_prefix := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phonePrefix', '')), '');

  v_first_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'firstName', '')), '');
  v_last_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'lastName', '')), '');

  if v_first_name is null and v_last_name is null then
    v_full_name := nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    );

    if v_full_name is not null then
      v_space_pos := position(' ' in v_full_name);
      if v_space_pos > 0 then
        v_first_name := nullif(trim(substring(v_full_name from 1 for v_space_pos - 1)), '');
        v_last_name := nullif(trim(substring(v_full_name from v_space_pos + 1)), '');
      else
        v_first_name := v_full_name;
        v_last_name := null;
      end if;
    end if;
  end if;

  v_provider := lower(coalesce(new.raw_app_meta_data ->> 'provider', ''));
  v_is_oauth := v_provider not in ('', 'email');
  if not v_is_oauth
     and jsonb_typeof(new.raw_app_meta_data -> 'providers') = 'array' then
    v_is_oauth := exists (
      select 1
      from jsonb_array_elements_text(new.raw_app_meta_data -> 'providers') as p(value)
      where p.value is distinct from 'email'
    );
  end if;
  if v_is_oauth and new.email is not null then
    v_email_verified_at := v_now;
  else
    v_email_verified_at := null;
  end if;

  insert into public."Members" (
    "Id",
    "UserId",
    "Email",
    "FirstName",
    "LastName",
    "Phone",
    "PhonePrefix",
    "EmailVerifiedAt",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  values (
    gen_random_uuid(),
    new.id,
    new.email,
    v_first_name,
    v_last_name,
    v_phone,
    v_phone_prefix,
    v_email_verified_at,
    'user',
    false,
    v_now,
    v_now
  )
  on conflict ("UserId") do update
  set
    "Email" = excluded."Email",
    "FirstName" = coalesce(excluded."FirstName", public."Members"."FirstName"),
    "LastName" = coalesce(excluded."LastName", public."Members"."LastName"),
    "Phone" = coalesce(excluded."Phone", public."Members"."Phone"),
    "PhonePrefix" = coalesce(excluded."PhonePrefix", public."Members"."PhonePrefix"),
    "EmailVerifiedAt" = coalesce(public."Members"."EmailVerifiedAt", excluded."EmailVerifiedAt"),
    "LastModified" = v_now
  returning "Id" into v_member_id;

  select p."Id"
  into v_plan_id
  from public."Plans" p
  where p."Name" = 'Plan BASE-Inicial'
    and p."IsDeleted" = false
    and coalesce(p."IsActiveV2", p."IsActive", true) = true
  order by p."Key"
  limit 1;

  if v_plan_id is null then
    raise exception 'Default signup plan "Plan BASE-Inicial" not found or inactive';
  end if;

  if not exists (
    select 1
    from public."BillingPlanAssignments" bpa
    where bpa."SubjectType" = 'member'
      and bpa."MemberOrCompanyId" = v_member_id
      and bpa."IsActive" = true
  ) then
    insert into public."BillingPlanAssignments" (
      "SubjectType",
      "MemberOrCompanyId",
      "PlanId",
      "StartDate",
      "IsActive",
      "Created",
      "LastModified"
    ) values (
      'member',
      v_member_id,
      v_plan_id,
      v_now,
      true,
      v_now,
      v_now
    );
  end if;

  return new;
end;
$$;

-- Existing OAuth members with a confirmed Auth email: stamp EmailVerifiedAt only.
update public."Members" m
set
  "EmailVerifiedAt" = timezone('utc', now()),
  "LastModified" = timezone('utc', now())
from auth.users u
where m."UserId" = u.id
  and m."IsDeleted" = false
  and m."EmailVerifiedAt" is null
  and u.email is not null
  and u.email_confirmed_at is not null
  and exists (
    select 1
    from auth.identities i
    where i.user_id = u.id
      and i.provider is distinct from 'email'
  );
