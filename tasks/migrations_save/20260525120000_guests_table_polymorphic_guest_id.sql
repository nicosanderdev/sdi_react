-- Guests table, polymorphic GuestId on Bookings/Reviews, RPC updates.
-- Prerequisite: 20260524120000, 20260524130000 (already applied).
-- No data backfill. Deletes guest-submitted reviews (UserId IS NULL) before Reviews reshape.
-- NOTE: Manual execution by project owner (idempotent).

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Guests table
-- ---------------------------------------------------------------------------
create table if not exists public."Guests" (
  "Id" uuid not null default gen_random_uuid(),
  "FirstName" text not null,
  "LastName" text not null,
  "Email" text not null,
  "PhoneNumber" text not null,
  "Created" timestamp with time zone not null default now(),
  "LastModified" timestamp with time zone not null default now(),
  constraint "PK_Guests" primary key ("Id"),
  constraint "CHK_Guests_FirstName" check (length(trim("FirstName")) > 0),
  constraint "CHK_Guests_LastName" check (length(trim("LastName")) > 0),
  constraint "CHK_Guests_Email" check (length(trim("Email")) > 0),
  constraint "CHK_Guests_PhoneNumber" check (length(trim("PhoneNumber")) > 0)
);

create unique index if not exists "UX_Guests_Email_Normalized"
  on public."Guests" (lower(trim("Email")));

comment on table public."Guests" is
  'Non-member guests for client-side bookings. Unique by normalized email; upsert updates name and phone.';

alter table public."Guests" enable row level security;

-- ---------------------------------------------------------------------------
-- 2) upsert_guest_by_email
-- ---------------------------------------------------------------------------
create or replace function public.upsert_guest_by_email(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := trim(coalesce(p_first_name, ''));
  v_last text := trim(coalesce(p_last_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone_number, ''));
  v_id uuid;
begin
  if v_first = '' then
    raise exception 'First name is required';
  end if;

  if v_last = '' then
    raise exception 'Last name is required';
  end if;

  if v_email = '' then
    raise exception 'Email is required';
  end if;

  if v_phone = '' then
    raise exception 'Phone number is required';
  end if;

  insert into public."Guests" (
    "FirstName",
    "LastName",
    "Email",
    "PhoneNumber",
    "Created",
    "LastModified"
  ) values (
    v_first,
    v_last,
    v_email,
    v_phone,
    now(),
    now()
  )
  on conflict ((lower(trim("Email"))))
  do update set
    "FirstName" = excluded."FirstName",
    "LastName" = excluded."LastName",
    "PhoneNumber" = excluded."PhoneNumber",
    "LastModified" = now()
  returning "Id" into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) resolve_guest_profile
-- ---------------------------------------------------------------------------
create or replace function public.resolve_guest_profile(p_guest_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member record;
  v_guest record;
begin
  if p_guest_id is null then
    return null;
  end if;

  select
    m."FirstName" as first_name,
    m."LastName" as last_name,
    m."Email" as email,
    m."Phone" as phone
  into v_member
  from public."Members" m
  where m."Id" = p_guest_id
    and m."IsDeleted" = false
  limit 1;

  if found then
    return jsonb_build_object(
      'kind', 'member',
      'firstName', v_member.first_name,
      'lastName', v_member.last_name,
      'email', v_member.email,
      'phone', v_member.phone
    );
  end if;

  select
    g."FirstName" as first_name,
    g."LastName" as last_name,
    g."Email" as email,
    g."PhoneNumber" as phone
  into v_guest
  from public."Guests" g
  where g."Id" = p_guest_id
  limit 1;

  if found then
    return jsonb_build_object(
      'kind', 'guest',
      'firstName', v_guest.first_name,
      'lastName', v_guest.last_name,
      'email', v_guest.email,
      'phone', v_guest.phone
    );
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) validate_polymorphic_guest_id — triggers (CHECK cannot use subqueries)
-- ---------------------------------------------------------------------------
create or replace function public.validate_polymorphic_guest_id(
  p_guest_id uuid,
  p_allow_null boolean default false
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_guest_id is null then
    if p_allow_null then
      return;
    end if;
    raise exception 'GuestId is required';
  end if;

  if exists (
    select 1
    from public."Members" m
    where m."Id" = p_guest_id
      and m."IsDeleted" = false
  ) then
    return;
  end if;

  if exists (
    select 1
    from public."Guests" g
    where g."Id" = p_guest_id
  ) then
    return;
  end if;

  raise exception 'GuestId must reference an active Member or a Guest';
end;
$$;

create or replace function public.trg_bookings_validate_guest_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validate_polymorphic_guest_id(new."GuestId", true);
  return new;
end;
$$;

drop trigger if exists "TRG_Bookings_Validate_GuestId" on public."Bookings";

create trigger "TRG_Bookings_Validate_GuestId"
  before insert or update of "GuestId"
  on public."Bookings"
  for each row
  execute function public.trg_bookings_validate_guest_id();

-- ---------------------------------------------------------------------------
-- 5) Bookings — polymorphic GuestId (drop Members-only FK)
-- ---------------------------------------------------------------------------
alter table public."Bookings"
  drop constraint if exists "FK_Bookings_Members_GuestId";

