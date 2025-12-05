-- PostgreSQL Function to create estate properties with all related data
-- Execute this in your Supabase SQL Editor

-- Function to create estate property
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
    p_property_type INTEGER, -- 0: House, 1: Apartment, 2: Commercial, 3: Land, 4: Other
    p_area_value DOUBLE PRECISION,
    p_area_unit INTEGER, -- 0: m², 1: ft², 2: yd², 3: acres, 4: hectares, 5: sq_km, 6: sq_mi
    p_bedrooms INTEGER,
    p_bathrooms INTEGER,
    p_has_garage BOOLEAN,
    p_garage_spaces INTEGER,
    p_description TEXT,
    p_available_from TIMESTAMP WITH TIME ZONE,
    p_are_pets_allowed BOOLEAN,
    p_capacity INTEGER,
    p_owner_user_id TEXT,
    p_currency INTEGER, -- 0: USD, 1: UYU, 2: BRL, 3: EUR, 4: GBP
    p_sale_price DOUBLE PRECISION,
    p_rent_price DOUBLE PRECISION,
    p_has_common_expenses BOOLEAN,
    p_common_expenses_value DOUBLE PRECISION,
    p_is_electricity_included BOOLEAN,
    p_is_water_included BOOLEAN,
    p_is_price_visible BOOLEAN,
    p_status INTEGER, -- 0: Sale, 1: Rent, 2: Sold, 3: Reserved, 4: Unavailable
    p_is_active BOOLEAN,
    p_is_property_visible BOOLEAN,
    p_property_images JSONB,
    p_property_documents JSONB,
    p_property_videos JSONB,
    p_amenity_ids JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_id UUID;
    v_member_id TEXT;
    v_main_image_id UUID;
    v_image_record JSONB;
    v_document_record JSONB;
    v_video_record JSONB;
    v_amenity_id TEXT;
    v_result JSONB;
BEGIN
    -- Start transaction
    BEGIN
        -- Validate owner exists and is not deleted
        SELECT "Id" INTO v_member_id
        FROM "Members"
        WHERE "UserId" = p_owner_user_id AND "IsDeleted" = false;

        IF v_member_id IS NULL THEN
            RAISE EXCEPTION 'Owner member not found or is deleted';
        END IF;

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
            p_are_pets_allowed,
            p_capacity,
            v_member_id,
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
            FOR v_amenity_id IN SELECT * FROM jsonb_array_elements_text(p_amenity_ids)
            LOOP
                INSERT INTO "EstatePropertyAmenities" (
                    "EstatePropertyId",
                    "AmenityId",
                    "Created",
                    "LastModified"
                ) VALUES (
                    v_property_id,
                    v_amenity_id::UUID,
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
            "LastModified"
        ) VALUES (
            gen_random_uuid(),
            v_property_id,
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
            true, -- Always featured for initial creation
            NOW(),
            NOW()
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
            'arePetsAllowed', p_are_pets_allowed,
            'capacity', p_capacity,
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
            'ownerId', v_member_id,
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
