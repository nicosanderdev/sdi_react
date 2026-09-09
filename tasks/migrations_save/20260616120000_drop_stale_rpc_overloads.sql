-- Drop stale PostgreSQL function overloads and ensure canonical RPC signatures.
-- Manual apply by project owner (idempotent where possible).
-- Prerequisite: run tasks/drop_stale_rpc_overloads_inspection.sql first.
--
-- Canonical sources:
--   admin_get_billable_usage     -> 20260523120000_admin_get_billable_usage_operations.sql
--   create_estate_property       -> 20260610120000_estate_property_amenity_localized_descriptions.sql
--   update_estate_property       -> 20260611120100_property_policies_sections_rpc_patches.sql
--   validate_booking_selection   -> 20260602120100_dynamic_pricing_validation.sql
--   insert_property_details_section -> 20260611120000_estate_property_policies_and_localized_sections.sql
--   search_param_num             -> 20260603120000_property_search_schema.sql
--   user admin RPCs              -> 20260506154100, 20260506154200

begin;

-- ============================================================================
-- 1) Drop stale overloads
-- ============================================================================

-- admin_get_billable_usage: legacy 4-param (before p_only_unbilled)
drop function if exists public.admin_get_billable_usage(text, integer, date, date);
drop function if exists public.admin_get_billable_usage(text, int, date, date);

-- create_estate_property: without p_amenity_links
drop function if exists public.create_estate_property(
  uuid,
  text, text, text, text, text, text, text, text,
  double precision, double precision,
  integer, double precision, integer, integer, integer,
  boolean, boolean, boolean, boolean,
  integer, integer, integer,
  boolean, boolean, boolean,
  double precision, integer, boolean, text, boolean,
  integer, boolean, boolean, text, text,
  integer, integer, integer, integer,
  text, uuid[]
);

-- update_estate_property: pre-policies / pre-amenity_links stubs
drop function if exists public.update_estate_property(
  text, text, text, text, text, text, text, text, text,
  double precision, double precision, double precision,
  integer, integer, integer, boolean, integer,
  text, timestamp with time zone,
  integer, double precision, double precision,
  boolean, double precision, boolean, boolean, boolean,
  integer, boolean, boolean,
  jsonb, jsonb, jsonb, jsonb
);
drop function if exists public.update_estate_property(
  text, text, text, text, text, text, text, text, text,
  double precision, double precision, double precision,
  integer, integer, integer, boolean, integer,
  text, timestamp with time zone,
  integer, double precision, double precision,
  boolean, double precision, boolean, boolean, boolean,
  integer, boolean, boolean,
  jsonb, jsonb, jsonb, jsonb, jsonb
);
drop function if exists public.update_estate_property(
  text, text, text, text, text, text, text, text, text,
  double precision, double precision, double precision,
  integer, integer, integer, boolean, integer,
  text, timestamp with time zone,
  integer, double precision, double precision,
  boolean, double precision, boolean, boolean, boolean,
  integer, boolean, boolean,
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
);

-- validate_booking_selection: 4-arg legacy stub
drop function if exists public.validate_booking_selection(uuid, date, date, integer);

-- insert_property_details_section: 7-arg (no localized fields)
drop function if exists public.insert_property_details_section(
  uuid, text, text, text, text, jsonb, integer
);

-- search_param_num: 2-arg legacy
drop function if exists public.search_param_num(jsonb, text);

-- user admin: common legacy signatures
drop function if exists public.reset_user_onboarding(text);
drop function if exists public.update_user_role(text, text);
drop function if exists public.soft_delete_user(uuid);
drop function if exists public.soft_delete_user(text);
drop function if exists public.soft_delete_user(text, text);
drop function if exists public.force_user_logout(uuid);
drop function if exists public.force_user_logout(text);
drop function if exists public.force_user_logout(text, text);

-- count_member_published_properties: orphan (not in repo). Uncomment after inspection query #4 returns zero rows.
-- drop function if exists public.count_member_published_properties(uuid);
-- drop function if exists public.count_member_published_properties(text);

-- ============================================================================
-- 2) Ensure canonical overloads exist (CREATE OR REPLACE)
-- ============================================================================

