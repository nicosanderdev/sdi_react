-- Migration: Remove arePetsAllowed and move capacity to EstatePropertyValues
-- Date: 2025-12-22
-- Description: Removes arePetsAllowed completely and migrates capacity from EstateProperties to EstatePropertyValues

-- Step 1: Migrate existing capacity data to EstatePropertyValues (data preservation)
-- Only migrate if Capacity column exists on EstateProperties (defensive check)
DO $$
BEGIN
    -- Check if Capacity column exists on EstateProperties
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'Capacity'
    ) THEN
        -- Ensure all EstatePropertyValues have capacity populated from the main property if not already set
        UPDATE "EstatePropertyValues" epv
        SET "Capacity" = ep."Capacity"
        FROM "EstateProperties" ep
        WHERE epv."EstatePropertyId" = ep."Id"
          AND (epv."Capacity" IS NULL OR epv."Capacity" = 0)
          AND ep."Capacity" > 0;
    ELSE
        -- Capacity column doesn't exist on EstateProperties, skip migration
        RAISE NOTICE 'Capacity column does not exist on EstateProperties table, skipping data migration';
    END IF;
END $$;

-- Step 2: Drop the columns from EstateProperties
ALTER TABLE "EstateProperties" DROP COLUMN IF EXISTS "ArePetsAllowed";
ALTER TABLE "EstateProperties" DROP COLUMN IF EXISTS "Capacity";

-- Step 3: Update create_estate_property function to remove the fields
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
    p_property_amenities JSONB DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
) RETURNS JSONB
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_property_id UUID;
    v_member_id UUID;
    v_company_id UUID;
    v_owner_id UUID;
    v_values_id UUID;
    v_result JSONB;
    v_image_record JSONB;
    v_document_record JSONB;
    v_video_record JSONB;
    v_amenity_record JSONB;
