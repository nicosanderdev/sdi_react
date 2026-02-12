


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_conversion_stat"("current_messages" bigint, "current_visits" bigint, "previous_messages" bigint, "previous_visits" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_current_rate DECIMAL(10,2);
    v_previous_rate DECIMAL(10,2);
    v_percentage_change DECIMAL(10,2);
    v_change_direction TEXT := 'neutral';
BEGIN
    -- Calculate rates
    v_current_rate := CASE WHEN current_visits > 0 THEN (current_messages::DECIMAL / current_visits::DECIMAL) * 100 ELSE 0 END;
    v_previous_rate := CASE WHEN previous_visits > 0 THEN (previous_messages::DECIMAL / previous_visits::DECIMAL) * 100 ELSE 0 END;

    -- Calculate percentage change
    IF v_previous_rate > 0 THEN
        v_percentage_change := ((v_current_rate - v_previous_rate) / v_previous_rate) * 100;
    ELSIF v_current_rate > 0 THEN
        v_percentage_change := 100;
    ELSE
        v_percentage_change := 0;
    END IF;

    IF v_percentage_change > 0.5 THEN
        v_change_direction := 'increase';
    ELSIF v_percentage_change < -0.5 THEN
        v_change_direction := 'decrease';
    END IF;

    RETURN jsonb_build_object(
        'currentPeriod', ROUND(v_current_rate)::BIGINT,
        'percentageChange', v_percentage_change,
        'changeDirection', v_change_direction
    );
END;
$$;


