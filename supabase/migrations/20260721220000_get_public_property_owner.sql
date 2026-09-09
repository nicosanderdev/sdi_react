-- Two guest-facing owner/host endpoints:
-- 1) get_public_property_owner — public listing detail (no contact)
-- 2) get_booking_property_owner — booked guest via manage token or reservation code (contact when confirmed/completed)
-- Also lock resolve_host_contact_for_property so anon cannot fetch email/phone by property id alone.

-- Shared builder: public profile fields; optionally include email/phone.
CREATE OR REPLACE FUNCTION public.build_property_owner_profile_json(
  p_property_id uuid,
  p_include_contact boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_result jsonb;
begin
  if p_property_id is null then
    return null;
  end if;

  select
    case
      when o."OwnerType" = 'member' then
        jsonb_build_object(
          'ownerId', o."Id",
          'ownerType', o."OwnerType",
          'fullName', nullif(trim(concat_ws(' ', m."FirstName", m."LastName")), ''),
          'avatarUrl', nullif(trim(coalesce(m."AvatarUrl", '')), ''),
          -- Members have no bio column; Title (cargo) is the closest public text field.
          'description', nullif(trim(coalesce(m."Title", '')), ''),
          'city', nullif(trim(coalesce(m."City", '')), ''),
          'state', nullif(trim(coalesce(m."State", '')), ''),
          'country', nullif(trim(coalesce(m."Country", '')), ''),
          'email', case
            when p_include_contact then nullif(trim(coalesce(m."Email", '')), '')
            else null
          end,
          'phone', case
            when p_include_contact then nullif(trim(coalesce(m."Phone", '')), '')
            else null
          end
        )
      when o."OwnerType" = 'company' then
        jsonb_build_object(
          'ownerId', o."Id",
          'ownerType', o."OwnerType",
          'fullName', nullif(trim(coalesce(c."Name", '')), ''),
          'avatarUrl', nullif(trim(coalesce(c."LogoUrl", '')), ''),
          'description', nullif(trim(coalesce(c."Description", '')), ''),
          'city', nullif(trim(coalesce(c."City", '')), ''),
          'state', nullif(trim(coalesce(c."State", '')), ''),
          'country', nullif(trim(coalesce(c."Country", '')), ''),
          'email', case
            when p_include_contact then nullif(trim(coalesce(c."BillingEmail", '')), '')
            else null
          end,
          'phone', case
            when p_include_contact then nullif(trim(coalesce(c."Phone", '')), '')
            else null
          end
        )
      else null
    end
  into v_result
  from public."EstateProperties" ep
  join public."Owners" o
    on o."Id" = ep."OwnerId"
   and o."IsDeleted" = false
  left join public."Members" m
    on o."OwnerType" = 'member'
   and o."MemberId" = m."Id"
   and m."IsDeleted" = false
  left join public."Companies" c
    on o."OwnerType" = 'company'
   and o."CompanyId" = c."Id"
   and c."IsDeleted" = false
  where ep."Id" = p_property_id
    and ep."IsDeleted" = false
  limit 1;

  return v_result;
end;
$$;

COMMENT ON FUNCTION public.build_property_owner_profile_json(uuid, boolean) IS
  'Internal helper: owner/host profile JSON. Contact (email/phone) only when p_include_contact is true.';

REVOKE ALL ON FUNCTION public.build_property_owner_profile_json(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_property_owner_profile_json(uuid, boolean) TO service_role;

-- 1) Public listing detail: profile only, never contact.
CREATE OR REPLACE FUNCTION public.get_public_property_owner(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if p_property_id is null then
    return null;
  end if;

  -- Only expose owner profile when the property has a public guest listing.
  if not exists (
    select 1
    from public."EstateProperties" ep
    join public."Listings" l
      on l."EstatePropertyId" = ep."Id"
     and l."IsDeleted" = false
     and l."IsActive" = true
     and l."IsPropertyVisible" = true
     and l."ListingType" in (
       'SummerRent'::public."ListingType",
       'EventVenue'::public."ListingType",
       'RealEstate'::public."ListingType"
     )
    where ep."Id" = p_property_id
      and ep."IsDeleted" = false
  ) then
    return null;
  end if;

  return public.build_property_owner_profile_json(p_property_id, false);
end;
$$;

COMMENT ON FUNCTION public.get_public_property_owner(uuid) IS
  'Guest-safe public host card for property detail pages. No email/phone. Null when property has no public listing.';

REVOKE ALL ON FUNCTION public.get_public_property_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_property_owner(uuid) TO anon, authenticated, service_role;

-- 2) Booked guest: same profile + contact when booking is confirmed or completed.
-- Auth via manage token OR reservation code + listing type (same gates as manage/lookup RPCs).
CREATE OR REPLACE FUNCTION public.get_booking_property_owner(
  p_manage_token text DEFAULT NULL,
  p_reservation_code text DEFAULT NULL,
  p_listing_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare
  v_token text := nullif(trim(coalesce(p_manage_token, '')), '');
  v_code text := upper(trim(coalesce(p_reservation_code, '')));
  v_listing_type public."ListingType";
  v_token_hash text;
  v_booking_id uuid;
  v_property_id uuid;
  v_status_code integer;
  v_include_contact boolean := false;
  v_owner jsonb;
begin
  if v_token is not null then
    v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

    select t.booking_id
    into v_booking_id
    from public.booking_manage_tokens t
    where t.token_hash = v_token_hash
      and t.revoked_at is null
      and t.expires_at > now()
    limit 1;

    if v_booking_id is null then
      return jsonb_build_object('success', false, 'error', 'Invalid or expired token');
    end if;

    select b."EstatePropertyId", b."Status"
    into v_property_id, v_status_code
    from public."Bookings" b
    where b."Id" = v_booking_id
      and b."IsDeleted" = false;

    if v_property_id is null then
      return jsonb_build_object('success', false, 'error', 'Reservation not found');
    end if;
  elsif v_code <> '' then
    if v_code !~ '^RSV-[A-Z0-9]{6}$' then
      return jsonb_build_object('success', false, 'error', 'Invalid reservation code format');
    end if;

    begin
      v_listing_type := public.validate_guest_site_listing_type(p_listing_type);
    exception
      when others then
        return jsonb_build_object('success', false, 'error', 'Invalid listing type');
    end;

    select b."Id", b."EstatePropertyId", b."Status"
    into v_booking_id, v_property_id, v_status_code
    from public."Bookings" b
    where b."ReservationCode" = v_code
      and b."IsDeleted" = false
      and public.booking_matches_guest_site_listing_type(
        b."ListingType",
        b."EstatePropertyId",
        b."CheckInDate"::timestamptz,
        b."CheckOutDate"::timestamptz,
        v_listing_type
      )
    order by b."Created" desc
    limit 1;

    if v_booking_id is null then
      return jsonb_build_object('success', false, 'error', 'Reservation not found');
    end if;
  else
    return jsonb_build_object(
      'success', false,
      'error', 'Provide p_manage_token or p_reservation_code with p_listing_type'
    );
  end if;

  -- Contact only after confirmation (same rule as get_booking_by_manage_token / get_reservation_by_code).
  v_include_contact := v_status_code in (1, 3);

  v_owner := public.build_property_owner_profile_json(v_property_id, v_include_contact);

  if v_owner is null then
    return jsonb_build_object('success', false, 'error', 'Owner not found');
  end if;

  return jsonb_build_object(
    'success', true,
    'owner', v_owner,
    'contactAvailable', v_include_contact
  );
end;
$$;

COMMENT ON FUNCTION public.get_booking_property_owner(text, text, text) IS
  'Booked-guest host profile. Auth via manage token or reservation code + listing type. Email/phone included only when booking is confirmed or completed.';

REVOKE ALL ON FUNCTION public.get_booking_property_owner(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_property_owner(text, text, text) TO anon, authenticated, service_role;

-- Prevent direct public lookup of host email/phone by property id.
-- Internal callers (SECURITY DEFINER RPCs / service_role edges) still work.
REVOKE ALL ON FUNCTION public.resolve_host_contact_for_property(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_host_contact_for_property(uuid) TO service_role;