BEGIN
    -- Get user information
    SELECT id, company_id INTO v_member_id, v_company_id
    FROM members
    WHERE id::text = p_user_id;

    -- Get or create owner record
    BEGIN
        v_owner_id := get_or_create_owner(v_member_id, v_company_id, NULL);
    EXCEPTION WHEN undefined_function THEN
        -- Fallback for older schema without Owners table
        v_owner_id := COALESCE(v_member_id, v_company_id);
    END;

    -- Generate new property ID
    v_property_id := gen_random_uuid();

    -- Insert main estate property record (without ArePetsAllowed and Capacity)
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
        "MainImageId",
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
        NULL,
        NOW(),
        NOW()
    );

    -- Insert property values record (including capacity)
    v_values_id := gen_random_uuid();
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
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        v_values_id,
        v_property_id,
        p_description,
        p_available_from,
        1, -- Default capacity
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
        false,
        NOW(),
        p_user_id,
        NOW(),
        p_user_id
    );

    -- Handle property images
    IF p_property_images IS NOT NULL AND jsonb_array_length(p_property_images) > 0 THEN
        FOR v_image_record IN SELECT value FROM jsonb_array_elements(p_property_images)
        LOOP
            INSERT INTO "PropertyImages" (
                "Id",
                "EstatePropertyId",
                "Url",
                "IsMain",
                "Order",
                "CreatedAtUtc"
            ) VALUES (
                gen_random_uuid(),
                v_property_id,
                v_image_record->>'url',
                CASE WHEN (v_image_record->>'isMain')::boolean THEN true ELSE false END,
                COALESCE((v_image_record->>'order')::integer, 0),
                NOW()
            );
        END LOOP;
    END IF;

    -- Handle property documents
    IF p_property_documents IS NOT NULL AND jsonb_array_length(p_property_documents) > 0 THEN
        FOR v_document_record IN SELECT value FROM jsonb_array_elements(p_property_documents)
        LOOP
            INSERT INTO "PropertyDocuments" (
                "Id",
                "EstatePropertyId",
                "Title",
                "Url",
                "CreatedAtUtc"
            ) VALUES (
                gen_random_uuid(),
                v_property_id,
                v_document_record->>'title',
                v_document_record->>'url',
                NOW()
            );
        END LOOP;
    END IF;

    -- Handle property videos
    IF p_property_videos IS NOT NULL AND jsonb_array_length(p_property_videos) > 0 THEN
        FOR v_video_record IN SELECT value FROM jsonb_array_elements(p_property_videos)
        LOOP
            INSERT INTO "PropertyVideos" (
                "Id",
                "EstatePropertyId",
                "Url",
                "Title",
                "ThumbnailUrl",
                "CreatedAtUtc"
            ) VALUES (
                gen_random_uuid(),
                v_property_id,
                v_video_record->>'url',
                v_video_record->>'title',
                v_video_record->>'thumbnailUrl',
                NOW()
            );
        END LOOP;
    END IF;

    -- Handle property amenities
    IF p_property_amenities IS NOT NULL AND jsonb_array_length(p_property_amenities) > 0 THEN
        FOR v_amenity_record IN SELECT value FROM jsonb_array_elements(p_property_amenities)
        LOOP
            INSERT INTO "EstatePropertyAmenity" (
                "EstatePropertyId",
                "AmenityId",
                "CreatedAtUtc"
            ) VALUES (
                v_property_id,
                (v_amenity_record->>'id')::uuid,
                NOW()
            );
        END LOOP;
    END IF;

    -- Build result JSON (without arePetsAllowed and capacity in main property)
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
        'type', ep."Type",
        'areaValue', ep."AreaValue",
        'areaUnit', ep."AreaUnit",
        'bedrooms', ep."Bedrooms",
        'bathrooms', ep."Bathrooms",
        'hasGarage', ep."HasGarage",
        'garageSpaces', ep."GarageSpaces",
        'description', epv."Description",
        'availableFrom', epv."AvailableFrom",
        'currency', CASE epv."Currency"
            WHEN 0 THEN 'USD'
            WHEN 1 THEN 'UYU'
            WHEN 2 THEN 'BRL'
            WHEN 3 THEN 'EUR'
            WHEN 4 THEN 'GBP'
            ELSE 'USD'
        END,
        'salePrice', epv."SalePrice",
        'rentPrice', epv."RentPrice",
        'hasCommonExpenses', epv."HasCommonExpenses",
        'commonExpensesValue', epv."CommonExpensesValue",
        'isElectricityIncluded', epv."IsElectricityIncluded",
        'isWaterIncluded', epv."IsWaterIncluded",
        'isPriceVisible', epv."IsPriceVisible",
        'status', epv."Status",
        'isActive', epv."IsActive",
        'isPropertyVisible', epv."IsPropertyVisible",
        'ownerId', ep."OwnerId",
        'created', ep."Created",
        'capacity', epv."Capacity",
        'estatePropertyValues', jsonb_build_array(
            jsonb_build_object(
                'id', epv."Id",
                'description', epv."Description",
                'availableFrom', epv."AvailableFrom",
                'capacity', epv."Capacity",
                'currency', epv."Currency",
                'salePrice', epv."SalePrice",
                'rentPrice', epv."RentPrice",
                'hasCommonExpenses', epv."HasCommonExpenses",
                'commonExpensesValue', epv."CommonExpensesValue",
                'isElectricityIncluded', epv."IsElectricityIncluded",
                'isWaterIncluded', epv."IsWaterIncluded",
                'isPriceVisible', epv."IsPriceVisible",
                'status', epv."Status",
                'isActive', epv."IsActive",
                'isPropertyVisible', epv."IsPropertyVisible",
                'isFeatured', epv."IsFeatured",
                'createdAt', epv."Created",
                'createdBy', epv."CreatedBy",
                'lastModified', epv."LastModified",
                'lastModifiedBy', epv."LastModifiedBy"
            )
        )
    ) INTO v_result
    FROM "EstateProperties" ep
    JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId"
    WHERE ep."Id" = v_property_id
      AND epv."IsDeleted" = false
    ORDER BY epv."Created" DESC
    LIMIT 1;

    RETURN v_result;
END;
$$;

-- Step 4: Update update_estate_property function to remove the fields
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
    p_property_amenities JSONB DEFAULT NULL
) RETURNS JSONB
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
    v_image_record JSONB;
    v_document_record JSONB;
    v_video_record JSONB;
    v_amenity_record JSONB;