alter table public."Bookings"
  drop constraint if exists "CHK_Bookings_GuestId_Valid";

-- ---------------------------------------------------------------------------
-- 6) Reviews — UserId → GuestId; drop guest columns (no backfill)
-- ---------------------------------------------------------------------------
do $$
declare
  v_reviews_oid oid := to_regclass('public."Reviews"');
begin
  if v_reviews_oid is null then
    raise exception 'Table public."Reviews" not found';
  end if;

  -- Guest-submitted rows from 241300 (UserId null); idempotent on re-run
  if exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = v_reviews_oid
      and a.attname = 'UserId'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    delete from public."Reviews" where "UserId" is null;
  elsif exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = v_reviews_oid
      and a.attname = 'GuestId'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    delete from public."Reviews" where "GuestId" is null;
  end if;
end $$;

alter table public."Reviews"
  drop constraint if exists "FK_Reviews_Members_UserId";

alter table public."Reviews"
  drop constraint if exists "CHK_Reviews_MemberOrGuest";

do $$
declare
  v_reviews_oid oid := to_regclass('public."Reviews"');
begin
  if exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = v_reviews_oid
      and a.attname = 'UserId'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    alter table public."Reviews"
      rename column "UserId" to "GuestId";
  end if;
end $$;

alter table public."Reviews"
  drop column if exists "GuestName",
  drop column if exists "GuestEmail";

do $$
declare
  v_reviews_oid oid := to_regclass('public."Reviews"');
begin
  if exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = v_reviews_oid
      and a.attname = 'GuestId'
      and a.attnum > 0
      and not a.attisdropped
      and not a.attnotnull
  ) then
    alter table public."Reviews"
      alter column "GuestId" set not null;
  end if;
end $$;

alter table public."Reviews"
  drop constraint if exists "CHK_Reviews_GuestId_Valid";

create or replace function public.trg_reviews_validate_guest_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validate_polymorphic_guest_id(new."GuestId", false);
  return new;
end;
$$;

drop trigger if exists "TRG_Reviews_Validate_GuestId" on public."Reviews";

create trigger "TRG_Reviews_Validate_GuestId"
  before insert or update of "GuestId"
  on public."Reviews"
  for each row
  execute function public.trg_reviews_validate_guest_id();

drop index if exists public."IX_Reviews_UserId";

create index if not exists "IX_Reviews_GuestId"
  on public."Reviews" using btree ("GuestId");

comment on table public."Reviews" is
  'One review per booking. GuestId references Members.Id (member) or Guests.Id (client guest).';

