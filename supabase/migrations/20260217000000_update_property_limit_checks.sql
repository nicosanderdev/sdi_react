-- ============================================================================
-- MIGRATION: Update Property Limit Checks
-- ============================================================================
-- This migration updates create_estate_property and update_estate_property
-- functions to check both total properties limit (MaxProperties) and 
-- published properties limit (MaxPublishedProperties) from subscription plans.
-- ============================================================================

-- Update create_estate_property function to check both total and published limits
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
    v_existing_published_count INTEGER;
    v_subscription_plan_max_properties INTEGER;
    v_subscription_plan_max_published_properties INTEGER;
    v_free_user_total_limit INTEGER := 7; -- Inicial plan total limit
    v_free_user_published_limit INTEGER := 5; -- Inicial plan published limit
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
                (o."OwnerType" = 'member' AND o."MemberId" = v_member_id) OR  -- Direct member ownership
                (o."OwnerType" = 'company' AND o."CompanyId" IN (
                    -- Get all company IDs where this member is active
                    SELECT uc."CompanyId"
                    FROM "UserCompanies" uc
                    WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
                ))
            );

            -- Count existing published properties owned by this member (or their companies)
            SELECT COUNT(*) INTO v_existing_published_count
            FROM "EstateProperties" ep
            INNER JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
            INNER JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
            WHERE ep."IsDeleted" = false
            AND epv."IsPropertyVisible" = true
            AND epv."IsActive" = true
            AND (
                (o."OwnerType" = 'member' AND o."MemberId" = v_member_id) OR  -- Direct member ownership
                (o."OwnerType" = 'company' AND o."CompanyId" IN (
                    -- Get all company IDs where this member is active
                    SELECT uc."CompanyId"
                    FROM "UserCompanies" uc
                    WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
                ))
            );

            -- Get subscription plan limits for this member
            SELECT 
                COALESCE(p."MaxProperties", v_free_user_total_limit),
                COALESCE(p."MaxPublishedProperties", v_free_user_published_limit)
            INTO 
                v_subscription_plan_max_properties,
                v_subscription_plan_max_published_properties
            FROM "Members" m
            LEFT JOIN "Subscriptions" s ON m."Id" = s."OwnerId"
                AND s."OwnerType" = 0  -- Member subscription
                AND s."Status" = 1     -- Active subscription
                AND s."IsDeleted" = false
                AND s."CancelAtPeriodEnd" = false
                AND s."CurrentPeriodEnd" > NOW()
            LEFT JOIN "Plans" p ON s."PlanId" = p."Id" AND p."IsActive" = true AND p."IsDeleted" = false
            WHERE m."Id" = v_member_id AND m."IsDeleted" = false;

            -- Apply limits: use subscription limit if available, otherwise free user limit
            IF v_subscription_plan_max_properties IS NULL THEN
                v_subscription_plan_max_properties := v_free_user_total_limit;
            END IF;

            IF v_subscription_plan_max_published_properties IS NULL THEN
                v_subscription_plan_max_published_properties := v_free_user_published_limit;
            END IF;

            -- Check if user has exceeded total properties limit
            IF v_existing_property_count >= v_subscription_plan_max_properties THEN
                RAISE EXCEPTION 'Your plan limits have reached. You cannot create more than % properties.',
                    v_subscription_plan_max_properties;
            END IF;

            -- Check if user is trying to publish and has exceeded published properties limit
            IF p_is_property_visible = true AND v_existing_published_count >= v_subscription_plan_max_published_properties THEN
                RAISE EXCEPTION 'Your plan limits have reached. You cannot publish more than % properties.',
                    v_subscription_plan_max_published_properties;
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
            "OwnerId",
            "IsDeleted",
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
            v_owner_id,
            false,
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
            "Created",
            "LastModified",
            "IsDeleted"
        ) VALUES (
            gen_random_uuid(),
            v_property_id,
            p_description,
            p_available_from,
            COALESCE(p_bedrooms, 1), -- Default capacity based on bedrooms, minimum 1
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

-- Update update_estate_property function to check published limit when publishing
CREATE OR REPLACE FUNCTION update_estate_property(
    p_property_id TEXT,
    p_user_id TEXT,
    p_street_name TEXT DEFAULT NULL,
    p_house_number TEXT DEFAULT NULL,
    p_neighborhood TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip_code TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL,
    p_location_lat DOUBLE PRECISION DEFAULT NULL,
    p_location_lng DOUBLE PRECISION DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_property_type INTEGER DEFAULT NULL,
    p_area_value DOUBLE PRECISION DEFAULT NULL,
    p_area_unit INTEGER DEFAULT NULL,
    p_bedrooms INTEGER DEFAULT NULL,
    p_bathrooms INTEGER DEFAULT NULL,
    p_has_garage BOOLEAN DEFAULT NULL,
    p_garage_spaces INTEGER DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_available_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_currency INTEGER DEFAULT NULL,
    p_sale_price DOUBLE PRECISION DEFAULT NULL,
    p_rent_price DOUBLE PRECISION DEFAULT NULL,
    p_has_common_expenses BOOLEAN DEFAULT NULL,
    p_common_expenses_value DOUBLE PRECISION DEFAULT NULL,
    p_is_electricity_included BOOLEAN DEFAULT NULL,
    p_is_water_included BOOLEAN DEFAULT NULL,
    p_is_price_visible BOOLEAN DEFAULT NULL,
    p_status INTEGER DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_is_property_visible BOOLEAN DEFAULT NULL,
    p_property_images JSONB DEFAULT NULL,
    p_property_documents JSONB DEFAULT NULL,
    p_property_videos JSONB DEFAULT NULL,
    p_amenity_ids JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id TEXT;
    v_main_image_id UUID;
    v_current_values RECORD;
    v_image_record JSONB;
    v_document_record JSONB;
    v_video_record JSONB;
    v_amenity_id TEXT;
    v_result JSONB;
    -- Quota validation variables
    v_existing_published_count INTEGER;
    v_subscription_plan_max_published_properties INTEGER;
    v_free_user_published_limit INTEGER := 5; -- Inicial plan published limit
    v_current_is_property_visible BOOLEAN;
BEGIN
    -- Start transaction
    BEGIN
        -- Validate property exists
        IF NOT EXISTS (
            SELECT 1 FROM "EstateProperties"
            WHERE "Id" = p_property_id::UUID AND "IsDeleted" = false
        ) THEN
            RAISE EXCEPTION 'Property not found or already deleted';
        END IF;

        -- Validate user owns the property (using Owners table)
        IF NOT is_property_owner(p_user_id, p_property_id::UUID) THEN
            RAISE EXCEPTION 'User does not own this property';
        END IF;

        -- Get current property visibility status
        SELECT epv."IsPropertyVisible" INTO v_current_is_property_visible
        FROM "EstatePropertyValues" epv
        WHERE epv."EstatePropertyId" = p_property_id::UUID
        AND epv."IsDeleted" = false
        ORDER BY epv."Created" DESC
        LIMIT 1;

        -- Check published limit if trying to publish (changing from false to true)
        IF p_is_property_visible = true AND (v_current_is_property_visible IS NULL OR v_current_is_property_visible = false) THEN
            -- Get member ID from user ID
            SELECT "Id" INTO v_member_id
            FROM "Members"
            WHERE "UserId" = p_user_id AND "IsDeleted" = false;

            IF v_member_id IS NOT NULL THEN
                -- Count existing published properties owned by this member (or their companies)
                SELECT COUNT(*) INTO v_existing_published_count
                FROM "EstateProperties" ep
                INNER JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
                INNER JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
                WHERE ep."Id" != p_property_id::UUID -- Exclude current property
                AND ep."IsDeleted" = false
                AND epv."IsPropertyVisible" = true
                AND epv."IsActive" = true
                AND (
                    (o."OwnerType" = 'member' AND o."MemberId" = v_member_id) OR  -- Direct member ownership
                    (o."OwnerType" = 'company' AND o."CompanyId" IN (
                        -- Get all company IDs where this member is active
                        SELECT uc."CompanyId"
                        FROM "UserCompanies" uc
                        WHERE uc."MemberId" = v_member_id AND uc."IsDeleted" = false
                    ))
                );

                -- Get subscription plan published limit for this member
                SELECT COALESCE(p."MaxPublishedProperties", v_free_user_published_limit)
                INTO v_subscription_plan_max_published_properties
                FROM "Members" m
                LEFT JOIN "Subscriptions" s ON m."Id" = s."OwnerId"
                    AND s."OwnerType" = 0  -- Member subscription
                    AND s."Status" = 1     -- Active subscription
                    AND s."IsDeleted" = false
                    AND s."CancelAtPeriodEnd" = false
                    AND s."CurrentPeriodEnd" > NOW()
                LEFT JOIN "Plans" p ON s."PlanId" = p."Id" AND p."IsActive" = true AND p."IsDeleted" = false
                WHERE m."Id" = v_member_id AND m."IsDeleted" = false;

                -- Apply limit: use subscription limit if available, otherwise free user limit
                IF v_subscription_plan_max_published_properties IS NULL THEN
                    v_subscription_plan_max_published_properties := v_free_user_published_limit;
                END IF;

                -- Check if user has exceeded published properties limit
                IF v_existing_published_count >= v_subscription_plan_max_published_properties THEN
                    RAISE EXCEPTION 'Your plan limits have reached. You cannot publish more than % properties.',
                        v_subscription_plan_max_published_properties;
                END IF;
            END IF;
        END IF;

        -- Update main estate property record (only provided fields)
        UPDATE "EstateProperties"
        SET
            "StreetName" = COALESCE(p_street_name, "StreetName"),
            "HouseNumber" = COALESCE(p_house_number, "HouseNumber"),
            "Neighborhood" = COALESCE(p_neighborhood, "Neighborhood"),
            "City" = COALESCE(p_city, "City"),
            "State" = COALESCE(p_state, "State"),
            "ZipCode" = COALESCE(p_zip_code, "ZipCode"),
            "Country" = COALESCE(p_country, "Country"),
            "LocationLatitude" = COALESCE(p_location_lat, "LocationLatitude"),
            "LocationLongitude" = COALESCE(p_location_lng, "LocationLongitude"),
            "Title" = COALESCE(p_title, "Title"),
            "PropertyType" = COALESCE(p_property_type, "PropertyType"),
            "AreaValue" = COALESCE(p_area_value, "AreaValue"),
            "AreaUnit" = COALESCE(p_area_unit, "AreaUnit"),
            "Bedrooms" = COALESCE(p_bedrooms, "Bedrooms"),
            "Bathrooms" = COALESCE(p_bathrooms, "Bathrooms"),
            "HasGarage" = COALESCE(p_has_garage, "HasGarage"),
            "GarageSpaces" = COALESCE(p_garage_spaces, "GarageSpaces"),
            "LastModified" = NOW(),
            "LastModifiedBy" = p_user_id
        WHERE "Id" = p_property_id::UUID;

        -- Handle property images if provided
        IF p_property_images IS NOT NULL THEN
            -- Delete existing images
            DELETE FROM "PropertyImages" WHERE "EstatePropertyId" = p_property_id::UUID;

            -- Insert new images
            IF jsonb_array_length(p_property_images) > 0 THEN
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
                        p_property_id::UUID,
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
                    WHERE "Id" = p_property_id::UUID;
                END IF;
            END IF;
        END IF;

        -- Handle property documents if provided
        IF p_property_documents IS NOT NULL THEN
            -- Delete existing documents
            DELETE FROM "PropertyDocuments" WHERE "EstatePropertyId" = p_property_id::UUID;

            -- Insert new documents
            IF jsonb_array_length(p_property_documents) > 0 THEN
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
                        p_property_id::UUID,
                        v_document_record->>'url',
                        COALESCE(v_document_record->>'name', ''),
                        COALESCE(v_document_record->>'fileName', ''),
                        COALESCE((v_document_record->>'isPublic')::BOOLEAN, true),
                        NOW(),
                        NOW()
                    );
                END LOOP;
            END IF;
        END IF;

        -- Handle property videos if provided
        IF p_property_videos IS NOT NULL THEN
            -- Delete existing videos
            DELETE FROM "PropertyVideos" WHERE "EstatePropertyId" = p_property_id::UUID;

            -- Insert new videos
            IF jsonb_array_length(p_property_videos) > 0 THEN
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
                        p_property_id::UUID,
                        v_video_record->>'url',
                        COALESCE(v_video_record->>'title', ''),
                        COALESCE(v_video_record->>'description', ''),
                        COALESCE((v_video_record->>'isPublic')::BOOLEAN, true),
                        NOW(),
                        NOW()
                    );
                END LOOP;
            END IF;
        END IF;

        -- Handle amenities if provided
        IF p_amenity_ids IS NOT NULL THEN
            -- Delete existing amenity links
            DELETE FROM "EstatePropertyAmenities" WHERE "EstatePropertyId" = p_property_id::UUID;

            -- Insert new amenity links
            IF jsonb_array_length(p_amenity_ids) > 0 THEN
                FOR v_amenity_id IN SELECT * FROM jsonb_array_elements_text(p_amenity_ids)
                LOOP
                    INSERT INTO "EstatePropertyAmenities" (
                        "EstatePropertyId",
                        "AmenityId",
                        "Created",
                        "LastModified"
                    ) VALUES (
                        p_property_id::UUID,
                        v_amenity_id::UUID,
                        NOW(),
                        NOW()
                    );
                END LOOP;
            END IF;
        END IF;

        -- Handle property values - update or insert latest values
        IF p_description IS NOT NULL OR p_available_from IS NOT NULL OR p_currency IS NOT NULL OR
           p_sale_price IS NOT NULL OR p_rent_price IS NOT NULL OR p_has_common_expenses IS NOT NULL OR
           p_common_expenses_value IS NOT NULL OR p_is_electricity_included IS NOT NULL OR
           p_is_water_included IS NOT NULL OR p_is_price_visible IS NOT NULL OR
           p_status IS NOT NULL OR p_is_active IS NOT NULL OR p_is_property_visible IS NOT NULL THEN

            -- Get current latest values
            SELECT * INTO v_current_values
            FROM "EstatePropertyValues"
            WHERE "EstatePropertyId" = p_property_id::UUID
            ORDER BY "Created" DESC
            LIMIT 1;

            -- Insert new values record (version history)
            INSERT INTO "EstatePropertyValues" (
                "Id",
                "EstatePropertyId",
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
                "Created",
                "LastModified"
            ) VALUES (
                gen_random_uuid(),
                p_property_id::UUID,
                COALESCE(p_description, v_current_values.Description),
                COALESCE(p_available_from, v_current_values.AvailableFrom),
                COALESCE(v_current_values.Capacity, 1),
                COALESCE(p_currency, v_current_values.Currency),
                COALESCE(p_sale_price, v_current_values.SalePrice),
                COALESCE(p_rent_price, v_current_values.RentPrice),
                COALESCE(p_has_common_expenses, v_current_values.HasCommonExpenses),
                COALESCE(p_common_expenses_value, v_current_values.CommonExpensesValue),
                COALESCE(p_is_electricity_included, v_current_values.IsElectricityIncluded),
                COALESCE(p_is_water_included, v_current_values.IsWaterIncluded),
                COALESCE(p_is_price_visible, v_current_values.IsPriceVisible),
                COALESCE(p_status, v_current_values.Status),
                COALESCE(p_is_active, v_current_values.IsActive),
                COALESCE(p_is_property_visible, v_current_values.IsPropertyVisible),
                COALESCE(v_current_values.IsFeatured, true), -- Keep existing featured status
                NOW(),
                NOW()
            );
        END IF;

        -- Build result with updated property data
        SELECT jsonb_build_object(
            'id', ep."Id",
            'streetName', ep."StreetName",
            'houseNumber', ep."HouseNumber",
            'neighborhood', ep."Neighborhood",
            'city', ep."City",
            'state', ep."State",
            'zipCode', ep."ZipCode",
            'country', ep."Country",
            'location', jsonb_build_object('lat', ep."LocationLatitude", 'lng', ep."LocationLongitude"),
            'title', ep."Title",
            'type', CASE ep."PropertyType"
                WHEN 0 THEN 'house'
                WHEN 1 THEN 'apartment'
                WHEN 2 THEN 'commercial'
                WHEN 3 THEN 'land'
                ELSE 'other'
            END,
            'areaValue', ep."AreaValue",
            'areaUnit', CASE ep."AreaUnit"
                WHEN 0 THEN 'm²'
                WHEN 1 THEN 'ft²'
                WHEN 2 THEN 'yd²'
                WHEN 3 THEN 'acres'
                WHEN 4 THEN 'hectares'
                WHEN 5 THEN 'sq_km'
                WHEN 6 THEN 'sq_mi'
            END,
            'bedrooms', ep."Bedrooms",
            'bathrooms', ep."Bathrooms",
            'hasGarage', ep."HasGarage",
            'garageSpaces', ep."GarageSpaces",
            'ownerId', ep."OwnerId",
            'created', ep."Created"
        ) INTO v_result
        FROM "EstateProperties" ep
        WHERE ep."Id" = p_property_id::UUID;

        RETURN v_result;

    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback will happen automatically
            RAISE EXCEPTION 'Failed to update estate property: %', SQLERRM;
    END;
END;
$$;