BEGIN
    -- Update main property record (without ArePetsAllowed and Capacity)
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
        "Type" = COALESCE(p_property_type, "Type"),
        "AreaValue" = COALESCE(p_area_value, "AreaValue"),
        "AreaUnit" = COALESCE(p_area_unit, "AreaUnit"),
        "Bedrooms" = COALESCE(p_bedrooms, "Bedrooms"),
        "Bathrooms" = COALESCE(p_bathrooms, "Bathrooms"),
        "HasGarage" = COALESCE(p_has_garage, "HasGarage"),
        "GarageSpaces" = COALESCE(p_garage_spaces, "GarageSpaces"),
        "LastModified" = NOW(),
        "LastModifiedBy" = p_user_id
    WHERE "Id" = p_property_id::UUID;

    -- Update or create property values record
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
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    ) VALUES (
        gen_random_uuid(),
        p_property_id::UUID,
        COALESCE(p_description, (SELECT "Description" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        COALESCE(p_available_from, (SELECT "AvailableFrom" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        COALESCE((SELECT "Capacity" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1), 1),
        COALESCE(p_currency, (SELECT "Currency" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        p_sale_price,
        p_rent_price,
        COALESCE(p_has_common_expenses, (SELECT "HasCommonExpenses" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        p_common_expenses_value,
        COALESCE(p_is_electricity_included, (SELECT "IsElectricityIncluded" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        COALESCE(p_is_water_included, (SELECT "IsWaterIncluded" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        COALESCE(p_is_price_visible, (SELECT "IsPriceVisible" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        COALESCE(p_status, (SELECT "Status" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        COALESCE(p_is_active, (SELECT "IsActive" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        COALESCE(p_is_property_visible, (SELECT "IsPropertyVisible" FROM "EstatePropertyValues" WHERE "EstatePropertyId" = p_property_id::UUID AND "IsDeleted" = false ORDER BY "Created" DESC LIMIT 1)),
        false,
        NOW(),
        p_user_id,
        NOW(),
        p_user_id
    )
    ON CONFLICT ("EstatePropertyId", "IsDeleted")
    WHERE "IsDeleted" = false
    DO UPDATE SET
        "Description" = COALESCE(EXCLUDED."Description", "EstatePropertyValues"."Description"),
        "AvailableFrom" = COALESCE(EXCLUDED."AvailableFrom", "EstatePropertyValues"."AvailableFrom"),
        "Capacity" = COALESCE(EXCLUDED."Capacity", "EstatePropertyValues"."Capacity"),
        "Currency" = COALESCE(EXCLUDED."Currency", "EstatePropertyValues"."Currency"),
        "SalePrice" = EXCLUDED."SalePrice",
        "RentPrice" = EXCLUDED."RentPrice",
        "HasCommonExpenses" = COALESCE(EXCLUDED."HasCommonExpenses", "EstatePropertyValues"."HasCommonExpenses"),
        "CommonExpensesValue" = EXCLUDED."CommonExpensesValue",
        "IsElectricityIncluded" = COALESCE(EXCLUDED."IsElectricityIncluded", "EstatePropertyValues"."IsElectricityIncluded"),
        "IsWaterIncluded" = COALESCE(EXCLUDED."IsWaterIncluded", "EstatePropertyValues"."IsWaterIncluded"),
        "IsPriceVisible" = COALESCE(EXCLUDED."IsPriceVisible", "EstatePropertyValues"."IsPriceVisible"),
        "Status" = COALESCE(EXCLUDED."Status", "EstatePropertyValues"."Status"),
        "IsActive" = COALESCE(EXCLUDED."IsActive", "EstatePropertyValues"."IsActive"),
        "IsPropertyVisible" = COALESCE(EXCLUDED."IsPropertyVisible", "EstatePropertyValues"."IsPropertyVisible"),
        "LastModified" = NOW(),
        "LastModifiedBy" = p_user_id;

    -- Handle property images if provided
    IF p_property_images IS NOT NULL THEN
        -- Delete existing images
        DELETE FROM "PropertyImages" WHERE "EstatePropertyId" = p_property_id::UUID;

        -- Insert new images
        IF jsonb_array_length(p_property_images) > 0 THEN
            FOR v_image_record IN SELECT value FROM jsonb_array_elements(p_property_images)
            LOOP
                INSERT INTO "PropertyImages" (
                    "Id",
                    "EstatePropertyId",
                    "Url",
                    "IsMain",
                    "Order",
                    "CreatedAtUtc"
                ) VALUES (
                    gen_random_uuid(),
                    p_property_id::UUID,
                    v_image_record->>'url',
                    CASE WHEN (v_image_record->>'isMain')::boolean THEN true ELSE false END,
                    COALESCE((v_image_record->>'order')::integer, 0),
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    -- Handle property documents if provided
    IF p_property_documents IS NOT NULL THEN
        -- Delete existing documents
        DELETE FROM "PropertyDocuments" WHERE "EstatePropertyId" = p_property_id::UUID;

        -- Insert new documents
        IF jsonb_array_length(p_property_documents) > 0 THEN
            FOR v_document_record IN SELECT value FROM jsonb_array_elements(p_property_documents)
            LOOP
                INSERT INTO "PropertyDocuments" (
                    "Id",
                    "EstatePropertyId",
                    "Title",
                    "Url",
                    "CreatedAtUtc"
                ) VALUES (
                    gen_random_uuid(),
                    p_property_id::UUID,
                    v_document_record->>'title',
                    v_document_record->>'url',
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
            FOR v_video_record IN SELECT value FROM jsonb_array_elements(p_property_videos)
            LOOP
                INSERT INTO "PropertyVideos" (
                    "Id",
                    "EstatePropertyId",
                    "Url",
                    "Title",
                    "ThumbnailUrl",
                    "CreatedAtUtc"
                ) VALUES (
                    gen_random_uuid(),
                    p_property_id::UUID,
                    v_video_record->>'url',
                    v_video_record->>'title',
                    v_video_record->>'thumbnailUrl',
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    -- Handle property amenities if provided
    IF p_property_amenities IS NOT NULL THEN
        -- Delete existing amenities
        DELETE FROM "EstatePropertyAmenity" WHERE "EstatePropertyId" = p_property_id::UUID;

        -- Insert new amenities
        IF jsonb_array_length(p_property_amenities) > 0 THEN
            FOR v_amenity_record IN SELECT value FROM jsonb_array_elements(p_property_amenities)
            LOOP
                INSERT INTO "EstatePropertyAmenity" (
                    "EstatePropertyId",
                    "AmenityId",
                    "CreatedAtUtc"
                ) VALUES (
                    p_property_id::UUID,
                    (v_amenity_record->>'id')::uuid,
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    -- Build result JSON (without arePetsAllowed and capacity in main property)
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
        'type', ep."Type",
        'areaValue', ep."AreaValue",
        'areaUnit', ep."AreaUnit",
        'bedrooms', ep."Bedrooms",
        'bathrooms', ep."Bathrooms",
        'hasGarage', ep."HasGarage",
        'garageSpaces', ep."GarageSpaces",
        'description', epv."Description",
        'availableFrom', epv."AvailableFrom",
        'currency', CASE epv."Currency"
            WHEN 0 THEN 'USD'
            WHEN 1 THEN 'UYU'
            WHEN 2 THEN 'BRL'
            WHEN 3 THEN 'EUR'
            WHEN 4 THEN 'GBP'
            ELSE 'USD'
        END,
        'salePrice', epv."SalePrice",
        'rentPrice', epv."RentPrice",
        'hasCommonExpenses', epv."HasCommonExpenses",
        'commonExpensesValue', epv."CommonExpensesValue",
        'isElectricityIncluded', epv."IsElectricityIncluded",
        'isWaterIncluded', epv."IsWaterIncluded",
        'isPriceVisible', epv."IsPriceVisible",
        'status', epv."Status",
        'isActive', epv."IsActive",
        'isPropertyVisible', epv."IsPropertyVisible",
        'ownerId', ep."OwnerId",
        'created', ep."Created",
        'capacity', epv."Capacity",
        'estatePropertyValues', jsonb_build_array(
            jsonb_build_object(
                'id', epv."Id",
                'description', epv."Description",
                'availableFrom', epv."AvailableFrom",
                'capacity', epv."Capacity",
                'currency', epv."Currency",
                'salePrice', epv."SalePrice",
                'rentPrice', epv."RentPrice",
                'hasCommonExpenses', epv."HasCommonExpenses",
                'commonExpensesValue', epv."CommonExpensesValue",
                'isElectricityIncluded', epv."IsElectricityIncluded",
                'isWaterIncluded', epv."IsWaterIncluded",
                'isPriceVisible', epv."IsPriceVisible",
                'status', epv."Status",
                'isActive', epv."IsActive",
                'isPropertyVisible', epv."IsPropertyVisible",
                'isFeatured', epv."IsFeatured",
                'createdAt', epv."Created",
                'createdBy', epv."CreatedBy",
                'lastModified', epv."LastModified",
                'lastModifiedBy', epv."LastModifiedBy"
            )
        )
    ) INTO v_result
    FROM "EstateProperties" ep
    JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId"
    WHERE ep."Id" = p_property_id::UUID
      AND epv."IsDeleted" = false
    ORDER BY epv."Created" DESC
    LIMIT 1;

    RETURN v_result;
END;
$$;

-- Step 5: Update duplicate_estate_property function to remove the fields
CREATE OR REPLACE FUNCTION duplicate_estate_property(
    p_original_property_id TEXT,
    p_user_id TEXT,
    p_new_title TEXT DEFAULT NULL
) RETURNS JSONB
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_original_property RECORD;
    v_new_property_id UUID;
    v_member_id UUID;
    v_company_id UUID;
    v_owner_id UUID;
    v_new_title TEXT;
BEGIN
    -- Get original property data (without ArePetsAllowed and Capacity)
    SELECT
        "StreetName", "HouseNumber", "Neighborhood", "City", "State", "ZipCode", "Country",
        "LocationLatitude", "LocationLongitude", "Title", "Type", "AreaValue", "AreaUnit",
        "Bedrooms", "Bathrooms", "HasGarage", "GarageSpaces", "OwnerId"
    INTO v_original_property
    FROM "EstateProperties"
    WHERE "Id" = p_original_property_id::UUID;

    -- Get user information
    SELECT id, company_id INTO v_member_id, v_company_id
    FROM members
    WHERE id::text = p_user_id;

    -- Get or create owner record
    BEGIN
        v_owner_id := get_or_create_owner(v_member_id, v_company_id, NULL);
    EXCEPTION WHEN undefined_function THEN
        v_owner_id := COALESCE(v_member_id, v_company_id);
    END;

    -- Set new title
    v_new_title := COALESCE(p_new_title, v_original_property."Title" || ' (Copy)');

    -- Generate new property ID
    v_new_property_id := gen_random_uuid();

    -- Insert duplicated property (without ArePetsAllowed and Capacity)
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
        "Created",
        "LastModified"
    ) VALUES (
        v_new_property_id,
        v_original_property."StreetName",
        v_original_property."HouseNumber",
        v_original_property."Neighborhood",
        v_original_property."City",
        v_original_property."State",
        v_original_property."ZipCode",
        v_original_property."Country",
        v_original_property."LocationLatitude",
        v_original_property."LocationLongitude",
        v_new_title,
        v_original_property."Type",
        v_original_property."AreaValue",
        v_original_property."AreaUnit",
        v_original_property."Bedrooms",
        v_original_property."Bathrooms",
        v_original_property."HasGarage",
        v_original_property."GarageSpaces",
        v_owner_id,
        NOW(),
        NOW()
    );

    -- Duplicate property values (including capacity)
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
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    )
    SELECT
        gen_random_uuid(),
        v_new_property_id,
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
        false,
        NOW(),
        p_user_id,
        NOW(),
        p_user_id
    FROM "EstatePropertyValues"
    WHERE "EstatePropertyId" = p_original_property_id::UUID
      AND "IsDeleted" = false
    ORDER BY "Created" DESC
    LIMIT 1;

    -- Duplicate property images
    INSERT INTO "PropertyImages" (
        "Id",
        "EstatePropertyId",
        "Url",
        "IsMain",
        "Order",
        "CreatedAtUtc"
    )
    SELECT
        gen_random_uuid(),
        v_new_property_id,
        "Url",
        "IsMain",
        "Order",
        NOW()
    FROM "PropertyImages"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    -- Duplicate property documents
    INSERT INTO "PropertyDocuments" (
        "Id",
        "EstatePropertyId",
        "Title",
        "Url",
        "CreatedAtUtc"
    )
    SELECT
        gen_random_uuid(),
        v_new_property_id,
        "Title",
        "Url",
        NOW()
    FROM "PropertyDocuments"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    -- Duplicate property videos
    INSERT INTO "PropertyVideos" (
        "Id",
        "EstatePropertyId",
        "Url",
        "Title",
        "ThumbnailUrl",
        "CreatedAtUtc"
    )
    SELECT
        gen_random_uuid(),
        v_new_property_id,
        "Url",
        "Title",
        "ThumbnailUrl",
        NOW()
    FROM "PropertyVideos"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    -- Duplicate property amenities
    INSERT INTO "EstatePropertyAmenity" (
        "EstatePropertyId",
        "AmenityId",
        "CreatedAtUtc"
    )
    SELECT
        v_new_property_id,
        "AmenityId",
        NOW()
    FROM "EstatePropertyAmenity"
    WHERE "EstatePropertyId" = p_original_property_id::UUID;

    -- Return the duplicated property
    RETURN get_estate_property_by_id(v_new_property_id::text);
END;
$$;