-- ---------------------------------------------------------------------------
-- 7) confirm_booking_from_hold — upsert guest, set GuestId
-- ---------------------------------------------------------------------------
create or replace function public.confirm_booking_from_hold(
  p_hold_id uuid,
  p_guest_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.booking_holds%rowtype;
  v_booking_id uuid;
  v_guest_id uuid;
  v_manage_token jsonb;
  v_reservation_code text;
  v_estimated_guests integer;
  v_attempt integer := 0;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_full_name text;
begin
  select * into v_hold
  from public.booking_holds
  where id = p_hold_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Hold not found');
  end if;

  if v_hold.status <> 'pending' or v_hold.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'Hold expired');
  end if;

  if v_hold.otp_verified_at is null then
    return jsonb_build_object('success', false, 'error', 'OTP verification required');
  end if;

  v_first_name := trim(coalesce(p_guest_payload->>'firstName', ''));
  v_last_name := trim(coalesce(p_guest_payload->>'lastName', ''));
  v_email := trim(coalesce(p_guest_payload->>'email', ''));
  v_phone := trim(coalesce(p_guest_payload->>'phone', ''));

  if v_first_name = '' or v_last_name = '' then
    v_full_name := trim(coalesce(p_guest_payload->>'fullName', ''));
    if v_full_name <> '' then
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name := nullif(trim(substring(v_full_name from position(' ' in v_full_name) + 1)), '');
      if v_last_name is null then
        v_last_name := '-';
      end if;
    end if;
  end if;

  if v_first_name = '' or v_last_name = '' or v_email = '' or v_phone = '' then
    return jsonb_build_object(
      'success', false,
      'error', 'Guest first name, last name, email, and phone are required'
    );
  end if;

  begin
    v_guest_id := public.upsert_guest_by_email(
      v_first_name,
      v_last_name,
      v_email,
      v_phone
    );
  exception
    when others then
      return jsonb_build_object('success', false, 'error', sqlerrm);
  end;

  v_estimated_guests := coalesce(
    (p_guest_payload->>'estimatedGuests')::integer,
    v_hold.estimated_guests
  );

  loop
    v_attempt := v_attempt + 1;
    v_reservation_code := 'RSV-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

    exit when not exists (
      select 1
      from public."Bookings" b
      where b."ReservationCode" = v_reservation_code
        and b."IsDeleted" = false
    );

    if v_attempt >= 20 then
      return jsonb_build_object('success', false, 'error', 'Could not allocate reservation code');
    end if;
  end loop;

  insert into public."Bookings" (
    "EstatePropertyId",
    "GuestId",
    "CheckInDate",
    "CheckOutDate",
    "GuestCount",
    "TotalAmount",
    "Status",
    "Created",
    "LastModified",
    "IsDeleted",
    "Notes",
    "ReservationCode"
  ) values (
    v_hold.property_id,
    v_guest_id,
    v_hold.check_in,
    v_hold.check_out,
    v_hold.guests,
    coalesce((p_guest_payload->>'totalPrice')::numeric, 0),
    0,
    now(),
    now(),
    false,
    concat(
      'Guest booking ',
      v_reservation_code,
      case
        when v_estimated_guests is not null
        then concat(' | Estimated guests: ', v_estimated_guests)
        else ''
      end
    ),
    v_reservation_code
  )
  returning "Id" into v_booking_id;

  update public.booking_holds
  set
    status = 'confirmed',
    full_name = coalesce(
      nullif(trim(p_guest_payload->>'fullName'), ''),
      trim(v_first_name || ' ' || v_last_name)
    ),
    email = v_email,
    phone = v_phone,
    document_id = p_guest_payload->>'documentId',
    estimated_guests = v_estimated_guests,
    updated_at = now()
  where id = p_hold_id;

  v_manage_token := public.issue_booking_manage_token(v_booking_id);

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'guest_id', v_guest_id,
    'reservation_code', v_reservation_code,
    'manage_token', v_manage_token->>'token',
    'manage_expires_at', v_manage_token->>'expires_at'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) get_reservation_by_code — profile from GuestId + holds fallback