ALTER FUNCTION "public"."calculate_conversion_stat"("current_messages" bigint, "current_visits" bigint, "previous_messages" bigint, "previous_visits" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_stat"("current_val" bigint, "previous_val" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_percentage_change DECIMAL(10,2);
    v_change_direction TEXT := 'neutral';
BEGIN
    IF previous_val > 0 THEN
        v_percentage_change := ((current_val::DECIMAL - previous_val::DECIMAL) / previous_val::DECIMAL) * 100;
    ELSIF current_val > 0 THEN
        v_percentage_change := 100; -- Infinite increase from 0
    ELSE
        v_percentage_change := 0;
    END IF;

    IF v_percentage_change > 0.5 THEN
        v_change_direction := 'increase';
    ELSIF v_percentage_change < -0.5 THEN
        v_change_direction := 'decrease';
    END IF;

    RETURN jsonb_build_object(
        'currentPeriod', current_val,
        'percentageChange', v_percentage_change,
        'changeDirection', v_change_direction
    );
END;
$$;


ALTER FUNCTION "public"."calculate_stat"("current_val" bigint, "previous_val" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_estate_property"("p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb", "p_owner_member_id" "uuid" DEFAULT NULL, "p_owner_company_id" "uuid" DEFAULT NULL, "p_owner_user_id" "uuid" DEFAULT NULL) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_property_id UUID;
    v_owner_id UUID;
    v_member_id UUID;
    v_main_image_id UUID;
    v_image_record JSONB;
    v_document_record JSONB;
    v_video_record JSONB;
    v_amenity_id UUID;
    v_result JSONB;
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
        END IF;

        -- Get or create owner record using helper function (if available)
        BEGIN
            v_owner_id := get_or_create_owner(v_member_id, NULL, 'member');
        EXCEPTION WHEN undefined_function THEN
            -- Fallback for older schema without Owners table
            v_owner_id := v_member_id;
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
            p_are_pets_allowed,
            p_capacity,
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


ALTER FUNCTION "public"."create_estate_property"("p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb", "p_owner_member_id" "uuid", "p_owner_company_id" "uuid", "p_owner_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_estate_property"("p_original_property_id" "text", "p_user_id" "text", "p_new_title" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
            v_original_property."Type",
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


ALTER FUNCTION "public"."duplicate_estate_property"("p_original_property_id" "text", "p_user_id" "text", "p_new_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_message_snippet"("text_body" "text", "max_length" integer DEFAULT 150) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    IF text_body IS NULL OR text_body = '' THEN
        RETURN '';
    END IF;

    IF LENGTH(text_body) <= max_length THEN
        RETURN text_body;
    ELSE
        RETURN SUBSTRING(text_body, 1, max_length) || '...';
    END IF;
END;
$$;


ALTER FUNCTION "public"."generate_message_snippet"("text_body" "text", "max_length" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_summary"("p_period" "text", "p_company_id" "text" DEFAULT NULL::"text", "p_user_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_start_date TIMESTAMP WITH TIME ZONE;
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_previous_start_date TIMESTAMP WITH TIME ZONE;
    v_previous_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_current_visits BIGINT;
    v_previous_visits BIGINT;
    v_current_messages BIGINT;
    v_previous_messages BIGINT;
    v_total_active_properties BIGINT;
    v_visits_stat JSONB;
    v_messages_stat JSONB;
    v_total_properties_stat JSONB;
    v_conversion_rate_stat JSONB;
BEGIN
    -- Parse period to get date ranges
    SELECT start_date, end_date
    INTO v_current_start_date, v_current_end_date
    FROM parse_period(p_period);

    -- Calculate previous period (same duration before current period)
    SELECT
        v_current_start_date - (v_current_end_date - v_current_start_date + INTERVAL '1 second'),
        v_current_start_date - INTERVAL '1 second'
    INTO v_previous_start_date, v_previous_end_date;

    -- Get accessible company IDs for the user
    IF p_company_id IS NOT NULL THEN
        -- If specific company requested, validate user has access
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."CompanyId" = p_company_id::UUID
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        -- Get all accessible companies for the user
        SELECT ARRAY_AGG(uc."CompanyId")
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    -- Get current period visit count
    SELECT COUNT(*) INTO v_current_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_current_start_date
    AND pvl."VisitedOnUtc" <= v_current_end_date
    AND ep."OwnerId" = ANY(v_user_companies);

    -- Get previous period visit count
    SELECT COUNT(*) INTO v_previous_visits
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_previous_start_date
    AND pvl."VisitedOnUtc" <= v_previous_end_date
    AND ep."OwnerId" = ANY(v_user_companies);

    -- Get current period message count
    SELECT COUNT(*) INTO v_current_messages
    FROM "PropertyMessageLogs" pml
    JOIN "EstateProperties" ep ON pml."PropertyId" = ep."Id"
    WHERE pml."SentOnUtc" >= v_current_start_date
    AND pml."SentOnUtc" <= v_current_end_date
    AND ep."OwnerId" = ANY(v_user_companies);

    -- Get previous period message count
    SELECT COUNT(*) INTO v_previous_messages
    FROM "PropertyMessageLogs" pml
    JOIN "EstateProperties" ep ON pml."PropertyId" = ep."Id"
    WHERE pml."SentOnUtc" >= v_previous_start_date
    AND pml."SentOnUtc" <= v_previous_end_date
    AND ep."OwnerId" = ANY(v_user_companies);

    -- Get total active properties
    SELECT COUNT(*) INTO v_total_active_properties
    FROM "EstateProperties" ep
    JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId"
    WHERE ep."IsDeleted" = false
    AND epv."IsDeleted" = false
    AND epv."IsFeatured" = true
    AND epv."IsPropertyVisible" = true
    AND ep."OwnerId" = ANY(v_user_companies);

    -- Calculate visits stat
    v_visits_stat := calculate_stat(v_current_visits, v_previous_visits);

    -- Calculate messages stat
    v_messages_stat := calculate_stat(v_current_messages, v_previous_messages);

    -- Total properties stat (no trend calculation)
    v_total_properties_stat := jsonb_build_object(
        'currentPeriod', v_total_active_properties,
        'percentageChange', 0,
        'changeDirection', 'neutral'
    );

    -- Calculate conversion rate (messages/visits)
    IF v_current_visits > 0 OR v_previous_visits > 0 THEN
        v_conversion_rate_stat := calculate_conversion_stat(v_current_messages, v_current_visits, v_previous_messages, v_previous_visits);
    ELSE
        v_conversion_rate_stat := jsonb_build_object(
            'currentPeriod', 0,
            'percentageChange', 0,
            'changeDirection', 'neutral'
        );
    END IF;

    RETURN jsonb_build_object(
        'visits', v_visits_stat,
        'messages', v_messages_stat,
        'totalProperties', v_total_properties_stat,
        'conversionRate', v_conversion_rate_stat
    );
END;
$$;


ALTER FUNCTION "public"."get_dashboard_summary"("p_period" "text", "p_company_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_message_by_id"("p_message_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Get message with access control (user must be sender or recipient)
    SELECT jsonb_build_object(
        'id', m."Id",
        'threadId', m."ThreadId",
        'senderId', m."SenderId",
        'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
        'recipientId', mr."RecipientId",
        'propertyId', mt."PropertyId",
        'propertyTitle', ep."Title",
        'subject', mt."Subject",
        'snippet', m."Snippet",
        'fullBody', m."Body",
        'createdAt', m."CreatedAtUtc",
        'isRead', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsRead" ELSE true END,
        'isReplied', CASE WHEN mr."RecipientId" = v_member_id THEN mr."HasBeenRepliedToByRecipient" ELSE false END,
        'isStarred', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsStarred" ELSE false END,
        'isArchived', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsArchived" ELSE false END
    ) INTO v_result
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE m."Id" = p_message_id
    AND (m."SenderId" = v_member_id OR mr."RecipientId" = v_member_id);

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Message not found or access denied';
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_message_by_id"("p_message_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_message_counts"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_inbox_count INTEGER := 0;
    v_starred_count INTEGER := 0;
    v_replied_count INTEGER := 0;
    v_archived_count INTEGER := 0;
    v_sent_count INTEGER := 0;
    v_trash_count INTEGER := 0;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object(
            'inbox', 0, 'starred', 0, 'replied', 0, 'archived', 0, 'sent', 0, 'trash', 0
        );
    END IF;

    -- Count inbox (unread messages that are not archived and not deleted)
    SELECT COUNT(*) INTO v_inbox_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsArchived" = false
    AND mr."IsDeleted" = false
    AND mr."IsRead" = false;

    -- Count starred messages
    SELECT COUNT(*) INTO v_starred_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsStarred" = true
    AND mr."IsDeleted" = false;

    -- Count replied messages
    SELECT COUNT(*) INTO v_replied_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."HasBeenRepliedToByRecipient" = true
    AND mr."IsArchived" = false
    AND mr."IsDeleted" = false;

    -- Count archived messages
    SELECT COUNT(*) INTO v_archived_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsArchived" = true
    AND mr."IsDeleted" = false;

    -- Count sent messages
    SELECT COUNT(*) INTO v_sent_count
    FROM "Messages" m
    WHERE m."SenderId" = v_member_id;

    -- Count trash messages
    SELECT COUNT(*) INTO v_trash_count
    FROM "MessageRecipients" mr
    WHERE mr."RecipientId" = v_member_id
    AND mr."IsDeleted" = true;

    RETURN jsonb_build_object(
        'inbox', v_inbox_count,
        'starred', v_starred_count,
        'replied', v_replied_count,
        'archived', v_archived_count,
        'sent', v_sent_count,
        'trash', v_trash_count
    );
END;
$$;


ALTER FUNCTION "public"."get_message_counts"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_messages"("p_user_id" "uuid", "p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 15, "p_filter" "text" DEFAULT 'inbox'::"text", "p_query" "text" DEFAULT NULL::"text", "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_sort_by" "text" DEFAULT 'createdAt_desc'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_total_count INTEGER;
    v_total_pages INTEGER;
    v_result JSONB;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'totalPages', 0);
    END IF;

    -- Calculate total count based on filter
    CASE LOWER(p_filter)
        WHEN 'inbox' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsArchived" = false AND mr."IsDeleted" = false;

        WHEN 'starred' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsStarred" = true AND mr."IsDeleted" = false;

        WHEN 'replied' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false;

        WHEN 'archived' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsArchived" = true AND mr."IsDeleted" = false;

        WHEN 'sent' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "Messages" m
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE m."SenderId" = v_member_id;

        WHEN 'trash' THEN
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsDeleted" = true;

        ELSE
            -- Default to inbox
            SELECT COUNT(*) INTO v_total_count
            FROM "MessageRecipients" mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            WHERE mr."RecipientId" = v_member_id AND mr."IsArchived" = false AND mr."IsDeleted" = false;
    END CASE;

    -- Apply text search filter to total count if query provided
    IF p_query IS NOT NULL AND p_query != '' THEN
        CASE LOWER(p_filter)
            WHEN 'sent' THEN
                SELECT COUNT(*) INTO v_total_count
                FROM "Messages" m
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE m."SenderId" = v_member_id
                AND (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%');

            ELSE
                SELECT COUNT(*) INTO v_total_count
                FROM "MessageRecipients" mr
                JOIN "Messages" m ON m."Id" = mr."MessageId"
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE mr."RecipientId" = v_member_id
                AND (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%')
                AND CASE LOWER(p_filter)
                    WHEN 'inbox' THEN mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'starred' THEN mr."IsStarred" = true AND mr."IsDeleted" = false
                    WHEN 'replied' THEN mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'archived' THEN mr."IsArchived" = true AND mr."IsDeleted" = false
                    WHEN 'trash' THEN mr."IsDeleted" = true
                    ELSE mr."IsArchived" = false AND mr."IsDeleted" = false
                END;
        END CASE;
    END IF;

    -- Apply property filter to total count if provided
    IF p_property_id IS NOT NULL THEN
        CASE LOWER(p_filter)
            WHEN 'sent' THEN
                SELECT COUNT(*) INTO v_total_count
                FROM "Messages" m
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE m."SenderId" = v_member_id AND mt."PropertyId" = p_property_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'));

            ELSE
                SELECT COUNT(*) INTO v_total_count
                FROM "MessageRecipients" mr
                JOIN "Messages" m ON m."Id" = mr."MessageId"
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                WHERE mr."RecipientId" = v_member_id AND mt."PropertyId" = p_property_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'))
                AND CASE LOWER(p_filter)
                    WHEN 'inbox' THEN mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'starred' THEN mr."IsStarred" = true AND mr."IsDeleted" = false
                    WHEN 'replied' THEN mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'archived' THEN mr."IsArchived" = true AND mr."IsDeleted" = false
                    WHEN 'trash' THEN mr."IsDeleted" = true
                    ELSE mr."IsArchived" = false AND mr."IsDeleted" = false
                END;
        END CASE;
    END IF;

    -- Calculate total pages
    v_total_pages := CEIL(v_total_count::FLOAT / p_limit);

    -- Get paginated data
    CASE LOWER(p_filter)
        WHEN 'sent' THEN
            -- Handle sent messages
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', m."Id",
                    'threadId', m."ThreadId",
                    'senderId', m."SenderId",
                    'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
                    'recipientId', mr."RecipientId",
                    'propertyId', mt."PropertyId",
                    'propertyTitle', ep."Title",
                    'subject', mt."Subject",
                    'snippet', m."Snippet",
                    'createdAt', m."CreatedAtUtc",
                    'isRead', true,
                    'isReplied', false,
                    'isStarred', false,
                    'isArchived', false
                )
            ) INTO v_result
            FROM (
                SELECT m.*, ROW_NUMBER() OVER (
                    ORDER BY CASE WHEN LOWER(p_sort_by) = 'createdat_asc' THEN m."CreatedAtUtc" END ASC,
                             CASE WHEN LOWER(p_sort_by) != 'createdat_asc' THEN m."CreatedAtUtc" END DESC
                ) as rn
                FROM "Messages" m
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
                LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
                LEFT JOIN "Members" mem ON mem."Id" = mr."RecipientId"
                WHERE m."SenderId" = v_member_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'))
                AND (p_property_id IS NULL OR mt."PropertyId" = p_property_id)
            ) m
            LEFT JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
            LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
            LEFT JOIN "Members" mem ON mem."Id" = mr."RecipientId"
            WHERE m.rn > (p_page - 1) * p_limit AND m.rn <= p_page * p_limit;

        ELSE
            -- Handle received messages
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', m."Id",
                    'threadId', m."ThreadId",
                    'senderId', m."SenderId",
                    'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
                    'recipientId', mr."RecipientId",
                    'propertyId', mt."PropertyId",
                    'propertyTitle', ep."Title",
                    'subject', mt."Subject",
                    'snippet', m."Snippet",
                    'createdAt', m."CreatedAtUtc",
                    'isRead', mr."IsRead",
                    'isReplied', mr."HasBeenRepliedToByRecipient",
                    'isStarred', mr."IsStarred",
                    'isArchived', mr."IsArchived"
                )
            ) INTO v_result
            FROM (
                SELECT mr.*, m.*, ROW_NUMBER() OVER (
                    ORDER BY CASE WHEN LOWER(p_sort_by) = 'createdat_asc' THEN m."CreatedAtUtc" END ASC,
                             CASE WHEN LOWER(p_sort_by) != 'createdat_asc' THEN m."CreatedAtUtc" END DESC
                ) as rn
                FROM "MessageRecipients" mr
                JOIN "Messages" m ON m."Id" = mr."MessageId"
                JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
                LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
                LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
                WHERE mr."RecipientId" = v_member_id
                AND (p_query IS NULL OR p_query = '' OR (mt."Subject" ILIKE '%' || p_query || '%' OR m."Snippet" ILIKE '%' || p_query || '%'))
                AND (p_property_id IS NULL OR mt."PropertyId" = p_property_id)
                AND CASE LOWER(p_filter)
                    WHEN 'inbox' THEN mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'starred' THEN mr."IsStarred" = true AND mr."IsDeleted" = false
                    WHEN 'replied' THEN mr."HasBeenRepliedToByRecipient" = true AND mr."IsArchived" = false AND mr."IsDeleted" = false
                    WHEN 'archived' THEN mr."IsArchived" = true AND mr."IsDeleted" = false
                    WHEN 'trash' THEN mr."IsDeleted" = true
                    ELSE mr."IsArchived" = false AND mr."IsDeleted" = false
                END
            ) mr
            JOIN "Messages" m ON m."Id" = mr."MessageId"
            JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
            LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
            LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
            WHERE mr.rn > (p_page - 1) * p_limit AND mr.rn <= p_page * p_limit;
    END CASE;

    -- Return empty array if no results
    IF v_result IS NULL THEN
        v_result := '[]'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'data', v_result,
        'total', v_total_count,
        'page', p_page,
        'totalPages', v_total_pages
    );
END;
$$;


ALTER FUNCTION "public"."get_messages"("p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_filter" "text", "p_query" "text", "p_property_id" "uuid", "p_sort_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_messages_by_property_id"("p_property_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Validate property exists
    IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Get all messages for this property
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m."Id",
            'threadId', m."ThreadId",
            'senderId', m."SenderId",
            'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
            'recipientId', mr."RecipientId",
            'propertyId', mt."PropertyId",
            'propertyTitle', ep."Title",
            'subject', mt."Subject",
            'snippet', m."Snippet",
            'createdAt', m."CreatedAtUtc",
            'isRead', mr."IsRead",
            'isReplied', mr."HasBeenRepliedToByRecipient",
            'isStarred', mr."IsStarred",
            'isArchived', mr."IsArchived"
        )
    ) INTO v_result
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE mt."PropertyId" = p_property_id
    ORDER BY m."CreatedAtUtc" DESC;

    IF v_result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_messages_by_property_id"("p_property_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_messages_by_thread_id"("p_thread_id" "uuid", "p_user_id" "uuid", "p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 100, "p_sort_by" "text" DEFAULT 'createdAt_asc'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member_id UUID;
    v_result JSONB;
    v_has_access BOOLEAN := false;
BEGIN
    -- Get member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Check if user has access to this thread (sender or recipient of any message)
    SELECT EXISTS(
        SELECT 1 FROM "Messages" m
        LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
        WHERE m."ThreadId" = p_thread_id
        AND (m."SenderId" = v_member_id OR mr."RecipientId" = v_member_id)
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied to thread';
    END IF;

    -- Get messages in thread with pagination
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', m."Id",
            'threadId', m."ThreadId",
            'senderId', m."SenderId",
            'senderName', COALESCE(mem."FirstName" || ' ' || mem."LastName", mem."FirstName", ''),
            'recipientId', mr."RecipientId",
            'propertyId', mt."PropertyId",
            'propertyTitle', ep."Title",
            'subject', mt."Subject",
            'snippet', m."Snippet",
            'fullBody', m."Body",
            'createdAt', m."CreatedAtUtc",
            'isRead', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsRead" ELSE true END,
            'isReplied', CASE WHEN mr."RecipientId" = v_member_id THEN mr."HasBeenRepliedToByRecipient" ELSE false END,
            'isStarred', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsStarred" ELSE false END,
            'isArchived', CASE WHEN mr."RecipientId" = v_member_id THEN mr."IsArchived" ELSE false END
        )
    ) INTO v_result
    FROM (
        SELECT m.*, ROW_NUMBER() OVER (
            ORDER BY CASE WHEN LOWER(p_sort_by) = 'createdat_asc' THEN m."CreatedAtUtc" END ASC,
                     CASE WHEN LOWER(p_sort_by) != 'createdat_asc' THEN m."CreatedAtUtc" END DESC
        ) as rn
        FROM "Messages" m
        WHERE m."ThreadId" = p_thread_id
    ) m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    LEFT JOIN "Members" mem ON mem."Id" = m."SenderId"
    LEFT JOIN "MessageRecipients" mr ON mr."MessageId" = m."Id"
    WHERE m.rn > (p_page - 1) * p_limit AND m.rn <= p_page * p_limit;

    IF v_result IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_messages_by_thread_id"("p_thread_id" "uuid", "p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_sort_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_visits_by_property"("p_period" "text", "p_page" integer DEFAULT 1, "p_limit" integer DEFAULT 10, "p_company_id" "text" DEFAULT NULL::"text", "p_user_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
    v_user_companies UUID[];
    v_offset INTEGER;
    v_total_count BIGINT;
    v_result_data JSONB[];
    v_item JSONB;
BEGIN
    -- Parse period to get date range
    SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM parse_period(p_period);

    -- Get accessible company IDs for the user
    IF p_company_id IS NOT NULL THEN
        SELECT ARRAY[uc."CompanyId"]
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."CompanyId" = p_company_id::UUID
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    ELSE
        SELECT ARRAY_AGG(uc."CompanyId")
        FROM "UserCompanies" uc
        WHERE uc."MemberId" = (SELECT "Id" FROM "Members" WHERE "UserId" = p_user_id::UUID AND "IsDeleted" = false)
        AND uc."IsDeleted" = false
        INTO v_user_companies;
    END IF;

    -- Calculate offset
    v_offset := (p_page - 1) * p_limit;

    -- Get total count
    SELECT COUNT(DISTINCT pvl."PropertyId")
    INTO v_total_count
    FROM "PropertyVisitLogs" pvl
    JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
    WHERE pvl."VisitedOnUtc" >= v_start_date
    AND pvl."VisitedOnUtc" <= v_end_date
    AND ep."OwnerId" = ANY(v_user_companies);

    -- Get paginated results
    SELECT ARRAY_AGG(
        jsonb_build_object(
            'propertyId', ep."Id"::TEXT,
            'propertyTitle', ep."Title",
            'address', COALESCE(ep."StreetName", '') || ' ' || COALESCE(ep."HouseNumber", ''),
            'visitCount', stats.visit_count,
            'price', COALESCE(epv."RentPrice"::TEXT, epv."SalePrice"::TEXT),
            'status', CASE epv."Status"
                WHEN 0 THEN 'Sale'
                WHEN 1 THEN 'Rent'
                WHEN 2 THEN 'Reserved'
                WHEN 3 THEN 'Sold'
                WHEN 4 THEN 'Unavailable'
                ELSE 'Unknown'
            END,
            'messages', stats.message_count,
            'visitsTrend', 'flat', -- Placeholder for trend calculation
            'messagesTrend', 'flat', -- Placeholder for trend calculation
            'conversion', '0%', -- Placeholder for conversion calculation
            'conversionTrend', 'flat' -- Placeholder for conversion trend
        )
    )
    INTO v_result_data
    FROM (
        SELECT
            pvl."PropertyId",
            COUNT(*) as visit_count,
            COALESCE((
                SELECT COUNT(*)
                FROM "PropertyMessageLogs" pml
                WHERE pml."PropertyId" = pvl."PropertyId"
                AND pml."SentOnUtc" >= v_start_date
                AND pml."SentOnUtc" <= v_end_date
            ), 0) as message_count
        FROM "PropertyVisitLogs" pvl
        JOIN "EstateProperties" ep ON pvl."PropertyId" = ep."Id"
        WHERE pvl."VisitedOnUtc" >= v_start_date
        AND pvl."VisitedOnUtc" <= v_end_date
        AND ep."OwnerId" = ANY(v_user_companies)
        GROUP BY pvl."PropertyId"
        ORDER BY visit_count DESC
        LIMIT p_limit
        OFFSET v_offset
    ) stats
    JOIN "EstateProperties" ep ON stats."PropertyId" = ep."Id"
    LEFT JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId"
        AND epv."IsFeatured" = true
        AND epv."IsDeleted" = false;

    RETURN jsonb_build_object(
        'data', v_result_data,
        'total', v_total_count,
        'page', p_page,
        'limit', p_limit
    );
END;
$$;


ALTER FUNCTION "public"."get_visits_by_property"("p_period" "text", "p_page" integer, "p_limit" integer, "p_company_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$BEGIN
  INSERT INTO public."Members" ("Id", "UserId", "FirstName", "LastName", "AvatarUrl", "Created", "LastModified")
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    'https://placehold.co/150x150',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_period"("p_period" "text") RETURNS TABLE("start_date" timestamp with time zone, "end_date" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    CASE LOWER(p_period)
        WHEN 'last7days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '7 days';
        WHEN 'last30days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '30 days';
        WHEN 'last90days' THEN
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '90 days';
        WHEN 'thisyear' THEN
            v_start_date := DATE_TRUNC('year', v_now);
            v_end_date := v_now;
        ELSE
            -- Default to last 30 days
            v_end_date := v_now;
            v_start_date := v_now - INTERVAL '30 days';
    END CASE;

    RETURN QUERY SELECT v_start_date, v_end_date;
END;
$$;


ALTER FUNCTION "public"."parse_period"("p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_message"("p_user_id" "uuid", "p_subject" "text", "p_body" "text", "p_recipient_id" "uuid" DEFAULT NULL::"uuid", "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_in_reply_to_message_id" "uuid" DEFAULT NULL::"uuid", "p_thread_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_sender_member_id UUID;
    v_recipient_id UUID := p_recipient_id;
    v_thread_id UUID := p_thread_id;
    v_message_id UUID;
    v_recipient_entry_id UUID;
    v_created_message JSONB;
BEGIN
    -- Get sender member ID
    SELECT "Id" INTO v_sender_member_id
    FROM "Members"
    WHERE "UserId" = p_user_id AND "IsDeleted" = false;

    IF v_sender_member_id IS NULL THEN
        RAISE EXCEPTION 'Sender member not found for user %', p_user_id;
    END IF;

    -- If recipient not provided, find it from property owner
    IF v_recipient_id IS NULL AND p_property_id IS NOT NULL THEN
        SELECT "OwnerId" INTO v_recipient_id
        FROM "EstateProperties"
        WHERE "Id" = p_property_id AND "IsDeleted" = false;

        IF v_recipient_id IS NULL THEN
            RAISE EXCEPTION 'Property owner not found for property %', p_property_id;
        END IF;
    END IF;

    IF v_recipient_id IS NULL THEN
        RAISE EXCEPTION 'Recipient ID must be provided or property ID must resolve to an owner';
    END IF;

    -- Validate property exists if provided
    IF p_property_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
            RAISE EXCEPTION 'Property not found: %', p_property_id;
        END IF;
    END IF;

    -- Determine thread
    IF v_thread_id IS NOT NULL THEN
        -- Use provided thread
        IF NOT EXISTS (SELECT 1 FROM "MessageThreads" WHERE "Id" = v_thread_id) THEN
            RAISE EXCEPTION 'Thread not found: %', v_thread_id;
        END IF;
    ELSIF p_in_reply_to_message_id IS NOT NULL THEN
        -- Reply to existing message
        SELECT "ThreadId" INTO v_thread_id
        FROM "Messages"
        WHERE "Id" = p_in_reply_to_message_id AND "IsDeleted" = false;

        IF v_thread_id IS NULL THEN
            RAISE EXCEPTION 'Message to reply to not found: %', p_in_reply_to_message_id;
        END IF;

        -- Mark the replied-to message as replied by recipient
        UPDATE "MessageRecipients"
        SET "HasBeenRepliedToByRecipient" = true
        WHERE "MessageId" = p_in_reply_to_message_id AND "RecipientId" = v_sender_member_id;

    ELSE
        -- Create new thread
        INSERT INTO "MessageThreads" ("Id", "Subject", "PropertyId", "CreatedAtUtc", "LastMessageAtUtc", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy")
        VALUES (gen_random_uuid(), p_subject, p_property_id, NOW(), NOW(), false, NOW(), NULL, NOW(), NULL)
        RETURNING "Id" INTO v_thread_id;
    END IF;

    -- Create message
    INSERT INTO "Messages" ("Id", "ThreadId", "SenderId", "Body", "Snippet", "CreatedAtUtc", "InReplyToMessageId", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy")
    VALUES (gen_random_uuid(), v_thread_id, v_sender_member_id, p_body, generate_message_snippet(p_body), NOW(), p_in_reply_to_message_id, false, NOW(), NULL, NOW(), NULL)
    RETURNING "Id" INTO v_message_id;

    -- Create message recipient entry
    INSERT INTO "MessageRecipients" ("Id", "MessageId", "RecipientId", "ReceivedAtUtc", "IsRead", "HasBeenRepliedToByRecipient", "IsStarred", "IsArchived", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy")
    VALUES (gen_random_uuid(), v_message_id, v_recipient_id, NOW(), false, false, false, false, false, NOW(), NULL, NOW(), NULL)
    RETURNING "Id" INTO v_recipient_entry_id;

    -- Update thread last message time
    UPDATE "MessageThreads"
    SET "LastMessageAtUtc" = NOW()
    WHERE "Id" = v_thread_id;

    -- Return created message details
    SELECT jsonb_build_object(
        'id', m."Id",
        'threadId', m."ThreadId",
        'senderId', m."SenderId",
        'recipientId', v_recipient_id,
        'propertyId', mt."PropertyId",
        'propertyTitle', ep."Title",
        'subject', mt."Subject",
        'snippet', m."Snippet",
        'createdAt', m."CreatedAtUtc",
        'isRead', false,
        'isReplied', false,
        'isStarred', false,
        'isArchived', false
    ) INTO v_created_message
    FROM "Messages" m
    JOIN "MessageThreads" mt ON mt."Id" = m."ThreadId"
    LEFT JOIN "EstateProperties" ep ON ep."Id" = mt."PropertyId"
    WHERE m."Id" = v_message_id;

    RETURN v_created_message;
END;
$$;


ALTER FUNCTION "public"."send_message"("p_user_id" "uuid", "p_subject" "text", "p_body" "text", "p_recipient_id" "uuid", "p_property_id" "uuid", "p_in_reply_to_message_id" "uuid", "p_thread_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_estate_property"("p_property_id" "text", "p_user_id" "text", "p_street_name" "text" DEFAULT NULL::"text", "p_house_number" "text" DEFAULT NULL::"text", "p_neighborhood" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_state" "text" DEFAULT NULL::"text", "p_zip_code" "text" DEFAULT NULL::"text", "p_country" "text" DEFAULT NULL::"text", "p_location_lat" double precision DEFAULT NULL::double precision, "p_location_lng" double precision DEFAULT NULL::double precision, "p_title" "text" DEFAULT NULL::"text", "p_property_type" integer DEFAULT NULL::integer, "p_area_value" double precision DEFAULT NULL::double precision, "p_area_unit" integer DEFAULT NULL::integer, "p_bedrooms" integer DEFAULT NULL::integer, "p_bathrooms" integer DEFAULT NULL::integer, "p_has_garage" boolean DEFAULT NULL::boolean, "p_garage_spaces" integer DEFAULT NULL::integer, "p_are_pets_allowed" boolean DEFAULT NULL::boolean, "p_capacity" integer DEFAULT NULL::integer, "p_description" "text" DEFAULT NULL::"text", "p_available_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_currency" integer DEFAULT NULL::integer, "p_sale_price" double precision DEFAULT NULL::double precision, "p_rent_price" double precision DEFAULT NULL::double precision, "p_has_common_expenses" boolean DEFAULT NULL::boolean, "p_common_expenses_value" double precision DEFAULT NULL::double precision, "p_is_electricity_included" boolean DEFAULT NULL::boolean, "p_is_water_included" boolean DEFAULT NULL::boolean, "p_is_price_visible" boolean DEFAULT NULL::boolean, "p_status" integer DEFAULT NULL::integer, "p_is_active" boolean DEFAULT NULL::boolean, "p_is_property_visible" boolean DEFAULT NULL::boolean, "p_property_images" "jsonb" DEFAULT NULL::"jsonb", "p_property_documents" "jsonb" DEFAULT NULL::"jsonb", "p_property_videos" "jsonb" DEFAULT NULL::"jsonb", "p_amenity_ids" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
            "Type" = COALESCE(p_property_type, "Type"),
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
            'type', CASE ep."Type"
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


ALTER FUNCTION "public"."update_estate_property"("p_property_id" "text", "p_user_id" "text", "p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Amenities" (
    "Id" "uuid" NOT NULL,
    "Name" "text",
    "IconId" "text",
    "IsDeleted" boolean NOT NULL
);


ALTER TABLE "public"."Amenities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."BillingHistories" (
    "Id" "uuid" NOT NULL,
    "SubscriptionId" "uuid" NOT NULL,
    "ProviderInvoiceId" character varying(255),
    "Amount" numeric NOT NULL,
    "Currency" character varying(10) NOT NULL,
    "Status" integer NOT NULL,
    "PaidAt" timestamp with time zone,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."BillingHistories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Companies" (
    "Id" "uuid" NOT NULL,
    "Name" character varying(200) NOT NULL,
    "BillingContactUserId" "uuid" NOT NULL,
    "BillingEmail" character varying(255) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "LogoUrl" character varying(2048),
    "BannerUrl" character varying(2048),
    "Description" character varying(500),
    "Street" character varying(255),
    "Street2" character varying(255),
    "City" character varying(100),
    "State" character varying(100),
    "PostalCode" character varying(20),
    "Country" character varying(100),
    "Phone" character varying(50),
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."Companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EstateProperties" (
    "Id" "uuid" NOT NULL,
    "StreetName" character varying(255),
    "HouseNumber" character varying(25),
    "Neighborhood" character varying(100),
    "City" character varying(100),
    "State" character varying(100),
    "ZipCode" character varying(20),
    "Country" character varying(100),
    "LocationLatitude" numeric NOT NULL,
    "LocationLongitude" numeric NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Type" integer NOT NULL,
    "AreaValue" numeric NOT NULL,
    "AreaUnit" integer NOT NULL,
    "Bedrooms" integer NOT NULL,
    "Bathrooms" integer NOT NULL,
    "HasGarage" boolean NOT NULL,
    "GarageSpaces" integer NOT NULL,
    "Visits" integer,
    "MainImageId" "uuid",
    "OwnerId" "uuid",
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."EstateProperties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EstatePropertyAmenity" (
    "EstatePropertyId" "uuid" NOT NULL,
    "AmenityId" "uuid" NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "DeletedAtUtc" timestamp with time zone
);


ALTER TABLE "public"."EstatePropertyAmenity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."EstatePropertyValues" (
    "Id" "uuid" NOT NULL,
    "Description" character varying(1000),
    "AvailableFrom" timestamp with time zone NOT NULL,
    "Capacity" integer NOT NULL,
    "Currency" integer NOT NULL,
    "SalePrice" numeric,
    "RentPrice" numeric,
    "HasCommonExpenses" boolean NOT NULL,
    "CommonExpensesValue" numeric,
    "IsElectricityIncluded" boolean,
    "IsWaterIncluded" boolean,
    "IsPriceVisible" boolean NOT NULL,
    "Status" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "IsPropertyVisible" boolean NOT NULL,
    "IsFeatured" boolean NOT NULL,
    "EstatePropertyId" "uuid" NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."EstatePropertyValues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Favorites" (
    "MemberId" "uuid" NOT NULL,
    "EstatePropertyId" "uuid" NOT NULL,
    "FavoritedAt" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."Favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MemberSubscriptions" (
    "Id" "uuid" NOT NULL,
    "isActive" boolean NOT NULL,
    "ExpiresAtUtc" timestamp with time zone,
    "SubscriptionTier" integer NOT NULL,
    "MemberId" "uuid" NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."MemberSubscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Members" (
    "Id" "uuid" NOT NULL,
    "UserId" "uuid" NOT NULL,
    "FirstName" character varying(100),
    "LastName" character varying(100),
    "Title" character varying(100),
    "AvatarUrl" character varying(2048),
    "Street" character varying(255),
    "Street2" character varying(255),
    "City" character varying(100),
    "State" character varying(100),
    "PostalCode" character varying(20),
    "Country" character varying(100),
    "MemberSubscriptionId" "uuid",
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text",
    "Phone" character varying(50),
    "Roles" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."Members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Members"."Phone" IS 'User phone number';



COMMENT ON COLUMN "public"."Members"."Roles" IS 'Array of global user roles';



CREATE TABLE IF NOT EXISTS "public"."MessageRecipients" (
    "Id" "uuid" NOT NULL,
    "MessageId" "uuid" NOT NULL,
    "RecipientId" "uuid" NOT NULL,
    "ReceivedAtUtc" timestamp with time zone NOT NULL,
    "IsRead" boolean NOT NULL,
    "HasBeenRepliedToByRecipient" boolean NOT NULL,
    "IsStarred" boolean NOT NULL,
    "IsArchived" boolean NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."MessageRecipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MessageThreads" (
    "Id" "uuid" NOT NULL,
    "Subject" character varying(255) NOT NULL,
    "PropertyId" "uuid",
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "LastMessageAtUtc" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."MessageThreads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Messages" (
    "Id" "uuid" NOT NULL,
    "ThreadId" "uuid" NOT NULL,
    "SenderId" "uuid" NOT NULL,
    "Body" "text" NOT NULL,
    "Snippet" character varying(200) NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "InReplyToMessageId" "uuid",
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."Messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Plans" (
    "Id" "uuid" NOT NULL,
    "Key" integer NOT NULL,
    "Name" character varying(200) NOT NULL,
    "MonthlyPrice" numeric NOT NULL,
    "Currency" character varying(10) NOT NULL,
    "MaxProperties" integer,
    "MaxUsers" integer,
    "MaxStorageMb" integer,
    "BillingCycle" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."Plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PropertyDocuments" (
    "Id" "uuid" NOT NULL,
    "Name" "text",
    "FileType" "text",
    "Url" "text",
    "EstatePropertyId" "uuid" NOT NULL,
    "IsPublic" boolean NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."PropertyDocuments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PropertyImages" (
    "Id" "uuid" NOT NULL,
    "Url" character varying(2048) NOT NULL,
    "AltText" character varying(255),
    "IsMain" boolean NOT NULL,
    "EstatePropertyId" "uuid" NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."PropertyImages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PropertyMessageLogs" (
    "Id" "uuid" NOT NULL,
    "PropertyId" "uuid" NOT NULL,
    "SentOnUtc" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."PropertyMessageLogs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PropertyVideos" (
    "Id" "uuid" NOT NULL,
    "Url" character varying(2048) NOT NULL,
    "Title" character varying(50),
    "Description" character varying(255),
    "EstatePropertyId" "uuid" NOT NULL,
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."PropertyVideos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."PropertyVisitLogs" (
    "Id" "uuid" NOT NULL,
    "PropertyId" "uuid" NOT NULL,
    "VisitedOnUtc" timestamp with time zone NOT NULL,
    "Source" character varying(50),
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."PropertyVisitLogs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RecoveryCodes" (
    "RecoveryCodeId" "uuid" NOT NULL,
    "Code" "text" NOT NULL,
    "UserId" "uuid" NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UsedAt" timestamp with time zone
);


ALTER TABLE "public"."RecoveryCodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Subscriptions" (
    "Id" "uuid" NOT NULL,
    "OwnerType" integer NOT NULL,
    "OwnerId" "uuid" NOT NULL,
    "ProviderCustomerId" character varying(255),
    "ProviderSubscriptionId" character varying(255),
    "PlanId" "uuid" NOT NULL,
    "Status" integer NOT NULL,
    "CurrentPeriodStart" timestamp with time zone NOT NULL,
    "CurrentPeriodEnd" timestamp with time zone NOT NULL,
    "CancelAtPeriodEnd" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    "CompanyId" "uuid",
    "IsDeleted" boolean NOT NULL,
    "Created" timestamp with time zone NOT NULL,
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL,
    "LastModifiedBy" "text"
);


ALTER TABLE "public"."Subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Usages" (
    "Id" "uuid" NOT NULL,
    "OwnerType" integer NOT NULL,
    "OwnerId" "uuid" NOT NULL,
    "PropertiesCount" integer NOT NULL,
    "StorageUsedMb" integer NOT NULL,
    "SnapshotAt" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL
);


ALTER TABLE "public"."Usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."UserCompanies" (
    "Id" "uuid" NOT NULL,
    "MemberId" "uuid" NOT NULL,
    "CompanyId" "uuid" NOT NULL,
    "Role" integer NOT NULL,
    "AddedBy" "uuid" NOT NULL,
    "JoinedAt" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL
);


ALTER TABLE "public"."UserCompanies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."WebhookEvents" (
    "Id" "uuid" NOT NULL,
    "ProviderEventId" character varying(255) NOT NULL,
    "EventType" character varying(100) NOT NULL,
    "Processed" boolean NOT NULL,
    "ProcessedAt" timestamp with time zone,
    "Created" timestamp with time zone NOT NULL,
    "IsDeleted" boolean NOT NULL
);


ALTER TABLE "public"."WebhookEvents" OWNER TO "postgres";


ALTER TABLE ONLY "public"."Amenities"
    ADD CONSTRAINT "PK_Amenities" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."BillingHistories"
    ADD CONSTRAINT "PK_BillingHistories" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."Companies"
    ADD CONSTRAINT "PK_Companies" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."EstateProperties"
    ADD CONSTRAINT "PK_EstateProperties" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."EstatePropertyAmenity"
    ADD CONSTRAINT "PK_EstatePropertyAmenity" PRIMARY KEY ("EstatePropertyId", "AmenityId");



ALTER TABLE ONLY "public"."EstatePropertyValues"
    ADD CONSTRAINT "PK_EstatePropertyValues" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."Favorites"
    ADD CONSTRAINT "PK_Favorites" PRIMARY KEY ("MemberId", "EstatePropertyId");



ALTER TABLE ONLY "public"."MemberSubscriptions"
    ADD CONSTRAINT "PK_MemberSubscriptions" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."Members"
    ADD CONSTRAINT "PK_Members" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."MessageRecipients"
    ADD CONSTRAINT "PK_MessageRecipients" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."MessageThreads"
    ADD CONSTRAINT "PK_MessageThreads" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."Messages"
    ADD CONSTRAINT "PK_Messages" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."Plans"
    ADD CONSTRAINT "PK_Plans" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."PropertyDocuments"
    ADD CONSTRAINT "PK_PropertyDocuments" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."PropertyImages"
    ADD CONSTRAINT "PK_PropertyImages" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."PropertyMessageLogs"
    ADD CONSTRAINT "PK_PropertyMessageLogs" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."PropertyVideos"
    ADD CONSTRAINT "PK_PropertyVideos" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."PropertyVisitLogs"
    ADD CONSTRAINT "PK_PropertyVisitLogs" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."RecoveryCodes"
    ADD CONSTRAINT "PK_RecoveryCodes" PRIMARY KEY ("RecoveryCodeId");



ALTER TABLE ONLY "public"."Subscriptions"
    ADD CONSTRAINT "PK_Subscriptions" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."Usages"
    ADD CONSTRAINT "PK_Usages" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."UserCompanies"
    ADD CONSTRAINT "PK_UserCompanies" PRIMARY KEY ("Id");



ALTER TABLE ONLY "public"."WebhookEvents"
    ADD CONSTRAINT "PK_WebhookEvents" PRIMARY KEY ("Id");



CREATE INDEX "IX_BillingHistories_ProviderInvoiceId" ON "public"."BillingHistories" USING "btree" ("ProviderInvoiceId");



CREATE INDEX "IX_BillingHistories_Status" ON "public"."BillingHistories" USING "btree" ("Status");



CREATE INDEX "IX_BillingHistories_SubscriptionId" ON "public"."BillingHistories" USING "btree" ("SubscriptionId");



CREATE INDEX "IX_Companies_BillingContactUserId" ON "public"."Companies" USING "btree" ("BillingContactUserId");



CREATE INDEX "IX_Companies_Name" ON "public"."Companies" USING "btree" ("Name");



CREATE INDEX "IX_EstateProperties_OwnerId" ON "public"."EstateProperties" USING "btree" ("OwnerId");



CREATE INDEX "IX_EstatePropertyAmenity_AmenityId" ON "public"."EstatePropertyAmenity" USING "btree" ("AmenityId");



CREATE INDEX "IX_EstatePropertyValues_EstatePropertyId" ON "public"."EstatePropertyValues" USING "btree" ("EstatePropertyId");



CREATE INDEX "IX_Favorites_EstatePropertyId" ON "public"."Favorites" USING "btree" ("EstatePropertyId");



CREATE UNIQUE INDEX "IX_Favorites_MemberId_EstatePropertyId" ON "public"."Favorites" USING "btree" ("MemberId", "EstatePropertyId");



CREATE UNIQUE INDEX "IX_MemberSubscriptions_MemberId" ON "public"."MemberSubscriptions" USING "btree" ("MemberId");



CREATE UNIQUE INDEX "IX_Members_UserId" ON "public"."Members" USING "btree" ("UserId");



CREATE INDEX "IX_MessageRecipients_MessageId" ON "public"."MessageRecipients" USING "btree" ("MessageId");



CREATE INDEX "IX_MessageRecipients_RecipientId_IsRead_IsArchived_IsDeleted" ON "public"."MessageRecipients" USING "btree" ("RecipientId", "IsRead", "IsArchived", "IsDeleted");



CREATE INDEX "IX_MessageRecipients_RecipientId_IsStarred_IsDeleted" ON "public"."MessageRecipients" USING "btree" ("RecipientId", "IsStarred", "IsDeleted");



CREATE INDEX "IX_MessageThreads_LastMessageAtUtc" ON "public"."MessageThreads" USING "btree" ("LastMessageAtUtc");



CREATE INDEX "IX_MessageThreads_PropertyId" ON "public"."MessageThreads" USING "btree" ("PropertyId");



CREATE INDEX "IX_Messages_CreatedAtUtc" ON "public"."Messages" USING "btree" ("CreatedAtUtc");



CREATE INDEX "IX_Messages_InReplyToMessageId" ON "public"."Messages" USING "btree" ("InReplyToMessageId");



CREATE INDEX "IX_Messages_SenderId" ON "public"."Messages" USING "btree" ("SenderId");



CREATE INDEX "IX_Messages_ThreadId" ON "public"."Messages" USING "btree" ("ThreadId");



CREATE INDEX "IX_Plans_IsActive" ON "public"."Plans" USING "btree" ("IsActive");



CREATE UNIQUE INDEX "IX_Plans_Key" ON "public"."Plans" USING "btree" ("Key");



CREATE INDEX "IX_PropertyDocuments_EstatePropertyId" ON "public"."PropertyDocuments" USING "btree" ("EstatePropertyId");



CREATE INDEX "IX_PropertyImages_EstatePropertyId" ON "public"."PropertyImages" USING "btree" ("EstatePropertyId");



CREATE INDEX "IX_PropertyMessageLogs_PropertyId" ON "public"."PropertyMessageLogs" USING "btree" ("PropertyId");



CREATE INDEX "IX_PropertyMessageLogs_SentOnUtc" ON "public"."PropertyMessageLogs" USING "btree" ("SentOnUtc");



CREATE INDEX "IX_PropertyVideos_EstatePropertyId" ON "public"."PropertyVideos" USING "btree" ("EstatePropertyId");



CREATE INDEX "IX_PropertyVisitLogs_PropertyId" ON "public"."PropertyVisitLogs" USING "btree" ("PropertyId");



CREATE INDEX "IX_PropertyVisitLogs_VisitedOnUtc" ON "public"."PropertyVisitLogs" USING "btree" ("VisitedOnUtc");



CREATE UNIQUE INDEX "IX_RecoveryCodes_Code" ON "public"."RecoveryCodes" USING "btree" ("Code");



CREATE INDEX "IX_RecoveryCodes_UserId" ON "public"."RecoveryCodes" USING "btree" ("UserId");



CREATE INDEX "IX_Subscriptions_CompanyId" ON "public"."Subscriptions" USING "btree" ("CompanyId");



CREATE INDEX "IX_Subscriptions_OwnerType_OwnerId" ON "public"."Subscriptions" USING "btree" ("OwnerType", "OwnerId");



CREATE INDEX "IX_Subscriptions_PlanId" ON "public"."Subscriptions" USING "btree" ("PlanId");



CREATE INDEX "IX_Subscriptions_ProviderSubscriptionId" ON "public"."Subscriptions" USING "btree" ("ProviderSubscriptionId");



CREATE INDEX "IX_Subscriptions_Status" ON "public"."Subscriptions" USING "btree" ("Status");



CREATE INDEX "IX_Usages_OwnerType_OwnerId_SnapshotAt" ON "public"."Usages" USING "btree" ("OwnerType", "OwnerId", "SnapshotAt");



CREATE INDEX "IX_Usages_SnapshotAt" ON "public"."Usages" USING "btree" ("SnapshotAt");



CREATE INDEX "IX_UserCompanies_CompanyId" ON "public"."UserCompanies" USING "btree" ("CompanyId");



CREATE INDEX "IX_UserCompanies_MemberId" ON "public"."UserCompanies" USING "btree" ("MemberId");



CREATE UNIQUE INDEX "IX_UserCompanies_MemberId_CompanyId" ON "public"."UserCompanies" USING "btree" ("MemberId", "CompanyId");



CREATE INDEX "IX_WebhookEvents_EventType" ON "public"."WebhookEvents" USING "btree" ("EventType");



CREATE INDEX "IX_WebhookEvents_Processed" ON "public"."WebhookEvents" USING "btree" ("Processed");



CREATE UNIQUE INDEX "IX_WebhookEvents_ProviderEventId" ON "public"."WebhookEvents" USING "btree" ("ProviderEventId");



ALTER TABLE ONLY "public"."BillingHistories"
    ADD CONSTRAINT "FK_BillingHistories_Subscriptions_SubscriptionId" FOREIGN KEY ("SubscriptionId") REFERENCES "public"."Subscriptions"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EstateProperties"
    ADD CONSTRAINT "FK_EstateProperties_Members_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES "public"."Members"("Id");



ALTER TABLE ONLY "public"."EstatePropertyAmenity"
    ADD CONSTRAINT "FK_EstatePropertyAmenity_Amenities_AmenityId" FOREIGN KEY ("AmenityId") REFERENCES "public"."Amenities"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EstatePropertyAmenity"
    ADD CONSTRAINT "FK_EstatePropertyAmenity_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EstatePropertyValues"
    ADD CONSTRAINT "FK_EstatePropertyValues_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Favorites"
    ADD CONSTRAINT "FK_Favorites_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Favorites"
    ADD CONSTRAINT "FK_Favorites_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MemberSubscriptions"
    ADD CONSTRAINT "FK_MemberSubscriptions_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MessageRecipients"
    ADD CONSTRAINT "FK_MessageRecipients_Members_RecipientId" FOREIGN KEY ("RecipientId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MessageRecipients"
    ADD CONSTRAINT "FK_MessageRecipients_Messages_MessageId" FOREIGN KEY ("MessageId") REFERENCES "public"."Messages"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."MessageThreads"
    ADD CONSTRAINT "FK_MessageThreads_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "public"."EstateProperties"("Id");



ALTER TABLE ONLY "public"."Messages"
    ADD CONSTRAINT "FK_Messages_Members_SenderId" FOREIGN KEY ("SenderId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Messages"
    ADD CONSTRAINT "FK_Messages_MessageThreads_ThreadId" FOREIGN KEY ("ThreadId") REFERENCES "public"."MessageThreads"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Messages"
    ADD CONSTRAINT "FK_Messages_Messages_InReplyToMessageId" FOREIGN KEY ("InReplyToMessageId") REFERENCES "public"."Messages"("Id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."PropertyDocuments"
    ADD CONSTRAINT "FK_PropertyDocuments_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PropertyImages"
    ADD CONSTRAINT "FK_PropertyImages_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PropertyMessageLogs"
    ADD CONSTRAINT "FK_PropertyMessageLogs_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PropertyVideos"
    ADD CONSTRAINT "FK_PropertyVideos_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."PropertyVisitLogs"
    ADD CONSTRAINT "FK_PropertyVisitLogs_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Subscriptions"
    ADD CONSTRAINT "FK_Subscriptions_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "public"."Companies"("Id");



ALTER TABLE ONLY "public"."Subscriptions"
    ADD CONSTRAINT "FK_Subscriptions_Plans_PlanId" FOREIGN KEY ("PlanId") REFERENCES "public"."Plans"("Id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."UserCompanies"
    ADD CONSTRAINT "FK_UserCompanies_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "public"."Companies"("Id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Members"
    ADD CONSTRAINT "Members_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."EstateProperties"
    ADD CONSTRAINT "fk_estateproperties_ownerid" FOREIGN KEY ("OwnerId") REFERENCES "public"."Companies"("Id");



ALTER TABLE ONLY "public"."UserCompanies"
    ADD CONSTRAINT "fk_usercompanies_companyid" FOREIGN KEY ("CompanyId") REFERENCES "public"."Companies"("Id");



ALTER TABLE ONLY "public"."UserCompanies"
    ADD CONSTRAINT "fk_usercompanies_memberid" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id");



ALTER TABLE "public"."Members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can update their own member record" ON "public"."Members" FOR UPDATE USING (("auth"."uid"() = "UserId"));



CREATE POLICY "Users can view their own member record" ON "public"."Members" FOR SELECT USING (("auth"."uid"() = "UserId"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."calculate_conversion_stat"("current_messages" bigint, "current_visits" bigint, "previous_messages" bigint, "previous_visits" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_conversion_stat"("current_messages" bigint, "current_visits" bigint, "previous_messages" bigint, "previous_visits" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_conversion_stat"("current_messages" bigint, "current_visits" bigint, "previous_messages" bigint, "previous_visits" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_stat"("current_val" bigint, "previous_val" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_stat"("current_val" bigint, "previous_val" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_stat"("current_val" bigint, "previous_val" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_estate_property"("p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb", "p_owner_member_id" "uuid", "p_owner_company_id" "uuid", "p_owner_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_estate_property"("p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb", "p_owner_member_id" "uuid", "p_owner_company_id" "uuid", "p_owner_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_estate_property"("p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb", "p_owner_member_id" "uuid", "p_owner_company_id" "uuid", "p_owner_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."duplicate_estate_property"("p_original_property_id" "text", "p_user_id" "text", "p_new_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_estate_property"("p_original_property_id" "text", "p_user_id" "text", "p_new_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_estate_property"("p_original_property_id" "text", "p_user_id" "text", "p_new_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_message_snippet"("text_body" "text", "max_length" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_message_snippet"("text_body" "text", "max_length" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_message_snippet"("text_body" "text", "max_length" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_period" "text", "p_company_id" "text", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_period" "text", "p_company_id" "text", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_period" "text", "p_company_id" "text", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_message_by_id"("p_message_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_message_by_id"("p_message_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_message_by_id"("p_message_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_message_counts"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_message_counts"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_message_counts"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_messages"("p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_filter" "text", "p_query" "text", "p_property_id" "uuid", "p_sort_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_messages"("p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_filter" "text", "p_query" "text", "p_property_id" "uuid", "p_sort_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_messages"("p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_filter" "text", "p_query" "text", "p_property_id" "uuid", "p_sort_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_messages_by_property_id"("p_property_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_messages_by_property_id"("p_property_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_messages_by_property_id"("p_property_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_messages_by_thread_id"("p_thread_id" "uuid", "p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_sort_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_messages_by_thread_id"("p_thread_id" "uuid", "p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_sort_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_messages_by_thread_id"("p_thread_id" "uuid", "p_user_id" "uuid", "p_page" integer, "p_limit" integer, "p_sort_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_visits_by_property"("p_period" "text", "p_page" integer, "p_limit" integer, "p_company_id" "text", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_visits_by_property"("p_period" "text", "p_page" integer, "p_limit" integer, "p_company_id" "text", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_visits_by_property"("p_period" "text", "p_page" integer, "p_limit" integer, "p_company_id" "text", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_period"("p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_period"("p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_period"("p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_message"("p_user_id" "uuid", "p_subject" "text", "p_body" "text", "p_recipient_id" "uuid", "p_property_id" "uuid", "p_in_reply_to_message_id" "uuid", "p_thread_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_message"("p_user_id" "uuid", "p_subject" "text", "p_body" "text", "p_recipient_id" "uuid", "p_property_id" "uuid", "p_in_reply_to_message_id" "uuid", "p_thread_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_message"("p_user_id" "uuid", "p_subject" "text", "p_body" "text", "p_recipient_id" "uuid", "p_property_id" "uuid", "p_in_reply_to_message_id" "uuid", "p_thread_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_estate_property"("p_property_id" "text", "p_user_id" "text", "p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_estate_property"("p_property_id" "text", "p_user_id" "text", "p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_estate_property"("p_property_id" "text", "p_user_id" "text", "p_street_name" "text", "p_house_number" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_zip_code" "text", "p_country" "text", "p_location_lat" double precision, "p_location_lng" double precision, "p_title" "text", "p_property_type" integer, "p_area_value" double precision, "p_area_unit" integer, "p_bedrooms" integer, "p_bathrooms" integer, "p_has_garage" boolean, "p_garage_spaces" integer, "p_are_pets_allowed" boolean, "p_capacity" integer, "p_description" "text", "p_available_from" timestamp with time zone, "p_currency" integer, "p_sale_price" double precision, "p_rent_price" double precision, "p_has_common_expenses" boolean, "p_common_expenses_value" double precision, "p_is_electricity_included" boolean, "p_is_water_included" boolean, "p_is_price_visible" boolean, "p_status" integer, "p_is_active" boolean, "p_is_property_visible" boolean, "p_property_images" "jsonb", "p_property_documents" "jsonb", "p_property_videos" "jsonb", "p_amenity_ids" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."Amenities" TO "anon";
GRANT ALL ON TABLE "public"."Amenities" TO "authenticated";
GRANT ALL ON TABLE "public"."Amenities" TO "service_role";



GRANT ALL ON TABLE "public"."BillingHistories" TO "anon";
GRANT ALL ON TABLE "public"."BillingHistories" TO "authenticated";
GRANT ALL ON TABLE "public"."BillingHistories" TO "service_role";



GRANT ALL ON TABLE "public"."Companies" TO "anon";
GRANT ALL ON TABLE "public"."Companies" TO "authenticated";
GRANT ALL ON TABLE "public"."Companies" TO "service_role";



GRANT ALL ON TABLE "public"."EstateProperties" TO "anon";
GRANT ALL ON TABLE "public"."EstateProperties" TO "authenticated";
GRANT ALL ON TABLE "public"."EstateProperties" TO "service_role";



GRANT ALL ON TABLE "public"."EstatePropertyAmenity" TO "anon";
GRANT ALL ON TABLE "public"."EstatePropertyAmenity" TO "authenticated";
GRANT ALL ON TABLE "public"."EstatePropertyAmenity" TO "service_role";



GRANT ALL ON TABLE "public"."EstatePropertyValues" TO "anon";
GRANT ALL ON TABLE "public"."EstatePropertyValues" TO "authenticated";
GRANT ALL ON TABLE "public"."EstatePropertyValues" TO "service_role";



GRANT ALL ON TABLE "public"."Favorites" TO "anon";
GRANT ALL ON TABLE "public"."Favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."Favorites" TO "service_role";



GRANT ALL ON TABLE "public"."MemberSubscriptions" TO "anon";
GRANT ALL ON TABLE "public"."MemberSubscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."MemberSubscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."Members" TO "anon";
GRANT ALL ON TABLE "public"."Members" TO "authenticated";
GRANT ALL ON TABLE "public"."Members" TO "service_role";



GRANT ALL ON TABLE "public"."MessageRecipients" TO "anon";
GRANT ALL ON TABLE "public"."MessageRecipients" TO "authenticated";
GRANT ALL ON TABLE "public"."MessageRecipients" TO "service_role";



GRANT ALL ON TABLE "public"."MessageThreads" TO "anon";
GRANT ALL ON TABLE "public"."MessageThreads" TO "authenticated";
GRANT ALL ON TABLE "public"."MessageThreads" TO "service_role";



GRANT ALL ON TABLE "public"."Messages" TO "anon";
GRANT ALL ON TABLE "public"."Messages" TO "authenticated";
GRANT ALL ON TABLE "public"."Messages" TO "service_role";



GRANT ALL ON TABLE "public"."Plans" TO "anon";
GRANT ALL ON TABLE "public"."Plans" TO "authenticated";
GRANT ALL ON TABLE "public"."Plans" TO "service_role";



GRANT ALL ON TABLE "public"."PropertyDocuments" TO "anon";
GRANT ALL ON TABLE "public"."PropertyDocuments" TO "authenticated";
GRANT ALL ON TABLE "public"."PropertyDocuments" TO "service_role";



GRANT ALL ON TABLE "public"."PropertyImages" TO "anon";
GRANT ALL ON TABLE "public"."PropertyImages" TO "authenticated";
GRANT ALL ON TABLE "public"."PropertyImages" TO "service_role";



GRANT ALL ON TABLE "public"."PropertyMessageLogs" TO "anon";
GRANT ALL ON TABLE "public"."PropertyMessageLogs" TO "authenticated";
GRANT ALL ON TABLE "public"."PropertyMessageLogs" TO "service_role";



GRANT ALL ON TABLE "public"."PropertyVideos" TO "anon";
GRANT ALL ON TABLE "public"."PropertyVideos" TO "authenticated";
GRANT ALL ON TABLE "public"."PropertyVideos" TO "service_role";



GRANT ALL ON TABLE "public"."PropertyVisitLogs" TO "anon";
GRANT ALL ON TABLE "public"."PropertyVisitLogs" TO "authenticated";
GRANT ALL ON TABLE "public"."PropertyVisitLogs" TO "service_role";



GRANT ALL ON TABLE "public"."RecoveryCodes" TO "anon";
GRANT ALL ON TABLE "public"."RecoveryCodes" TO "authenticated";
GRANT ALL ON TABLE "public"."RecoveryCodes" TO "service_role";



GRANT ALL ON TABLE "public"."Subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."Subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."Subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."Usages" TO "anon";
GRANT ALL ON TABLE "public"."Usages" TO "authenticated";
GRANT ALL ON TABLE "public"."Usages" TO "service_role";



GRANT ALL ON TABLE "public"."UserCompanies" TO "anon";
GRANT ALL ON TABLE "public"."UserCompanies" TO "authenticated";
GRANT ALL ON TABLE "public"."UserCompanies" TO "service_role";



GRANT ALL ON TABLE "public"."WebhookEvents" TO "anon";
GRANT ALL ON TABLE "public"."WebhookEvents" TO "authenticated";
GRANT ALL ON TABLE "public"."WebhookEvents" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