create or replace function public.admin_get_billable_usage(
  p_user_search text default null,
  p_payment_status int default null,
  p_from_date date default null,
  p_to_date date default null,
  p_only_unbilled boolean default false
) returns table (
  id uuid,
  user_name text,
  user_email text,
  user_identifier text,
  property_name text,
  check_in_date date,
  check_out_date date,
  total_amount numeric,
  currency int,
  payment_status int,
  operation_type text,
  target_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user uuid;
  v_is_admin boolean := false;
begin
  v_current_user := auth.uid();
  if v_current_user is null then
    raise exception 'Unauthorized';
  end if;

  select exists (
    select 1
    from public."Members" m
    where m."UserId" = v_current_user
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  with usage_booking as (
    select
      ur."Id" as usage_id,
      ur."SubjectType" as subject_type,
      ur."MemberOrCompanyId" as subject_id,
      ur."ReferenceId" as target_id,
      ur."InvoiceId" as invoice_id,
      ur."CreatedAt" as usage_created_at
    from public."UsageRecords" ur
    where ur."Type" = 'booking'
  ),
  joined_booking as (
    select
      ub.usage_id,
      ub.subject_type,
      ub.subject_id,
      ub.target_id,
      ub.invoice_id,
      ub.usage_created_at,
      coalesce(i."Status", 'pending') as invoice_status,
      b."CheckInDate"::date as check_in_date,
      b."CheckOutDate"::date as check_out_date,
      coalesce(ur_amount."Amount", b."TotalAmount", 0) as total_amount,
      coalesce(b."Currency", 0) as currency,
      o."Id" as owner_id,
      m_bill."FirstName" as bill_member_first,
      m_bill."LastName" as bill_member_last,
      m_bill."Email" as bill_member_email,
      c_bill."Name" as bill_company_name,
      c_bill."BillingEmail" as bill_company_email,
      trim(concat_ws(' ', m_owner."FirstName", m_owner."LastName")) as member_name,
      m_owner."Email" as member_email,
      c_owner."Name" as company_name,
      c_owner."BillingEmail" as company_email,
      ep."StreetName",
      ep."HouseNumber",
      'booking'::text as operation_type
    from usage_booking ub
    left join public."UsageRecords" ur_amount on ur_amount."Id" = ub.usage_id
    join public."Bookings" b
      on b."Id"::text = ub.target_id
     and b."IsDeleted" = false
    join public."EstateProperties" ep
      on ep."Id" = b."EstatePropertyId"
     and ep."IsDeleted" = false
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    left join public."Members" m_owner
      on m_owner."Id" = o."MemberId"
     and m_owner."IsDeleted" = false
    left join public."Companies" c_owner
      on c_owner."Id" = o."CompanyId"
     and c_owner."IsDeleted" = false
    left join public."Members" m_bill
      on ub.subject_type = 'member'
     and m_bill."Id" = ub.subject_id
     and m_bill."IsDeleted" = false
    left join public."Companies" c_bill
      on ub.subject_type = 'company'
     and c_bill."Id" = ub.subject_id
     and c_bill."IsDeleted" = false
    left join public."Invoices" i on i."Id" = ub.invoice_id
  ),
  usage_listing as (
    select
      ur."Id" as usage_id,
      ur."SubjectType" as subject_type,
      ur."MemberOrCompanyId" as subject_id,
      ur."ReferenceId" as target_id,
      ur."InvoiceId" as invoice_id,
      ur."CreatedAt" as usage_created_at
    from public."UsageRecords" ur
    where ur."Type" = 'listing'
  ),
  joined_listing as (
    select
      ul.usage_id,
      ul.subject_type,
      ul.subject_id,
      ul.target_id,
      ul.invoice_id,
      ul.usage_created_at,
      coalesce(i."Status", 'pending') as invoice_status,
      null::date as check_in_date,
      null::date as check_out_date,
      coalesce(ur_amount."Amount", 0) as total_amount,
      coalesce(l."Currency", 0) as currency,
      o."Id" as owner_id,
      m_bill."FirstName" as bill_member_first,
      m_bill."LastName" as bill_member_last,
      m_bill."Email" as bill_member_email,
      c_bill."Name" as bill_company_name,
      c_bill."BillingEmail" as bill_company_email,
      trim(concat_ws(' ', m_owner."FirstName", m_owner."LastName")) as member_name,
      m_owner."Email" as member_email,
      c_owner."Name" as company_name,
      c_owner."BillingEmail" as company_email,
      ep."StreetName",
      ep."HouseNumber",
      'listing'::text as operation_type
    from usage_listing ul
    left join public."UsageRecords" ur_amount on ur_amount."Id" = ul.usage_id
    join public."Listings" l
      on l."Id"::text = ul.target_id
     and l."IsDeleted" = false
    join public."EstateProperties" ep
      on ep."Id" = l."EstatePropertyId"
     and ep."IsDeleted" = false
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    left join public."Members" m_owner
      on m_owner."Id" = o."MemberId"
     and m_owner."IsDeleted" = false
    left join public."Companies" c_owner
      on c_owner."Id" = o."CompanyId"
     and c_owner."IsDeleted" = false
    left join public."Members" m_bill
      on ul.subject_type = 'member'
     and m_bill."Id" = ul.subject_id
     and m_bill."IsDeleted" = false
    left join public."Companies" c_bill
      on ul.subject_type = 'company'
     and c_bill."Id" = ul.subject_id
     and c_bill."IsDeleted" = false
    left join public."Invoices" i on i."Id" = ul.invoice_id
  ),
  combined as (
    select * from joined_booking
    union all
    select * from joined_listing
  )
  select
    c.usage_id as id,
    coalesce(
      nullif(trim(concat_ws(' ', c.bill_member_first, c.bill_member_last)), ''),
      nullif(c.bill_company_name, ''),
      nullif(c.member_name, ''),
      nullif(c.company_name, ''),
      'Sin propietario'
    )::text as user_name,
    coalesce(
      nullif(c.bill_member_email, ''),
      nullif(c.bill_company_email, ''),
      nullif(c.member_email, ''),
      nullif(c.company_email, ''),
      ''
    )::text as user_email,
    c.subject_id::text as user_identifier,
    trim(concat_ws(' ', c."StreetName", c."HouseNumber"))::text as property_name,
    c.check_in_date,
    c.check_out_date,
    coalesce(c.total_amount, 0)::numeric as total_amount,
    coalesce(c.currency, 0)::int as currency,
    case
      when c.invoice_id is null then 0
      when c.invoice_status = 'paid' then 1
      else 0
    end::int as payment_status,
    c.operation_type,
    c.target_id
  from combined c
  where (
      p_user_search is null
      or trim(p_user_search) = ''
      or coalesce(c.member_name, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.member_email, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.company_name, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.company_email, '') ilike ('%' || p_user_search || '%')
      or coalesce(c.bill_company_name, '') ilike ('%' || p_user_search || '%')
      or c.subject_id::text = p_user_search
      or c.owner_id::text = p_user_search
    )
    and (
      p_payment_status is null
      or (p_payment_status = 1 and c.invoice_id is not null and c.invoice_status = 'paid')
      or (p_payment_status = 0 and (c.invoice_id is null or c.invoice_status <> 'paid'))
    )
    and (
      p_from_date is null
      or (
        c.operation_type = 'booking'
        and c.check_in_date >= p_from_date
      )
      or (
        c.operation_type = 'listing'
        and c.usage_created_at::date >= p_from_date
      )
    )
    and (
      p_to_date is null
      or (
        c.operation_type = 'booking'
        and c.check_out_date <= p_to_date
      )
      or (
        c.operation_type = 'listing'
        and c.usage_created_at::date <= p_to_date
      )
    )
    and (not p_only_unbilled or c.invoice_id is null)
  order by coalesce(c.check_in_date, c.usage_created_at::date) desc nulls last
  limit 500;
end;
$$;


create or replace function public.create_estate_property(
  p_member_id uuid,
  p_street_name text,
  p_house_number text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_zip_code text,
  p_country text,
  p_location_lat double precision,
  p_location_lng double precision,
  p_property_category integer,
  p_area_value double precision,
  p_area_unit integer,
  p_bedrooms integer,
  p_bathrooms integer,
  p_garage_spaces integer,
  p_has_laundry_room boolean,
  p_has_pool boolean,
  p_has_balcony boolean,
  p_is_furnished boolean,
  p_capacity integer,
  p_location_category integer,
  p_view_type integer,
  p_allows_financing boolean,
  p_is_new_construction boolean,
  p_has_mortgage boolean,
  p_hoa_fees double precision,
  p_min_contract_months integer,
  p_requires_guarantee boolean,
  p_guarantee_type text,
  p_allows_pets boolean,
  p_max_guests integer,
  p_has_catering boolean,
  p_has_sound_system boolean,
  p_closing_hour text,
  p_allowed_events_description text,
  p_min_stay_days integer,
  p_max_stay_days integer,
  p_lead_time_days integer,
  p_buffer_days integer,
  p_extension_type text default null::text,
  p_amenity_ids uuid[] default null::uuid[],
  p_amenity_links jsonb default null::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_property_id uuid;
  v_owner_id uuid;
  v_member_id uuid;
  v_company_id uuid;
  v_result jsonb;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  v_hard_cap_limit integer := 10;
  v_free_user_limit integer := 2;
  v_effective_extension_type text;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
begin
  v_member_id := p_member_id;
  v_company_id := null;

  if v_member_id is null then
    raise exception 'Member ID is required to create an estate property.';
  end if;

  begin
    v_owner_id := get_or_create_owner(v_member_id, v_company_id, null);
  exception when undefined_function then
    v_owner_id := coalesce(v_member_id, v_company_id);
  end;

  begin
    select count(*) into v_existing_property_count
    from public."EstateProperties" ep
    inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
    where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = v_member_id) or
      (o."OwnerType" = 'company' and o."CompanyId" in (
        select cm."CompanyId"
        from public."CompanyMembers" cm
        where cm."MemberId" = v_member_id and cm."IsDeleted" = false
      ))
    );

    select coalesce(p."ListingLimit", p."MaxProperties", v_free_user_limit)
      into v_subscription_plan_max_properties
    from public."Members" m
    left join lateral (
      select bpa."PlanId"
      from public."BillingPlanAssignments" bpa
      where bpa."SubjectType" = 'member'
        and bpa."MemberOrCompanyId" = v_member_id
        and bpa."IsActive" = true
        and bpa."StartDate" <= now()
        and (bpa."EndDate" is null or bpa."EndDate" >= now())
      order by bpa."StartDate" desc
      limit 1
    ) active_plan on true
    left join public."Plans" p
      on p."Id" = active_plan."PlanId"
      and coalesce(p."IsActiveV2", p."IsActive", true) = true
      and p."IsDeleted" = false
    where m."Id" = v_member_id
      and m."IsDeleted" = false;

    if v_subscription_plan_max_properties is null then
      v_subscription_plan_max_properties := v_free_user_limit;
    end if;

    v_subscription_plan_max_properties := least(v_subscription_plan_max_properties, v_hard_cap_limit);

    if v_existing_property_count >= v_subscription_plan_max_properties then
      raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
        v_existing_property_count, v_subscription_plan_max_properties;
    end if;
  end;

  v_property_id := gen_random_uuid();

  insert into public."EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "IsDeleted",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType"
  ) values (
    v_property_id,
    p_street_name,
    p_house_number,
    p_neighborhood,
    p_city,
    p_state,
    p_zip_code,
    p_country,
    p_location_lat,
    p_location_lng,
    p_area_value,
    p_area_unit,
    p_bedrooms,
    p_bathrooms,
    (p_garage_spaces is not null and p_garage_spaces > 0),
    p_garage_spaces,
    v_owner_id,
    false,
    coalesce(p_has_laundry_room, false),
    coalesce(p_has_pool, false),
    coalesce(p_has_balcony, false),
    coalesce(p_is_furnished, false),
    p_capacity,
    case coalesce(p_location_category, 1)
      when 0 then 'rural'::public."LocationCategory"
      when 1 then 'city'::public."LocationCategory"
      when 2 then 'near_shore'::public."LocationCategory"
      else 'city'::public."LocationCategory"
    end,
    case coalesce(p_view_type, 0)
      when 0 then 'city'::public."ViewType"
      when 1 then 'mountain'::public."ViewType"
      when 2 then 'rural'::public."ViewType"
      when 3 then 'sea'::public."ViewType"
      else 'city'::public."ViewType"
    end
  );

  v_effective_extension_type := coalesce(p_extension_type, 'RealEstate');

  if lower(v_effective_extension_type) = 'realestate' then
    insert into public."RealEstateExtension" (
      "EstatePropertyId",
      "AllowsFinancing",
      "IsNewConstruction",
      "HasMortgage",
      "HOAFees",
      "MinContractMonths",
      "RequiresGuarantee",
      "GuaranteeType",
      "AllowsPets",
      "Category"
    ) values (
      v_property_id,
      p_allows_financing,
      p_is_new_construction,
      p_has_mortgage,
      p_hoa_fees,
      p_min_contract_months,
      p_requires_guarantee,
      p_guarantee_type,
      p_allows_pets,
      case coalesce(p_property_category, 0)
        when 0 then 'Casa'::public."PropertyCategory"
        when 1 then 'Apartamento'::public."PropertyCategory"
        when 2 then 'Terreno'::public."PropertyCategory"
        when 3 then 'Chacra'::public."PropertyCategory"
        when 4 then 'Campo'::public."PropertyCategory"
        else 'Casa'::public."PropertyCategory"
      end
    );
  elsif lower(v_effective_extension_type) = 'eventvenue' then
    insert into public."EventVenueExtension" (
      "EstatePropertyId",
      "MaxGuests",
      "HasCatering",
      "HasSoundSystem",
      "ClosingHour",
      "AllowedEventsDescription",
      "Created",
      "LastModified"
    ) values (
      v_property_id,
      p_max_guests,
      p_has_catering,
      p_has_sound_system,
      nullif(p_closing_hour, '')::time,
      p_allowed_events_description,
      now(),
      now()
    );
  elsif lower(v_effective_extension_type) = 'summerrent' then
    insert into public."SummerRentExtension" (
      "EstatePropertyId",
      "MinStayDays",
      "MaxStayDays",
      "LeadTimeDays",
      "BufferDays"
    ) values (
      v_property_id,
      p_min_stay_days,
      p_max_stay_days,
      p_lead_time_days,
      p_buffer_days
    );
  end if;

  if p_amenity_links is not null and jsonb_typeof(p_amenity_links) = 'array' and jsonb_array_length(p_amenity_links) > 0 then
    for v_link in select * from jsonb_array_elements(p_amenity_links)
    loop
      v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
      if v_amenity_id is null then
        continue;
      end if;
      v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
      insert into public."EstatePropertyAmenity" (
        "EstatePropertyId",
        "AmenityId",
        "LocalizedDescriptions",
        "CreatedAtUtc",
        "DeletedAtUtc"
      ) values (
        v_property_id,
        v_amenity_id,
        v_descriptions,
        now(),
        null
      );
    end loop;
  elsif p_amenity_ids is not null and array_length(p_amenity_ids, 1) > 0 then
    insert into public."EstatePropertyAmenity" (
      "EstatePropertyId",
      "AmenityId",
      "LocalizedDescriptions",
      "CreatedAtUtc",
      "DeletedAtUtc"
    )
    select
      v_property_id,
      amenity_id,
      '{}'::jsonb,
      now(),
      null
    from unnest(p_amenity_ids) as amenity_id;
  end if;

  v_result := jsonb_build_object(
    'id', v_property_id,
    'streetName', p_street_name,
    'houseNumber', p_house_number,
    'neighborhood', p_neighborhood,
    'city', p_city,
    'state', p_state,
    'zipCode', p_zip_code,
    'country', p_country,
    'location', jsonb_build_object('lat', p_location_lat, 'lng', p_location_lng),
    'areaValue', p_area_value,
    'areaUnit', p_area_unit,
    'bedrooms', p_bedrooms,
    'bathrooms', p_bathrooms,
    'hasGarage', (p_garage_spaces is not null and p_garage_spaces > 0),
    'garageSpaces', p_garage_spaces,
    'hasLaundryRoom', p_has_laundry_room,
    'hasPool', p_has_pool,
    'hasBalcony', p_has_balcony,
    'isFurnished', p_is_furnished,
    'capacity', p_capacity,
    'locationCategory', p_location_category,
    'viewType', p_view_type,
    'ownerId', v_owner_id,
    'created', now()
  );

  return v_result;
