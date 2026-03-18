-- Migration: Create estate property and related RPC functions
-- NOTE: Review carefully and run manually against your Supabase database.

BEGIN;

-- 1) Create / replace create_estate_property RPC
--    - Inserts EstateProperties row
--    - Ensures an Owners row exists and links it
--    - Inserts one related extension row (RealEstateExtension, EventVenueExtension, or SummerRentExtension)
--    - Inserts EstatePropertyAmenity link rows for the provided amenity IDs
CREATE OR REPLACE FUNCTION public.create_estate_property(
    p_member_id uuid,
    -- address
    p_street_name text,
    p_house_number text,
    p_neighborhood text,
    p_city text,
    p_state text,
    p_zip_code text,
    p_country text,
    p_location_lat double precision,
    p_location_lng double precision,

    -- structural
    p_property_category integer,
    p_area_value double precision,
    p_area_unit integer,
    p_bedrooms integer,
    p_bathrooms integer,
    p_garage_spaces integer,
    
    -- infrastructure
    p_has_laundry_room boolean,
    p_has_pool boolean,
    p_has_balcony boolean,
    p_is_furnished boolean,
    p_capacity integer,

    -- location and view categories
    p_location_category integer,
    p_view_type integer,

    -- Real Estate Extension
    p_allows_financing boolean,
    p_is_new_construction boolean,
    p_has_mortgage boolean,
    p_hoa_fees double precision,
    p_min_contract_months integer,
    p_requires_guarantee boolean,
    p_guarantee_type text,
    p_allows_pets boolean,

    -- Event Venue Extension
    p_max_guests integer,
    p_has_catering boolean,
    p_has_sound_system boolean,
    p_closing_hour text,
    p_allowed_events_description text,

    -- Summer Rent Extension
    p_min_stay_days integer,
    p_max_stay_days integer,
    p_lead_time_days integer,
    p_buffer_days integer,
    -- extension type
    p_extension_type text DEFAULT NULL,      -- 'RealEstate' | 'EventVenue' | 'SummerRent'
    -- amenities
    p_amenity_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_id UUID;
    v_owner_id UUID;
    v_member_id UUID;
    v_company_id UUID;
    v_result JSONB;
    v_existing_property_count INTEGER;
    v_subscription_plan_max_properties INTEGER;
    v_hard_cap_limit INTEGER := 10;
    v_free_user_limit INTEGER := 2;
    v_effective_extension_type text;
BEGIN
    -- Resolve owner using existing logic (member-based)
    v_member_id := p_member_id;
    v_company_id := NULL;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'Member ID is required to create an estate property.';
    END IF;

    BEGIN
        -- This will create an Owners row if it does not exist yet.
        v_owner_id := get_or_create_owner(v_member_id, v_company_id, NULL);
    EXCEPTION WHEN undefined_function THEN
        -- Fallback for environments where get_or_create_owner does not exist
        v_owner_id := COALESCE(v_member_id, v_company_id);
    END;

    -- Quota logic unchanged (uses EstateProperties count)
    BEGIN
        SELECT COUNT(*) INTO v_existing_property_count
        FROM "EstateProperties" ep
        INNER JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
        WHERE ep."IsDeleted" = false
        AND (
            (o."OwnerType" = 'member' AND o."MemberId" = v_member_id) OR
            (o."OwnerType" = 'company' AND o."CompanyId" IN (
                SELECT uc."CompanyId"
                FROM "UserCompanies" uc
                WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
            ))
        );

        SELECT COALESCE(p."MaxProperties", v_free_user_limit) INTO v_subscription_plan_max_properties
        FROM "Members" m
        LEFT JOIN "Subscriptions" s ON m."Id" = s."OwnerId"
            AND s."OwnerType" = 0
            AND s."Status" = 1
            AND s."IsDeleted" = false
            AND s."CancelAtPeriodEnd" = false
            AND s."CurrentPeriodEnd" > NOW()
        LEFT JOIN "Plans" p ON s."PlanId" = p."Id" AND p."IsActive" = true AND p."IsDeleted" = false
        WHERE m."Id" = v_member_id AND m."IsDeleted" = false;

        IF v_subscription_plan_max_properties IS NULL THEN
            v_subscription_plan_max_properties := v_free_user_limit;
        END IF;

        v_subscription_plan_max_properties := LEAST(v_subscription_plan_max_properties, v_hard_cap_limit);

        IF v_existing_property_count >= v_subscription_plan_max_properties THEN
            RAISE EXCEPTION 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
                v_existing_property_count, v_subscription_plan_max_properties;
        END IF;
    END;

    -- Insert main estate property record. Only physical attributes and owner live here.
    v_property_id := gen_random_uuid();

    INSERT INTO "EstateProperties" (
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
    ) VALUES (
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
        (p_garage_spaces IS NOT NULL AND p_garage_spaces > 0),
        p_garage_spaces,
        v_owner_id,
        false,
        COALESCE(p_has_laundry_room, false),
        COALESCE(p_has_pool, false),
        COALESCE(p_has_balcony, false),
        COALESCE(p_is_furnished, false),
        p_capacity,
        -- UI sends numeric 0-based indices; DB columns are enums with string labels.
        CASE COALESCE(p_location_category, 1)
            WHEN 0 THEN 'rural'::public."LocationCategory"
            WHEN 1 THEN 'city'::public."LocationCategory"
            WHEN 2 THEN 'near_shore'::public."LocationCategory"
            ELSE 'city'::public."LocationCategory"
        END,
        CASE COALESCE(p_view_type, 0)
            WHEN 0 THEN 'city'::public."ViewType"
            WHEN 1 THEN 'mountain'::public."ViewType"
            WHEN 2 THEN 'rural'::public."ViewType"
            WHEN 3 THEN 'sea'::public."ViewType"
            ELSE 'city'::public."ViewType"
        END
    );

    -- Determine which extension to create (default: RealEstate)
    v_effective_extension_type := COALESCE(p_extension_type, 'RealEstate');

    IF lower(v_effective_extension_type) = 'realestate' THEN
        INSERT INTO "RealEstateExtension" (
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
        ) VALUES (
            v_property_id,
            p_allows_financing,
            p_is_new_construction,
            p_has_mortgage,
            p_hoa_fees,
            p_min_contract_months,
            p_requires_guarantee,
            p_guarantee_type,
            p_allows_pets,
            p_property_category
        );
    ELSIF lower(v_effective_extension_type) = 'eventvenue' THEN
        INSERT INTO "EventVenueExtension" (
            "EstatePropertyId",
            "MaxGuests",
            "HasCatering",
            "HasSoundSystem",
            "ClosingHour",
            "AllowedEventsDescription",
            "Created",
            "LastModified"
        ) VALUES (
            v_property_id,
            p_max_guests,
            p_has_catering,
            p_has_sound_system,
            NULLIF(p_closing_hour, '')::time,
            p_allowed_events_description,
            now(),
            now()
        );
    ELSIF lower(v_effective_extension_type) = 'summerrent' THEN
        INSERT INTO "SummerRentExtension" (
            "EstatePropertyId",
            "MinStayDays",
            "MaxStayDays",
            "LeadTimeDays",
            "BufferDays"
        ) VALUES (
            v_property_id,
            p_min_stay_days,
            p_max_stay_days,
            p_lead_time_days,
            p_buffer_days
        );
    END IF;

    -- Insert EstatePropertyAmenity links for provided amenity IDs
    IF p_amenity_ids IS NOT NULL AND array_length(p_amenity_ids, 1) > 0 THEN
        INSERT INTO "EstatePropertyAmenity" (
            "EstatePropertyId",
            "AmenityId",
            "CreatedAtUtc",
            "DeletedAtUtc"
        )
        SELECT
            v_property_id,
            amenity_id,
            now(),
            NULL
        FROM unnest(p_amenity_ids) AS amenity_id;
    END IF;

    -- Build and return result JSON with the created estate property data
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
        'hasGarage', (p_garage_spaces IS NOT NULL AND p_garage_spaces > 0),
        'garageSpaces', p_garage_spaces,
        'hasLaundryRoom', p_has_laundry_room,
        'hasPool', p_has_pool,
        'hasBalcony', p_has_balcony,
        'isFurnished', p_is_furnished,
        'capacity', p_capacity,
        'locationCategory', p_location_category,
        'viewType', p_view_type,
        'ownerId', v_owner_id,
        'created', NOW()
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create estate property: %', SQLERRM;
END;
$$;


-- 2) Add Title column to Listings
ALTER TABLE "Listings"
ADD COLUMN "Title" text;


