-- Fix create_estate_property function to include missing parameters p_are_pets_allowed and p_capacity
-- This resolves the PGRST202 error when creating properties from the frontend

-- Drop overloaded versions if they exist
DROP FUNCTION IF EXISTS create_estate_property(text, text, text, text, text, text, text, double precision, double precision, text, integer, double precision, integer, integer, integer, boolean, integer, text, timestamp with time zone, boolean, integer, text, integer, double precision, double precision, boolean, double precision, boolean, boolean, boolean, integer, boolean, boolean, jsonb, jsonb, jsonb, jsonb);

-- Updated function with proper owner handling - removed arePetsAllowed and capacity as they should be set via update after creation
CREATE OR REPLACE FUNCTION create_estate_property(
    p_street_name TEXT,
    p_house_number TEXT,
    p_neighborhood TEXT,
    p_city TEXT,
    p_state TEXT,
    p_zip_code TEXT,
    p_country TEXT,
    p_location_lat DOUBLE PRECISION,
    p_location_lng DOUBLE PRECISION,
    p_title TEXT,
    p_property_type INTEGER,
    p_area_value DOUBLE PRECISION,
    p_area_unit INTEGER,
    p_bedrooms INTEGER,
    p_bathrooms INTEGER,
    p_has_garage BOOLEAN,
    p_garage_spaces INTEGER,
    p_description TEXT,
    p_available_from TIMESTAMP WITH TIME ZONE,
    p_currency INTEGER DEFAULT 0,
    p_sale_price DOUBLE PRECISION DEFAULT NULL,
    p_rent_price DOUBLE PRECISION DEFAULT NULL,
    p_has_common_expenses BOOLEAN DEFAULT false,
    p_common_expenses_value DOUBLE PRECISION DEFAULT NULL,
    p_is_electricity_included BOOLEAN DEFAULT false,
    p_is_water_included BOOLEAN DEFAULT false,
    p_is_price_visible BOOLEAN DEFAULT true,
    p_status INTEGER DEFAULT 0,
    p_is_active BOOLEAN DEFAULT true,
    p_is_property_visible BOOLEAN DEFAULT true,
    p_property_images JSONB DEFAULT NULL,
    p_property_documents JSONB DEFAULT NULL,
    p_property_videos JSONB DEFAULT NULL,
    p_amenity_ids JSONB DEFAULT NULL,
    p_owner_member_id UUID DEFAULT NULL,
    p_owner_company_id UUID DEFAULT NULL,
    p_owner_user_id UUID DEFAULT NULL -- DEPRECATED: Use p_owner_member_id or p_owner_company_id
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_id UUID;
    v_owner_id UUID;
    v_member_id UUID;
    v_company_id UUID;
    v_main_image_id UUID;
    v_image_record JSONB;
    v_document_record JSONB;
    v_video_record JSONB;
    v_amenity_id UUID;
    v_result JSONB;
    -- Quota validation variables
    v_existing_property_count INTEGER;
    v_subscription_plan_max_properties INTEGER;
    v_hard_cap_limit INTEGER := 10;
    v_free_user_limit INTEGER := 2;
BEGIN
    -- Start transaction
    BEGIN
        -- Handle backward compatibility for deprecated p_owner_user_id parameter
        IF p_owner_user_id IS NOT NULL THEN
            -- DEPRECATED: Always treat as user_id and find corresponding member
            SELECT "Id" INTO v_member_id
            FROM "Members"
            WHERE "UserId" = p_owner_user_id AND "IsDeleted" = false;

            -- Validate that member exists
            IF v_member_id IS NULL THEN
                RAISE EXCEPTION 'No member record found for user ID: %. Please ensure you are properly registered.', p_owner_user_id;
            END IF;
        ELSE
            v_member_id := p_owner_member_id;
            v_company_id := p_owner_company_id;
        END IF;

        -- Validate that exactly one owner type is specified
        IF (v_member_id IS NOT NULL AND v_company_id IS NOT NULL) OR
           (v_member_id IS NULL AND v_company_id IS NULL) THEN
            RAISE EXCEPTION 'Must specify exactly one owner: either p_owner_member_id or p_owner_company_id (or deprecated p_owner_user_id)';
        END IF;

        -- Get or create owner record using helper function (if available)
        BEGIN
            v_owner_id := get_or_create_owner(v_member_id, v_company_id, NULL);
        EXCEPTION WHEN undefined_function THEN
            -- Fallback for older schema without Owners table
            v_owner_id := COALESCE(v_member_id, v_company_id);
        END;

        -- Validate property quota limits before creating property
        BEGIN
            -- Count existing active properties owned by this member (or their companies)
            SELECT COUNT(*) INTO v_existing_property_count
            FROM "EstateProperties" ep
            INNER JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
            WHERE ep."IsDeleted" = false
            AND (
                (o."OwnerType" = 0 AND o."MemberId" = v_member_id) OR  -- Direct member ownership
                (o."OwnerType" = 1 AND o."MemberId" = v_member_id AND o."CompanyId" IN (
                    -- Get all company IDs where this member is active
                    SELECT uc."CompanyId"
                    FROM "UserCompanies" uc
                    WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
                ))
            );

            -- Get subscription plan limits for this member
            SELECT COALESCE(p."MaxProperties", v_free_user_limit) INTO v_subscription_plan_max_properties
            FROM "Members" m
            LEFT JOIN "Subscriptions" s ON m."Id" = s."OwnerId"
                AND s."OwnerType" = 0  -- Member subscription
                AND s."Status" = 1     -- Active subscription
                AND s."IsDeleted" = false
                AND s."CancelAtPeriodEnd" = false
                AND s."CurrentPeriodEnd" > NOW()
            LEFT JOIN "Plans" p ON s."PlanId" = p."Id" AND p."IsActive" = true AND p."IsDeleted" = false
            WHERE m."Id" = v_member_id AND m."IsDeleted" = false;

            -- Apply limits: use subscription limit if available, otherwise free user limit, but never exceed hard cap
            IF v_subscription_plan_max_properties IS NULL THEN
                v_subscription_plan_max_properties := v_free_user_limit;
            END IF;

            -- Apply hard cap of 10 properties for everyone
            v_subscription_plan_max_properties := LEAST(v_subscription_plan_max_properties, v_hard_cap_limit);

            -- Check if user has exceeded their limit
            IF v_existing_property_count >= v_subscription_plan_max_properties THEN
                RAISE EXCEPTION 'Property limit exceeded. You have % properties but your plan allows maximum %. Please upgrade your subscription or delete existing properties to create new ones.',
                    v_existing_property_count, v_subscription_plan_max_properties;
            END IF;
        END;

        -- Generate new property ID
        v_property_id := gen_random_uuid();

        -- Insert main estate property record
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
            "Title",
            "Type",
            "AreaValue",
            "AreaUnit",
            "Bedrooms",
            "Bathrooms",
            "HasGarage",
            "GarageSpaces",
            "ArePetsAllowed",
            "Capacity",
            "OwnerId",
            "Created",
            "LastModified"
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
            p_title,
            p_property_type,
            p_area_value,
            p_area_unit,
            p_bedrooms,
            p_bathrooms,
            p_has_garage,
            p_garage_spaces,
            false, -- Default: pets not allowed
            1,     -- Default: capacity of 1
            v_owner_id,
            NOW(),
            NOW()
        );

        -- Insert property images
        IF p_property_images IS NOT NULL AND jsonb_array_length(p_property_images) > 0 THEN
            FOR v_image_record IN SELECT * FROM jsonb_array_elements(p_property_images)
            LOOP
                INSERT INTO "PropertyImages" (
                    "Id",
                    "EstatePropertyId",
                    "Url",
                    "AltText",
                    "IsMain",
                    "IsPublic",
                    "FileName",
                    "Created",
                    "LastModified"
                ) VALUES (
                    COALESCE((v_image_record->>'id')::UUID, gen_random_uuid()),
                    v_property_id,
                    v_image_record->>'url',
                    COALESCE(v_image_record->>'altText', ''),
                    COALESCE((v_image_record->>'isMain')::BOOLEAN, false),
                    COALESCE((v_image_record->>'isPublic')::BOOLEAN, true),
                    COALESCE(v_image_record->>'fileName', ''),
                    NOW(),
                    NOW()
                );

                -- Track main image ID
                IF (v_image_record->>'isMain')::BOOLEAN = true THEN
                    v_main_image_id := COALESCE((v_image_record->>'id')::UUID, gen_random_uuid());
                END IF;
            END LOOP;

            -- Update main image ID on property
            IF v_main_image_id IS NOT NULL THEN
                UPDATE "EstateProperties"
                SET "MainImageId" = v_main_image_id
                WHERE "Id" = v_property_id;
            END IF;
        END IF;

        -- Insert property documents
        IF p_property_documents IS NOT NULL AND jsonb_array_length(p_property_documents) > 0 THEN
            FOR v_document_record IN SELECT * FROM jsonb_array_elements(p_property_documents)
            LOOP
                INSERT INTO "PropertyDocuments" (
                    "Id",
                    "EstatePropertyId",
                    "Url",
                    "Name",
                    "FileName",
                    "IsPublic",
                    "Created",
                    "LastModified"
                ) VALUES (
                    COALESCE((v_document_record->>'id')::UUID, gen_random_uuid()),
                    v_property_id,
                    v_document_record->>'url',
                    COALESCE(v_document_record->>'name', ''),
                    COALESCE(v_document_record->>'fileName', ''),
                    COALESCE((v_document_record->>'isPublic')::BOOLEAN, true),
                    NOW(),
                    NOW()
                );
            END LOOP;
        END IF;

        -- Insert property videos
        IF p_property_videos IS NOT NULL AND jsonb_array_length(p_property_videos) > 0 THEN
            FOR v_video_record IN SELECT * FROM jsonb_array_elements(p_property_videos)
            LOOP
                INSERT INTO "PropertyVideos" (
                    "Id",
                    "EstatePropertyId",
                    "Url",
                    "Title",
                    "Description",
                    "IsPublic",
                    "Created",
                    "LastModified"
                ) VALUES (
                    COALESCE((v_video_record->>'id')::UUID, gen_random_uuid()),
                    v_property_id,
                    v_video_record->>'url',
                    COALESCE(v_video_record->>'title', ''),
                    COALESCE(v_video_record->>'description', ''),
                    COALESCE((v_video_record->>'isPublic')::BOOLEAN, true),
                    NOW(),
                    NOW()
                );
            END LOOP;
        END IF;

        -- Link amenities
        IF p_amenity_ids IS NOT NULL AND jsonb_array_length(p_amenity_ids) > 0 THEN
            FOR v_amenity_id IN SELECT value::UUID FROM jsonb_array_elements_text(p_amenity_ids)
            LOOP
                INSERT INTO "EstatePropertyAmenities" (
                    "EstatePropertyId",
                    "AmenityId",
                    "Created",
                    "LastModified"
                ) VALUES (
                    v_property_id,
                    v_amenity_id,
                    NOW(),
                    NOW()
                );
            END LOOP;
        END IF;

        -- Insert initial property values (featured = true)
        INSERT INTO "EstatePropertyValues" (
            "Id",
            "EstatePropertyId",
            "Description",
            "AvailableFrom",
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
            "Created",
            "LastModified",
            "IsDeleted"
        ) VALUES (
            gen_random_uuid(),
            v_property_id,
            p_description,
            p_available_from,
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
            true, -- Always featured for initial creation
            NOW(),
            NOW(),
            false
        );

        -- Build result
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
            'title', p_title,
            'type', CASE p_property_type
                WHEN 0 THEN 'house'
                WHEN 1 THEN 'apartment'
                WHEN 2 THEN 'commercial'
                WHEN 3 THEN 'land'
                ELSE 'other'
            END,
            'areaValue', p_area_value,
            'areaUnit', CASE p_area_unit
                WHEN 0 THEN 'm²'
                WHEN 1 THEN 'ft²'
                WHEN 2 THEN 'yd²'
                WHEN 3 THEN 'acres'
                WHEN 4 THEN 'hectares'
                WHEN 5 THEN 'sq_km'
                WHEN 6 THEN 'sq_mi'
            END,
            'bedrooms', p_bedrooms,
            'bathrooms', p_bathrooms,
            'hasGarage', p_has_garage,
            'garageSpaces', p_garage_spaces,
            'arePetsAllowed', false,  -- Default value
            'capacity', 1,            -- Default value
            'description', p_description,
            'availableFrom', p_available_from,
            'currency', CASE p_currency
                WHEN 0 THEN 'USD'
                WHEN 1 THEN 'UYU'
                WHEN 2 THEN 'BRL'
                WHEN 3 THEN 'EUR'
                WHEN 4 THEN 'GBP'
            END,
            'salePrice', p_sale_price,
            'rentPrice', p_rent_price,
            'hasCommonExpenses', p_has_common_expenses,
            'commonExpensesValue', p_common_expenses_value,
            'isElectricityIncluded', p_is_electricity_included,
            'isWaterIncluded', p_is_water_included,
            'isPriceVisible', p_is_price_visible,
            'status', CASE p_status
                WHEN 0 THEN 'sale'
                WHEN 1 THEN 'rent'
                WHEN 2 THEN 'sold'
                WHEN 3 THEN 'reserved'
                WHEN 4 THEN 'unavailable'
            END,
            'isActive', p_is_active,
            'isPropertyVisible', p_is_property_visible,
            'ownerId', v_owner_id,
            'created', NOW()
        );

        RETURN v_result;

    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback will happen automatically
            RAISE EXCEPTION 'Failed to create estate property: %', SQLERRM;
    END;
END;
$$;
