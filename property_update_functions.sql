-- PostgreSQL Functions for updating and duplicating estate properties
-- Execute these in your Supabase SQL Editor

-- Function to update estate property and all related data
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
    p_are_pets_allowed BOOLEAN DEFAULT NULL,
    p_capacity INTEGER DEFAULT NULL,
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
BEGIN
    -- Start transaction
    BEGIN
        -- Validate property exists and user owns it
        SELECT "OwnerId" INTO v_member_id
        FROM "EstateProperties"
        WHERE "Id" = p_property_id::UUID AND "IsDeleted" = false;

        IF v_member_id IS NULL THEN
            RAISE EXCEPTION 'Property not found or already deleted';
        END IF;

        -- Validate user is the owner (get member ID for user)
        SELECT "Id" INTO v_member_id
        FROM "Members"
        WHERE "UserId" = p_user_id AND "IsDeleted" = false;

        IF v_member_id IS NULL OR v_member_id != (
            SELECT "OwnerId" FROM "EstateProperties" WHERE "Id" = p_property_id::UUID
        ) THEN
            RAISE EXCEPTION 'User does not own this property';
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
            "LocationLat" = COALESCE(p_location_lat, "LocationLat"),
            "LocationLng" = COALESCE(p_location_lng, "LocationLng"),
            "Title" = COALESCE(p_title, "Title"),
            "PropertyType" = COALESCE(p_property_type, "PropertyType"),
            "AreaValue" = COALESCE(p_area_value, "AreaValue"),
            "AreaUnit" = COALESCE(p_area_unit, "AreaUnit"),
            "Bedrooms" = COALESCE(p_bedrooms, "Bedrooms"),
            "Bathrooms" = COALESCE(p_bathrooms, "Bathrooms"),
            "HasGarage" = COALESCE(p_has_garage, "HasGarage"),
            "GarageSpaces" = COALESCE(p_garage_spaces, "GarageSpaces"),
            "ArePetsAllowed" = COALESCE(p_are_pets_allowed, "ArePetsAllowed"),
            "Capacity" = COALESCE(p_capacity, "Capacity"),
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
                COALESCE(p_capacity, v_current_values.Capacity),
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
            'location', jsonb_build_object('lat', ep."LocationLat", 'lng', ep."LocationLng"),
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
            'arePetsAllowed', ep."ArePetsAllowed",
            'capacity', ep."Capacity",
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