-- ---------------------------------------------------------------------------
create or replace function public.get_reservation_by_code(reservation_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_booking record;
  v_status text;
  v_is_expired boolean := false;
  v_has_existing_review boolean := false;
  v_can_submit_guest_review boolean := false;
  v_profile jsonb;
  v_guest_name text;
  v_guest_email text;
  v_guest_phone text;
begin
  v_code := upper(trim(coalesce(reservation_code, '')));

  if v_code = '' or v_code !~ '^RSV-[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  end if;

  select
    b."Id" as booking_id,
    b."GuestId" as guest_id,
    b."ReservationCode" as reservation_code,
    b."EstatePropertyId" as property_id,
    l."Title" as property_title,
    b."CheckInDate" as check_in,
    b."CheckOutDate" as check_out,
    b."Status" as status_code,
    b."IsDeleted" as is_deleted,
    h.full_name as hold_full_name,
    h.email as hold_email,
    h.phone as hold_phone
  into v_booking
  from public."Bookings" b
  left join lateral (
    select l2."Title"
    from public."Listings" l2
    where l2."EstatePropertyId" = b."EstatePropertyId"
      and l2."IsDeleted" = false
    order by l2."IsActive" desc nulls last, l2."Created" desc nulls last
    limit 1
  ) l on true
  left join lateral (
    select
      bh.full_name,
      bh.email,
      bh.phone
    from public.booking_holds bh
    where bh.property_id = b."EstatePropertyId"
      and bh.check_in = b."CheckInDate"
      and bh.check_out = b."CheckOutDate"
      and bh.status = 'confirmed'
    order by bh.updated_at desc nulls last
    limit 1
  ) h on true
  where b."ReservationCode" = v_code
    and b."IsDeleted" = false
  order by b."Created" desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  v_profile := public.resolve_guest_profile(v_booking.guest_id);

  if v_profile is not null then
    v_guest_name := nullif(
      trim(coalesce(v_profile->>'firstName', '') || ' ' || coalesce(v_profile->>'lastName', '')),
      ''
    );
    v_guest_email := v_profile->>'email';
    v_guest_phone := v_profile->>'phone';
  else
    v_guest_name := v_booking.hold_full_name;
    v_guest_email := v_booking.hold_email;
    v_guest_phone := v_booking.hold_phone;
  end if;

  v_status := case v_booking.status_code
    when 0 then 'pending'
    when 1 then 'confirmed'
    when 2 then 'cancelled'
    when 3 then 'completed'
    else 'unknown'
  end;

  if v_booking.check_out < current_date then
    v_is_expired := true;
  end if;

  if v_is_expired and v_status not in ('cancelled', 'completed') then
    return jsonb_build_object('success', false, 'error', 'Reservation expired');
  end if;

  select exists (
    select 1
    from public."Reviews" r
    where r."BookingId" = v_booking.booking_id
  )
  into v_has_existing_review;

  v_can_submit_guest_review :=
    not coalesce(v_booking.is_deleted, false)
    and v_booking.status_code in (1, 3)
    and v_booking.check_out::date <= current_date
    and not v_has_existing_review
    and v_booking.guest_id is not null;

  return jsonb_build_object(
    'success', true,
    'reservation', jsonb_build_object(
      'bookingId', v_booking.booking_id,
      'guestId', v_booking.guest_id,
      'reservationCode', v_booking.reservation_code,
      'propertyId', v_booking.property_id,
      'propertyTitle', coalesce(v_booking.property_title, 'Property'),
      'checkIn', v_booking.check_in,
      'checkOut', v_booking.check_out,
      'status', v_status,
      'guestName', v_guest_name,
      'guestEmail', v_guest_email,
      'guestPhone', v_guest_phone,
      'canCancel', (v_booking.status_code in (0, 1) and v_booking.check_in >= current_date),
      'isExpired', v_is_expired,
      'isDeleted', coalesce(v_booking.is_deleted, false),
      'hasExistingReview', v_has_existing_review,
      'canSubmitGuestReview', v_can_submit_guest_review
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) create_guest_review_by_reservation_code — GuestId only (no guest name param)
-- ---------------------------------------------------------------------------
drop function if exists public.create_guest_review_by_reservation_code(
  text, text, text, integer, text
);

create or replace function public.create_guest_review_by_reservation_code(
  p_reservation_code text,
  p_guest_email text,
  p_rating integer,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_booking record;
  v_guest_email text;
  v_profile_email text;
  v_review_id uuid;
begin
  v_code := upper(trim(coalesce(p_reservation_code, '')));

  if v_code = '' or v_code !~ '^RSV-[A-Z0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  end if;

  if coalesce(trim(p_comment), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Comment is required');
  end if;

  if coalesce(trim(p_guest_email), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Guest email does not match');
  end if;

  select
    b."Id" as booking_id,
    b."GuestId" as guest_id,
    b."EstatePropertyId" as estate_property_id,
    b."Status" as status_code,
    b."CheckOutDate" as check_out,
    b."IsDeleted" as is_deleted
  into v_booking
  from public."Bookings" b
  where b."ReservationCode" = v_code
    and b."IsDeleted" = false
  order by b."Created" desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if coalesce(v_booking.is_deleted, false) then
    return jsonb_build_object('success', false, 'error', 'Reservation not found');
  end if;

  if v_booking.guest_id is null then
    return jsonb_build_object('success', false, 'error', 'Booking not eligible for review');
  end if;

  if v_booking.status_code not in (1, 3) then
    return jsonb_build_object('success', false, 'error', 'Booking not eligible for review');
  end if;

  if v_booking.check_out::date > current_date then
    return jsonb_build_object('success', false, 'error', 'Checkout has not passed');
  end if;

  v_guest_email := lower(trim(p_guest_email));
  v_profile_email := lower(trim(coalesce(public.resolve_guest_profile(v_booking.guest_id)->>'email', '')));

  if v_guest_email = '' or v_profile_email = '' or v_guest_email <> v_profile_email then
    return jsonb_build_object('success', false, 'error', 'Guest email does not match');
  end if;

  if exists (
    select 1
    from public."Reviews" r
    where r."BookingId" = v_booking.booking_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Review already exists');
  end if;

  begin
    insert into public."Reviews" (
      "BookingId",
      "GuestId",
      "EstatePropertyId",
      "Rating",
      "Comment"
    ) values (
      v_booking.booking_id,
      v_booking.guest_id,
      v_booking.estate_property_id,
      p_rating,
      trim(p_comment)
    )
    returning "Id" into v_review_id;
  exception
    when unique_violation then
      return jsonb_build_object('success', false, 'error', 'Review already exists');
  end;

  return jsonb_build_object(
    'success', true,
    'reviewId', v_review_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) Admin guest list RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_guests_list(integer, integer, text);

create or replace function public.get_admin_guests_list(
  p_page integer default 1,
  p_limit integer default 20,
  p_search text default null
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone_number text,
  created timestamptz,
  bookings_count bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_offset int;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_lim int := greatest(least(coalesce(p_limit, 20), 200), 1);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  v_offset := (v_page - 1) * v_lim;

  return query
  with base as (
    select
      g."Id" as gid,
      g."FirstName" as fn,
      g."LastName" as ln,
      g."Email" as em,
      g."PhoneNumber" as ph,
      g."Created" as cr,
      (
        select count(*)::bigint
        from public."Bookings" b
        where b."GuestId" = g."Id"
          and b."IsDeleted" = false
      ) as bc
    from public."Guests" g
    where (
      v_search is null
      or g."Email" ilike '%' || v_search || '%'
      or g."FirstName" ilike '%' || v_search || '%'
      or g."LastName" ilike '%' || v_search || '%'
      or g."PhoneNumber" ilike '%' || v_search || '%'
      or (g."FirstName" || ' ' || g."LastName") ilike '%' || v_search || '%'
    )
  ),
  counted as (
    select count(*)::bigint as tc from base
  )
  select
    b.gid,
    b.fn,
    b.ln,
    b.em,
    b.ph,
    b.cr,
    b.bc,
    c.tc
  from base b
  cross join counted c
  order by b.cr desc
  offset v_offset
  limit v_lim;
end;
$$;

drop function if exists public.get_admin_guest_detail(uuid);

create or replace function public.get_admin_guest_detail(p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := false;
  v_row record;
  v_bookings_count bigint;
begin
  select exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  select
    g."Id",
    g."FirstName",
    g."LastName",
    g."Email",
    g."PhoneNumber",
    g."Created",
    g."LastModified"
  into v_row
  from public."Guests" g
  where g."Id" = p_guest_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Guest not found');
  end if;

  select count(*)::bigint
  into v_bookings_count
  from public."Bookings" b
  where b."GuestId" = p_guest_id
    and b."IsDeleted" = false;

  return jsonb_build_object(
    'success', true,
    'guest', jsonb_build_object(
      'id', v_row."Id",
      'firstName', v_row."FirstName",
      'lastName', v_row."LastName",
      'email', v_row."Email",
      'phoneNumber', v_row."PhoneNumber",
      'created', v_row."Created",
      'lastModified', v_row."LastModified",
      'bookingsCount', v_bookings_count
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 11) Grants
-- ---------------------------------------------------------------------------
grant execute on function public.upsert_guest_by_email(text, text, text, text)
  to service_role;

grant execute on function public.resolve_guest_profile(uuid)
  to anon, authenticated, service_role;

grant execute on function public.confirm_booking_from_hold(uuid, jsonb)
  to anon, authenticated, service_role;

grant execute on function public.get_reservation_by_code(text)
  to anon, authenticated, service_role;

grant execute on function public.create_guest_review_by_reservation_code(
  text, text, integer, text
) to anon, authenticated, service_role;

grant execute on function public.get_admin_guests_list(integer, integer, text)
  to authenticated, service_role;

grant execute on function public.get_admin_guest_detail(uuid)
  to authenticated, service_role;

commit;