exception
  when others then
    raise exception 'Failed to create estate property: %', sqlerrm;
end;
$$;


create or replace function public.update_estate_property(
  p_property_id text,
  p_user_id text,
  p_street_name text default null,
  p_house_number text default null,
  p_neighborhood text default null,
  p_city text default null,
  p_state text default null,
  p_zip_code text default null,
  p_country text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_title text default null,
  p_property_type integer default null,
  p_area_value double precision default null,
  p_area_unit integer default null,
  p_bedrooms integer default null,
  p_bathrooms integer default null,
  p_has_garage boolean default null,
  p_garage_spaces integer default null,
  p_description text default null,
  p_available_from timestamp with time zone default null,
  p_currency integer default null,
  p_sale_price double precision default null,
  p_rent_price double precision default null,
  p_has_common_expenses boolean default null,
  p_common_expenses_value double precision default null,
  p_is_electricity_included boolean default null,
  p_is_water_included boolean default null,
  p_is_price_visible boolean default null,
  p_status integer default null,
  p_is_active boolean default null,
  p_is_property_visible boolean default null,
  p_property_images jsonb default null,
  p_property_documents jsonb default null,
  p_property_videos jsonb default null,
  p_amenity_ids jsonb default null,
  p_amenity_links jsonb default null,
  p_policies jsonb default null,
  p_content_sections jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid := p_property_id::uuid;
  v_listing_id uuid;
  v_link jsonb;
  v_amenity_id uuid;
  v_descriptions jsonb;
  v_image_record jsonb;
  v_document_record jsonb;
  v_video_record jsonb;
  v_result jsonb;
begin
  if not exists (
    select 1 from public."EstateProperties" ep
    where ep."Id" = v_property_id and ep."IsDeleted" = false
  ) then
    raise exception 'Property not found or already deleted';
  end if;

  if not public.is_property_owner(p_user_id::uuid, v_property_id) then
    raise exception 'User does not own this property';
  end if;

  update public."EstateProperties"
  set
    "StreetName" = coalesce(p_street_name, "StreetName"),
    "HouseNumber" = coalesce(p_house_number, "HouseNumber"),
    "Neighborhood" = coalesce(p_neighborhood, "Neighborhood"),
    "City" = coalesce(p_city, "City"),
    "State" = coalesce(p_state, "State"),
    "ZipCode" = coalesce(p_zip_code, "ZipCode"),
    "Country" = coalesce(p_country, "Country"),
    "LocationLatitude" = coalesce(p_location_lat, "LocationLatitude"),
    "LocationLongitude" = coalesce(p_location_lng, "LocationLongitude"),
    "AreaValue" = coalesce(p_area_value, "AreaValue"),
    "AreaUnit" = coalesce(p_area_unit, "AreaUnit"),
    "Bedrooms" = coalesce(p_bedrooms, "Bedrooms"),
    "Bathrooms" = coalesce(p_bathrooms, "Bathrooms"),
    "HasGarage" = coalesce(p_has_garage, "HasGarage"),
    "GarageSpaces" = coalesce(p_garage_spaces, "GarageSpaces")
  where "Id" = v_property_id;

  select l."Id"
  into v_listing_id
  from public."Listings" l
  where l."EstatePropertyId" = v_property_id
    and l."IsDeleted" = false
  order by l."IsFeatured" desc nulls last, l."Created" desc
  limit 1;

  if v_listing_id is not null then
    update public."Listings"
    set
      "Title" = coalesce(p_title, "Title"),
      "Description" = coalesce(p_description, "Description"),
      "AvailableFrom" = coalesce(p_available_from, "AvailableFrom"),
      "Currency" = coalesce(p_currency, "Currency"),
      "SalePrice" = coalesce(p_sale_price, "SalePrice"),
      "RentPrice" = coalesce(p_rent_price, "RentPrice"),
      "HasCommonExpenses" = coalesce(p_has_common_expenses, "HasCommonExpenses"),
      "CommonExpensesValue" = coalesce(p_common_expenses_value, "CommonExpensesValue"),
      "IsElectricityIncluded" = coalesce(p_is_electricity_included, "IsElectricityIncluded"),
      "IsWaterIncluded" = coalesce(p_is_water_included, "IsWaterIncluded"),
      "IsPriceVisible" = coalesce(p_is_price_visible, "IsPriceVisible"),
      "Status" = coalesce(p_status, "Status"),
      "IsActive" = coalesce(p_is_active, "IsActive"),
      "IsPropertyVisible" = coalesce(p_is_property_visible, "IsPropertyVisible"),
      "LastModified" = now(),
      "LastModifiedBy" = p_user_id
    where "Id" = v_listing_id;
  end if;

  if p_property_images is not null then
    update public."PropertyImages"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_images) = 'array' and jsonb_array_length(p_property_images) > 0 then
      for v_image_record in select * from jsonb_array_elements(p_property_images)
      loop
        insert into public."PropertyImages" (
          "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
        ) values (
          coalesce(nullif(v_image_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_image_record->>'url',
          coalesce(v_image_record->>'altText', ''),
          coalesce((v_image_record->>'isMain')::boolean, false),
          false,
          now(), p_user_id, now(), p_user_id,
          coalesce((v_image_record->>'displayOrder')::integer, 0)
        );
      end loop;
    end if;
  end if;

  if p_property_documents is not null then
    update public."PropertyDocuments"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_documents) = 'array' and jsonb_array_length(p_property_documents) > 0 then
      for v_document_record in select * from jsonb_array_elements(p_property_documents)
      loop
        insert into public."PropertyDocuments" (
          "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_document_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_document_record->>'url',
          coalesce(v_document_record->>'name', ''),
          coalesce(v_document_record->>'fileType', 'pdf'),
          coalesce((v_document_record->>'isPublic')::boolean, true),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_property_videos is not null then
    update public."PropertyVideos"
    set "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = p_user_id
    where "EstatePropertyId" = v_property_id and "IsDeleted" = false;

    if jsonb_typeof(p_property_videos) = 'array' and jsonb_array_length(p_property_videos) > 0 then
      for v_video_record in select * from jsonb_array_elements(p_property_videos)
      loop
        insert into public."PropertyVideos" (
          "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
          "Created", "CreatedBy", "LastModified", "LastModifiedBy"
        ) values (
          coalesce(nullif(v_video_record->>'id', '')::uuid, gen_random_uuid()),
          v_property_id,
          v_video_record->>'url',
          coalesce(v_video_record->>'title', ''),
          coalesce(v_video_record->>'description', ''),
          false,
          now(), p_user_id, now(), p_user_id
        );
      end loop;
    end if;
  end if;

  if p_amenity_links is not null or p_amenity_ids is not null then
    delete from public."EstatePropertyAmenity"
    where "EstatePropertyId" = v_property_id;

    if p_amenity_links is not null
       and jsonb_typeof(p_amenity_links) = 'array'
       and jsonb_array_length(p_amenity_links) > 0 then
      for v_link in select * from jsonb_array_elements(p_amenity_links)
      loop
        v_amenity_id := nullif(trim(both from coalesce(v_link->>'amenityId', v_link->>'amenity_id', '')), '')::uuid;
        if v_amenity_id is null then
          continue;
        end if;
        v_descriptions := public.sanitize_amenity_localized_descriptions(v_link->'descriptions');
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, v_descriptions, now(), null
        );
      end loop;
    elsif p_amenity_ids is not null
          and jsonb_typeof(p_amenity_ids) = 'array'
          and jsonb_array_length(p_amenity_ids) > 0 then
      for v_amenity_id in
        select nullif(trim(both from value), '')::uuid
        from jsonb_array_elements_text(p_amenity_ids) as t(value)
        where nullif(trim(both from value), '') is not null
      loop
        insert into public."EstatePropertyAmenity" (
          "EstatePropertyId", "AmenityId", "LocalizedDescriptions", "CreatedAtUtc", "DeletedAtUtc"
        ) values (
          v_property_id, v_amenity_id, '{}'::jsonb, now(), null
        );
      end loop;
    end if;
  end if;

  if p_policies is not null then
    perform public.replace_estate_property_policies(v_property_id, p_policies);
  end if;

  if p_content_sections is not null then
    perform public.replace_estate_property_content_sections(v_property_id, p_content_sections);
  end if;

  select jsonb_build_object(
    'id', ep."Id",
    'streetName', ep."StreetName",
    'houseNumber', ep."HouseNumber",
    'neighborhood', ep."Neighborhood",
    'city', ep."City",
    'state', ep."State",
    'zipCode', ep."ZipCode",
    'country', ep."Country",
    'location', jsonb_build_object('lat', ep."LocationLatitude", 'lng', ep."LocationLongitude"),
    'title', l."Title",
    'areaValue', ep."AreaValue",
    'areaUnit', ep."AreaUnit",
    'bedrooms', ep."Bedrooms",
    'bathrooms', ep."Bathrooms",
    'hasGarage', ep."HasGarage",
    'garageSpaces', ep."GarageSpaces",
    'description', l."Description",
    'availableFrom', l."AvailableFrom",
    'ownerId', ep."OwnerId",
    'currency', l."Currency",
    'salePrice', l."SalePrice",
    'rentPrice', l."RentPrice",
    'hasCommonExpenses', l."HasCommonExpenses",
    'commonExpensesValue', l."CommonExpensesValue",
    'isElectricityIncluded', l."IsElectricityIncluded",
    'isWaterIncluded', l."IsWaterIncluded",
    'isPriceVisible', l."IsPriceVisible",
    'status', l."Status",
    'isActive', l."IsActive",
    'isPropertyVisible', l."IsPropertyVisible",
    'created', ep."Created"
  )
  into v_result
  from public."EstateProperties" ep
  left join public."Listings" l on l."Id" = v_listing_id
  where ep."Id" = v_property_id;

  return v_result;
exception
  when others then
    raise exception 'Failed to update estate property: %', sqlerrm;
end;
$$;


create or replace function public.validate_booking_selection(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_listing_type text default null,
  p_client_total numeric default null,
  p_site_scope text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing_type text;
  v_scope text;
  v_result jsonb;
  v_total numeric;
  v_tolerance numeric;
  v_pricing jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_is_valid boolean := true;
begin
  if p_guests is null or p_guests < 1 then
    v_errors := v_errors || jsonb_build_array('Invalid guest count');
    v_is_valid := false;
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    v_errors := v_errors || jsonb_build_array('Invalid check-in/check-out dates');
    v_is_valid := false;
  end if;

  if not v_is_valid then
    return jsonb_build_object('is_valid', false, 'errors', v_errors, 'pricing', null);
  end if;

  -- Resolve listing type from featured listing if omitted
  v_listing_type := nullif(trim(coalesce(p_listing_type, '')), '');
  if v_listing_type is null then
    select l."ListingType"::text
    into v_listing_type
    from public."Listings" l
    where l."EstatePropertyId" = p_property_id
      and l."IsDeleted" = false
      and l."IsFeatured" = true
    limit 1;
  end if;

  v_scope := coalesce(nullif(trim(p_site_scope), ''), v_listing_type, 'SummerRent');

  if v_listing_type in ('SummerRent', 'EventVenue') then
    v_result := public.pricing_compute_stay_total(
      null,
      p_property_id,
      v_listing_type,
      p_check_in,
      p_check_out,
      v_scope,
      current_date
    );

    if not coalesce((v_result->>'is_valid')::boolean, false) then
      return v_result;
    end if;

    v_pricing := v_result -> 'pricing';
    v_total := (v_pricing->>'total_price')::numeric;

    v_tolerance := public.pricing_param_number(
      public.get_app_parameters(v_scope),
      'PRICE_QUOTE_TOLERANCE',
      1
    );

    if p_client_total is not null and abs(v_total - p_client_total) > v_tolerance then
      return jsonb_build_object(
        'is_valid', false,
        'errors', jsonb_build_array('Price quote mismatch'),
        'error_code', 'PRICE_QUOTE_MISMATCH',
        'pricing', v_pricing
      );
    end if;

    return jsonb_build_object(
      'is_valid', true,
      'errors', '[]'::jsonb,
      'pricing', v_pricing
    );
  end if;

  -- Non dynamic types: legacy flat rent * nights if RentPrice set
  declare
    v_listing record;
    v_nights integer := (p_check_out - p_check_in);
    v_legacy_total numeric;
  begin
    select l."RentPrice", l."Id"
    into v_listing
    from public."Listings" l
    where l."EstatePropertyId" = p_property_id
      and l."IsDeleted" = false
      and l."IsFeatured" = true
    limit 1;

    if v_listing."RentPrice" is not null and v_nights > 0 then
      v_legacy_total := round((v_listing."RentPrice" * v_nights)::numeric, 2);
      v_pricing := jsonb_build_object(
        'nightly_price', v_listing."RentPrice",
        'nights', v_nights,
        'total_price', v_legacy_total
      );
      return jsonb_build_object('is_valid', true, 'errors', '[]'::jsonb, 'pricing', v_pricing);
    end if;

    return jsonb_build_object('is_valid', true, 'errors', '[]'::jsonb, 'pricing', null);
  end;
end;
$$;

grant execute on function public.validate_booking_selection(
  uuid, date, date, integer, text, numeric, text
) to anon, authenticated, service_role;


create or replace function public.insert_property_details_section(
  p_property_id uuid,
  p_name text,
  p_description text default null,
  p_property_type text default null,
  p_layout_type text default 'split',
  p_layout_config jsonb default null,
  p_display_order integer default 0,
  p_localized_name jsonb default null,
  p_localized_description jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section_id uuid := gen_random_uuid();
  v_layout_type text := lower(coalesce(nullif(trim(p_layout_type), ''), 'split'));
  v_name jsonb;
  v_description jsonb;
  v_property_type public."PropertyType";
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  v_name := public.sanitize_localized_text_json(coalesce(
    p_localized_name,
    case when nullif(btrim(coalesce(p_name, '')), '') is not null
      then jsonb_build_object('es', btrim(p_name))
      else '{}'::jsonb
    end
  ));

  if v_name = '{}'::jsonb then
    raise exception 'Section name (localized) is required';
  end if;

  v_description := public.sanitize_localized_text_json(coalesce(
    p_localized_description,
    case when nullif(btrim(coalesce(p_description, '')), '') is not null
      then jsonb_build_object('es', btrim(p_description))
      else '{}'::jsonb
    end
  ));

  if v_layout_type not in ('split', 'carousel', 'stacked') then
    raise exception 'Invalid layout type: %', p_layout_type;
  end if;

  v_property_type := nullif(btrim(coalesce(p_property_type, '')), '')::public."PropertyType";

  insert into public.propertydetailssection (
    id, propertyid, name, description, localizedname, localizeddescription,
    propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat
  ) values (
    v_section_id,
    p_property_id,
    coalesce(v_name->>'es', v_name->>'en', v_name->>'pt', ''),
    coalesce(v_description->>'es', v_description->>'en', v_description->>'pt', ''),
    v_name,
    v_description,
    v_property_type,
    v_layout_type,
    p_layout_config,
    greatest(coalesce(p_display_order, 0), 0),
    false,
    now(),
    now()
  );

  return v_section_id;
end;
$$;

comment on function public.insert_property_details_section(
  uuid, text, text, text, text, jsonb, integer, jsonb, jsonb
) is
  'Creates one marketing/details section for a property wizard submission (localized fields).';

grant execute on function public.insert_property_details_section(
  uuid, text, text, text, text, jsonb, integer, jsonb, jsonb
) to authenticated;

grant execute on function public.insert_property_details_section(
  uuid, text, text, text, text, jsonb, integer, jsonb, jsonb
) to service_role;

create or replace function public.search_param_num(
  p_params jsonb,
  p_key text,
  p_default numeric default 0
)
returns numeric
language sql
immutable
as $$
  select coalesce(
    case jsonb_typeof(p_params -> p_key)
      when 'number' then (p_params ->> p_key)::numeric
      when 'string' then nullif(trim(p_params ->> p_key), '')::numeric
      else null
    end,
    p_default
  );
$$;



create or replace function public.reset_user_onboarding(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "OnboardingStep" = 0,
    "OnboardingComplete" = false,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'Onboarding reset');
end;
$$;

create or replace function public.update_user_role(p_member_id uuid, p_new_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "Role" = p_new_role,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'Role updated');
end;
$$;

create or replace function public.soft_delete_user(p_member_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "IsDeleted" = true,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'User soft-deleted');
end;
$$;

create or replace function public.force_user_logout(p_member_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_member_id uuid;
begin
  select m."Id" into v_admin_member_id
  from public."Members" m
  where m."UserId" = auth.uid()
    and m."IsDeleted" = false
    and m."Role" = 'admin'
  limit 1;

  if v_admin_member_id is null then
    raise exception 'Forbidden: admin only';
  end if;

  insert into public."ForceLogoutRequests" ("MemberId", "RequestedByMemberId", "Reason")
  values (p_member_id, v_admin_member_id, p_reason);

  return jsonb_build_object('success', true, 'message', 'Force logout requested');
end;
$$;

comment on function public.admin_get_billable_usage(text, int, date, date, boolean) is
  'Admin: billable usage rows (booking + listing) for invoice generation UI.';

commit;