-- Function to duplicate estate property and all related data
CREATE OR REPLACE FUNCTION duplicate_estate_property(
    p_original_property_id TEXT,
    p_user_id TEXT,
    p_new_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_property_id UUID;
    v_member_id TEXT;
    v_original_property RECORD;
    v_image_record RECORD;
    v_document_record RECORD;
    v_video_record RECORD;
    v_amenity_record RECORD;
    v_values_record RECORD;
    v_result JSONB;
BEGIN
    -- Start transaction
    BEGIN
        -- Validate user and get member ID
        SELECT "Id" INTO v_member_id
        FROM "Members"
        WHERE "UserId" = p_user_id AND "IsDeleted" = false;

        IF v_member_id IS NULL THEN
            RAISE EXCEPTION 'User member not found or is deleted';
        END IF;

        -- Get original property data
        SELECT * INTO v_original_property
        FROM "EstateProperties"
        WHERE "Id" = p_original_property_id::UUID AND "IsDeleted" = false;

        IF v_original_property IS NULL THEN
            RAISE EXCEPTION 'Original property not found';
        END IF;

        -- Generate new property ID
        v_new_property_id := gen_random_uuid();

        -- Insert duplicated property record
        INSERT INTO "EstateProperties" (
            "Id",
            "StreetName",
            "HouseNumber",
            "Neighborhood",
            "City",
            "State",
            "ZipCode",
            "Country",
            "LocationLat",
            "LocationLng",
            "Title",
            "PropertyType",
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
            v_new_property_id,
            v_original_property."StreetName",
            v_original_property."HouseNumber",
            v_original_property."Neighborhood",
            v_original_property."City",
            v_original_property."State",
            v_original_property."ZipCode",
            v_original_property."Country",
            v_original_property."LocationLat",
            v_original_property."LocationLng",
            COALESCE(p_new_title, v_original_property."Title" || ' (Copy)'),
            v_original_property."PropertyType",
            v_original_property."AreaValue",
            v_original_property."AreaUnit",
            v_original_property."Bedrooms",
            v_original_property."Bathrooms",
            v_original_property."HasGarage",
            v_original_property."GarageSpaces",
            v_original_property."ArePetsAllowed",
            v_original_property."Capacity",
            v_member_id,
            NOW(),
            NOW()
        );

        -- Duplicate images
        FOR v_image_record IN
            SELECT * FROM "PropertyImages"
            WHERE "EstatePropertyId" = p_original_property_id::UUID AND "IsDeleted" = false
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
                gen_random_uuid(),
                v_new_property_id,
                v_image_record."Url",
                v_image_record."AltText",
                v_image_record."IsMain",
                v_image_record."IsPublic",
                v_image_record."FileName",
                NOW(),
                NOW()
            );
        END LOOP;

        -- Duplicate documents
        FOR v_document_record IN
            SELECT * FROM "PropertyDocuments"
            WHERE "EstatePropertyId" = p_original_property_id::UUID AND "IsDeleted" = false
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
                gen_random_uuid(),
                v_new_property_id,
                v_document_record."Url",
                v_document_record."Name",
                v_document_record."FileName",
                v_document_record."IsPublic",
                NOW(),
                NOW()
            );
        END LOOP;

        -- Duplicate videos
        FOR v_video_record IN
            SELECT * FROM "PropertyVideos"
            WHERE "EstatePropertyId" = p_original_property_id::UUID AND "IsDeleted" = false
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
                gen_random_uuid(),
                v_new_property_id,
                v_video_record."Url",
                v_video_record."Title",
                v_video_record."Description",
                v_video_record."IsPublic",
                NOW(),
                NOW()
            );
        END LOOP;

        -- Duplicate amenities
        FOR v_amenity_record IN
            SELECT * FROM "EstatePropertyAmenities"
            WHERE "EstatePropertyId" = p_original_property_id::UUID AND "IsDeleted" = false
        LOOP
            INSERT INTO "EstatePropertyAmenities" (
                "EstatePropertyId",
                "AmenityId",
                "Created",
                "LastModified"
            ) VALUES (
                v_new_property_id,
                v_amenity_record."AmenityId",
                NOW(),
                NOW()
            );
        END LOOP;

        -- Duplicate latest property values
        SELECT * INTO v_values_record
        FROM "EstatePropertyValues"
        WHERE "EstatePropertyId" = p_original_property_id::UUID AND "IsDeleted" = false
        ORDER BY "Created" DESC
        LIMIT 1;

        IF v_values_record IS NOT NULL THEN
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
                v_new_property_id,
                v_values_record."Description",
                v_values_record."AvailableFrom",
                v_values_record."Capacity",
                v_values_record."Currency",
                v_values_record."SalePrice",
                v_values_record."RentPrice",
                v_values_record."HasCommonExpenses",
                v_values_record."CommonExpensesValue",
                v_values_record."IsElectricityIncluded",
                v_values_record."IsWaterIncluded",
                v_values_record."IsPriceVisible",
                v_values_record."Status",
                v_values_record."IsActive",
                v_values_record."IsPropertyVisible",
                false, -- New properties start as not featured
                NOW(),
                NOW()
            );
        END IF;

        -- Build result
        v_result := jsonb_build_object(
            'newPropertyId', v_new_property_id,
            'title', COALESCE(p_new_title, v_original_property."Title" || ' (Copy)')
        );

        RETURN v_result;

    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback will happen automatically
            RAISE EXCEPTION 'Failed to duplicate estate property: %', SQLERRM;
    END;
END;
$$;
