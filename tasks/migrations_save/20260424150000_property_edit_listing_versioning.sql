-- Property edit modernization support.
-- NOTE: This file is generated for manual review/apply.

create or replace function public.create_listing_version(
  p_estate_property_id uuid,
  p_listing_type text,
  p_title text,
  p_description text default null,
  p_available_from timestamptz default null,
  p_currency integer default 0,
  p_sale_price double precision default null,
  p_rent_price double precision default null,
  p_rent_price_period text default null,
  p_is_price_visible boolean default true,
  p_is_active boolean default true,
  p_is_property_visible boolean default true,
  p_blocked_for_booking boolean default false
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_listing_id uuid;
begin
  update public."Listings"
    set "IsFeatured" = false,
        "IsActive" = false,
        "IsPropertyVisible" = false,
        "LastModified" = now()
  where "EstatePropertyId" = p_estate_property_id
    and "ListingType" = p_listing_type
    and "IsDeleted" = false
    and "IsFeatured" = true;

  insert into public."Listings" (
    "EstatePropertyId",
    "ListingType",
    "Title",
    "Description",
    "AvailableFrom",
    "Currency",
    "SalePrice",
    "RentPrice",
    "RentPricePeriod",
    "IsPriceVisible",
    "IsActive",
    "IsPropertyVisible",
    "IsFeatured",
    "BlockedForBooking",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  values (
    p_estate_property_id,
    p_listing_type,
    p_title,
    p_description,
    coalesce(p_available_from, now()),
    p_currency,
    p_sale_price,
    p_rent_price,
    p_rent_price_period,
    p_is_price_visible,
    p_is_active,
    p_is_property_visible,
    true,
    p_blocked_for_booking,
    false,
    now(),
    now()
  )
  returning "Id" into v_new_listing_id;

  return v_new_listing_id;
end;
$$;

-- Additive extension insert hook for edit flow.
-- Adjust table/columns to your canonical extension storage model if needed.
create or replace function public.insert_property_extension(
  p_property_id uuid,
  p_extension_type text,
  p_allows_financing boolean default null,
  p_is_new_construction boolean default null,
  p_has_mortgage boolean default null,
  p_hoa_fees double precision default null,
  p_min_contract_months integer default null,
  p_requires_guarantee boolean default null,
  p_guarantee_type text default null,
  p_allows_pets boolean default null,
  p_max_guests integer default null,
  p_has_catering boolean default null,
  p_has_sound_system boolean default null,
  p_closing_hour text default null,
  p_allowed_events_description text default null,
  p_min_stay_days integer default null,
  p_max_stay_days integer default null,
  p_lead_time_days integer default null,
  p_buffer_days integer default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public."PropertyExtensions" (
    "EstatePropertyId",
    "ExtensionType",
    "AllowsFinancing",
    "IsNewConstruction",
    "HasMortgage",
    "HoaFees",
    "MinContractMonths",
    "RequiresGuarantee",
    "GuaranteeType",
    "AllowsPets",
    "MaxGuests",
    "HasCatering",
    "HasSoundSystem",
    "ClosingHour",
    "AllowedEventsDescription",
    "MinStayDays",
    "MaxStayDays",
    "LeadTimeDays",
    "BufferDays",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  values (
    p_property_id,
    p_extension_type,
    p_allows_financing,
    p_is_new_construction,
    p_has_mortgage,
    p_hoa_fees,
    p_min_contract_months,
    p_requires_guarantee,
    p_guarantee_type,
    p_allows_pets,
    p_max_guests,
    p_has_catering,
    p_has_sound_system,
    p_closing_hour,
    p_allowed_events_description,
    p_min_stay_days,
    p_max_stay_days,
    p_lead_time_days,
    p_buffer_days,
    false,
    now(),
    now()
  );
end;
$$;

-- Persist extension-specific fields from the property edit wizard (Step 2).
create or replace function public.update_estate_property_wizard_extensions(
  p_property_id uuid,
  p_allows_financing boolean default null,
  p_is_new_construction boolean default null,
  p_has_mortgage boolean default null,
  p_hoa_fees double precision default null,
  p_min_contract_months integer default null,
  p_requires_guarantee boolean default null,
  p_guarantee_type text default null,
  p_allows_pets boolean default null,
  p_min_stay_days integer default null,
  p_max_stay_days integer default null,
  p_lead_time_days integer default null,
  p_buffer_days integer default null,
  p_max_guests integer default null,
  p_has_catering boolean default null,
  p_has_sound_system boolean default null,
  p_closing_hour text default null,
  p_allowed_events_description text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public."RealEstateExtension" r
  set
    "AllowsFinancing" = p_allows_financing,
    "IsNewConstruction" = p_is_new_construction,
    "HasMortgage" = p_has_mortgage,
    "HoaFees" = p_hoa_fees,
    "MinContractMonths" = p_min_contract_months,
    "RequiresGuarantee" = p_requires_guarantee,
    "GuaranteeType" = p_guarantee_type,
    "AllowsPets" = p_allows_pets,
    "LastModified" = now()
  where r."EstatePropertyId" = p_property_id;

  update public."SummerRentExtension" s
  set
    "MinStayDays" = p_min_stay_days,
    "MaxStayDays" = p_max_stay_days,
    "LeadTimeDays" = p_lead_time_days,
    "BufferDays" = p_buffer_days,
    "LastModified" = now()
  where s."EstatePropertyId" = p_property_id;

  update public."EventVenueExtension" e
  set
    "MaxGuests" = p_max_guests,
    "HasCatering" = p_has_catering,
    "HasSoundSystem" = p_has_sound_system,
    "ClosingHour" = p_closing_hour,
    "AllowedEventsDescription" = p_allowed_events_description,
    "LastModified" = now()
  where e."EstatePropertyId" = p_property_id;
end;
$$;