-- 3) RPC to insert a Listing row for an existing EstateProperty
CREATE OR REPLACE FUNCTION public.insert_listing(
    p_estate_property_id uuid,
    p_listing_type public."ListingType",
    p_title text,
    p_description text,
    p_available_from timestamp with time zone,
    p_capacity integer,
    p_currency integer,
    p_sale_price numeric,
    p_rent_price numeric,
    p_has_common_expenses boolean,
    p_common_expenses_value numeric,
    p_is_electricity_included boolean,
    p_is_water_included boolean,
    p_is_price_visible boolean,
    p_status integer,
    p_is_active boolean,
    p_is_property_visible boolean,
    p_is_featured boolean DEFAULT false,
    p_blocked_for_booking boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listing_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "Listings" (
        "Id",
        "EstatePropertyId",
        "ListingType",
        "Title",
        "Description",
        "AvailableFrom",
        "Capacity",
        "Currency",
        "SalePrice",
        "RentPrice",
        "HasCommonExpenses",
        "CommonExpensesValue",
        "IsElectricityIncluded",
        "IsWaterIncluded",
        "IsPriceVisible",
        "Status",
        "IsActive",
        "IsPropertyVisible",
        "IsFeatured",
        "BlockedForBooking",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_listing_id,
        p_estate_property_id,
        p_listing_type,
        p_title,
        p_description,
        p_available_from,
        p_capacity,
        p_currency,
        p_sale_price,
        p_rent_price,
        p_has_common_expenses,
        p_common_expenses_value,
        p_is_electricity_included,
        p_is_water_included,
        p_is_price_visible,
        p_status,
        p_is_active,
        p_is_property_visible,
        p_is_featured,
        p_blocked_for_booking,
        false,
        now(),
        NULL,
        now(),
        NULL
    );

    RETURN v_listing_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to insert listing for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;


-- 3) RPC to insert a PropertyImages row related to an EstateProperty
CREATE OR REPLACE FUNCTION public.insert_property_image(
    p_estate_property_id uuid,
    p_url text,
    p_alt_text text DEFAULT NULL,
    p_is_main boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_image_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "PropertyImages" (
        "Id",
        "Url",
        "AltText",
        "IsMain",
        "EstatePropertyId",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_image_id,
        p_url,
        p_alt_text,
        p_is_main,
        p_estate_property_id,
        false,
        now(),
        NULL,
        now(),
        NULL
    );

    RETURN v_image_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to insert property image for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;


-- 4) RPC to insert a PropertyVideos row related to an EstateProperty
CREATE OR REPLACE FUNCTION public.insert_property_video(
    p_estate_property_id uuid,
    p_url text,
    p_title text DEFAULT NULL,
    p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_video_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "PropertyVideos" (
        "Id",
        "Url",
        "Title",
        "Description",
        "EstatePropertyId",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_video_id,
        p_url,
        p_title,
        p_description,
        p_estate_property_id,
        false,
        now(),
        NULL,
        now(),
        NULL
    );

    RETURN v_video_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to insert property video for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;


-- 5) RPC to insert a PropertyDocuments row related to an EstateProperty
CREATE OR REPLACE FUNCTION public.insert_property_document(
    p_estate_property_id uuid,
    p_name text,
    p_file_type text,
    p_url text,
    p_is_public boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_document_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO "PropertyDocuments" (
        "Id",
        "Name",
        "FileType",
        "Url",
        "EstatePropertyId",
        "IsPublic",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_document_id,
        p_name,
        p_file_type,
        p_url,
        p_estate_property_id,
        p_is_public,
        false,
        now(),
        NULL,
        now(),
        NULL
    );

    RETURN v_document_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to insert property document for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;

COMMIT;

