-- Admin Property Management System Migration
-- Creates functions for managing property listings, moderation, and statistics

-- Property moderation actions table
CREATE TABLE IF NOT EXISTS "public"."PropertyModerationActions" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "PropertyId" "uuid" NOT NULL,
    "ActionType" character varying(50) NOT NULL CHECK ("ActionType" IN ('hide', 'mark_invalid', 'mark_spam', 'delete')),
    "Reason" "text",
    "PerformedBy" "uuid" NOT NULL,
    "PerformedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_PropertyModerationActions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PropertyModerationActions_EstateProperties_PropertyId" FOREIGN KEY ("PropertyId") REFERENCES "public"."EstateProperties" ("Id") ON DELETE CASCADE
);

-- Function to get admin properties list with filters and pagination
CREATE OR REPLACE FUNCTION get_admin_properties_list(
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 20,
    p_user_id uuid DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_location text DEFAULT NULL,
    p_search text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title character varying(200),
    owner_name text,
    owner_email character varying,
    city character varying(100),
    state character varying(100),
    status integer,
    is_active boolean,
    is_property_visible boolean,
    created timestamp with time zone,
    last_modified timestamp with time zone,
    total_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_properties AS (
        SELECT
            ep."Id",
            ep."Title",
            CASE
                WHEN o."OwnerType" = 'member' THEN CONCAT(m."FirstName", ' ', m."LastName")
                WHEN o."OwnerType" = 'company' THEN c."Name"
                ELSE 'Unknown Owner'
            END as owner_name,
            CASE
                WHEN o."OwnerType" = 'member' THEN m."Email"
                WHEN o."OwnerType" = 'company' THEN c."BillingEmail"
                ELSE NULL
            END as owner_email,
            ep."City",
            ep."State",
            epv."Status",
            epv."IsActive",
            epv."IsPropertyVisible",
            ep."Created",
            ep."LastModified"
        FROM "EstateProperties" ep
        JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
        JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
        LEFT JOIN "Members" m ON o."OwnerType" = 'member' AND o."MemberId" = m."Id" AND m."IsDeleted" = false
        LEFT JOIN "Companies" c ON o."OwnerType" = 'company' AND o."CompanyId" = c."Id" AND c."IsDeleted" = false
        WHERE ep."IsDeleted" = false
        AND (p_user_id IS NULL OR (
            (o."OwnerType" = 'member' AND o."MemberId" = p_user_id) OR
            (o."OwnerType" = 'company' AND EXISTS (
                SELECT 1 FROM "UserCompanies" uc
                WHERE uc."CompanyId" = o."CompanyId"
                AND uc."MemberId" = p_user_id
                AND uc."IsDeleted" = false
            ))
        ))
        AND (p_status IS NULL OR epv."Status" = CASE
            WHEN p_status = 'sale' THEN 0
            WHEN p_status = 'rent' THEN 1
            WHEN p_status = 'reserved' THEN 2
            WHEN p_status = 'sold' THEN 3
            WHEN p_status = 'unavailable' THEN 4
            ELSE epv."Status"
        END)
        AND (p_location IS NULL OR
             ep."City" ILIKE '%' || p_location || '%' OR
             ep."State" ILIKE '%' || p_location || '%' OR
             CONCAT(ep."City", ', ', ep."State") ILIKE '%' || p_location || '%')
        AND (p_search IS NULL OR
             ep."Title" ILIKE '%' || p_search || '%' OR
             CASE
                 WHEN o."OwnerType" = 'member' THEN CONCAT(m."FirstName", ' ', m."LastName")
                 WHEN o."OwnerType" = 'company' THEN c."Name"
                 ELSE ''
             END ILIKE '%' || p_search || '%' OR
             ep."City" ILIKE '%' || p_search || '%' OR
             ep."State" ILIKE '%' || p_search || '%')
        ORDER BY ep."Created" DESC
    ),
    total_count AS (
        SELECT COUNT(*) as count FROM filtered_properties
    )
    SELECT
        fp.id,
        fp.title,
        fp.owner_name,
        fp.owner_email,
        fp.city,
        fp.state,
        fp.status,
        fp.is_active,
        fp.is_property_visible,
        fp.created,
        fp.last_modified,
        tc.count as total_count
    FROM filtered_properties fp
    CROSS JOIN total_count tc
    LIMIT p_limit
    OFFSET ((p_page - 1) * p_limit);
END;
$$;

-- Function to get property statistics for admin dashboard
CREATE OR REPLACE FUNCTION get_admin_property_statistics()
RETURNS TABLE (
    total_properties bigint,
    incomplete_properties bigint,
    never_published bigint,
    active_properties bigint,
    archived_properties bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM "EstateProperties" WHERE "IsDeleted" = false) as total_properties,
        (SELECT COUNT(*)
         FROM "EstateProperties" ep
         JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
         WHERE ep."IsDeleted" = false
         AND epv."IsActive" = false) as incomplete_properties,
        (SELECT COUNT(*)
         FROM "EstateProperties" ep
         JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
         WHERE ep."IsDeleted" = false
         AND epv."IsPropertyVisible" = false
         AND epv."IsActive" = true) as never_published,
        (SELECT COUNT(*)
         FROM "EstateProperties" ep
         JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
         WHERE ep."IsDeleted" = false
         AND epv."IsPropertyVisible" = true
         AND epv."IsActive" = true) as active_properties,
        (SELECT COUNT(*)
         FROM "EstateProperties" ep
         JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
         WHERE ep."IsDeleted" = false
         AND epv."IsActive" = false
         AND epv."IsPropertyVisible" = false) as archived_properties;
END;
$$;

-- Function to get detailed property information for admin
CREATE OR REPLACE FUNCTION get_admin_property_detail(p_property_id uuid)
RETURNS TABLE (
    id uuid,
    title character varying(200),
    street_name character varying(255),
    house_number character varying(25),
    neighborhood character varying(100),
    city character varying(100),
    state character varying(100),
    zip_code character varying(20),
    country character varying(100),
    location_latitude numeric,
    location_longitude numeric,
    type integer,
    area_value numeric,
    area_unit integer,
    bedrooms integer,
    bathrooms integer,
    has_garage boolean,
    garage_spaces integer,
    description character varying(1000),
    available_from timestamp with time zone,
    capacity integer,
    currency integer,
    sale_price numeric,
    rent_price numeric,
    has_common_expenses boolean,
    common_expenses_value numeric,
    is_electricity_included boolean,
    is_water_included boolean,
    is_price_visible boolean,
    status integer,
    is_active boolean,
    is_property_visible boolean,
    is_featured boolean,
    owner_id uuid,
    owner_name text,
    owner_email character varying,
    created timestamp with time zone,
    last_modified timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ep."Id",
        ep."Title",
        ep."StreetName",
        ep."HouseNumber",
        ep."Neighborhood",
        ep."City",
        ep."State",
        ep."ZipCode",
        ep."Country",
        ep."LocationLatitude",
        ep."LocationLongitude",
        ep."Type",
        ep."AreaValue",
        ep."AreaUnit",
        ep."Bedrooms",
        ep."Bathrooms",
        ep."HasGarage",
        ep."GarageSpaces",
        epv."Description",
        epv."AvailableFrom",
        epv."Capacity",
        epv."Currency",
        epv."SalePrice",
        epv."RentPrice",
        epv."HasCommonExpenses",
        epv."CommonExpensesValue",
        epv."IsElectricityIncluded",
        epv."IsWaterIncluded",
        epv."IsPriceVisible",
        epv."Status",
        epv."IsActive",
        epv."IsPropertyVisible",
        epv."IsFeatured",
        ep."OwnerId",
        CASE
            WHEN o."OwnerType" = 'member' THEN CONCAT(m."FirstName", ' ', m."LastName")
            WHEN o."OwnerType" = 'company' THEN c."Name"
            ELSE 'Unknown Owner'
        END as owner_name,
        CASE
            WHEN o."OwnerType" = 'member' THEN m."Email"
            WHEN o."OwnerType" = 'company' THEN c."BillingEmail"
            ELSE NULL
        END as owner_email,
        ep."Created",
        ep."LastModified"
    FROM "EstateProperties" ep
    JOIN "EstatePropertyValues" epv ON ep."Id" = epv."EstatePropertyId" AND epv."IsDeleted" = false
    JOIN "Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
    LEFT JOIN "Members" m ON o."OwnerType" = 'member' AND o."MemberId" = m."Id" AND m."IsDeleted" = false
    LEFT JOIN "Companies" c ON o."OwnerType" = 'company' AND o."CompanyId" = c."Id" AND c."IsDeleted" = false
    WHERE ep."Id" = p_property_id AND ep."IsDeleted" = false;
END;
$$;

-- Function to hide a property (set IsPropertyVisible = false)
CREATE OR REPLACE FUNCTION admin_hide_property(
    p_property_id uuid,
    p_reason text DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id uuid;
BEGIN
    -- Get current user ID (this would typically come from auth context)
    v_current_user_id := auth.uid();

    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    -- Update property visibility
    UPDATE "EstatePropertyValues"
    SET
        "IsPropertyVisible" = false,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id
    WHERE "EstatePropertyId" = p_property_id AND "IsDeleted" = false;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Property not found or already hidden';
        RETURN;
    END IF;

    -- Log the moderation action
    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        'hide',
        p_reason,
        v_current_user_id,
        now()
    );

    RETURN QUERY SELECT true, 'Property hidden successfully';
END;
$$;

-- Function to mark property as invalid/spam
CREATE OR REPLACE FUNCTION admin_mark_property_invalid(
    p_property_id uuid,
    p_reason text,
    p_mark_as_spam boolean DEFAULT false
)
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id uuid;
    v_action_type text;
BEGIN
    -- Get current user ID
    v_current_user_id := auth.uid();

    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    -- Determine action type
    v_action_type := CASE WHEN p_mark_as_spam THEN 'mark_spam' ELSE 'mark_invalid' END;

    -- Update property status to unavailable and hide it
    UPDATE "EstatePropertyValues"
    SET
        "Status" = 4, -- unavailable
        "IsPropertyVisible" = false,
        "IsActive" = false,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id
    WHERE "EstatePropertyId" = p_property_id AND "IsDeleted" = false;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Property not found';
        RETURN;
    END IF;

    -- Log the moderation action
    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        v_action_type,
        p_reason,
        v_current_user_id,
        now()
    );

    RETURN QUERY SELECT true, CASE WHEN p_mark_as_spam THEN 'Property marked as spam' ELSE 'Property marked as invalid' END;
END;
$$;

-- Function to delete property (hard delete for emergencies)
CREATE OR REPLACE FUNCTION admin_delete_property(
    p_property_id uuid,
    p_reason text
)
RETURNS TABLE (
    success boolean,
    message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id uuid;
BEGIN
    -- Get current user ID
    v_current_user_id := auth.uid();

    IF v_current_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'User not authenticated';
        RETURN;
    END IF;

    -- Check if property exists and is not already deleted
    IF NOT EXISTS (SELECT 1 FROM "EstateProperties" WHERE "Id" = p_property_id AND "IsDeleted" = false) THEN
        RETURN QUERY SELECT false, 'Property not found or already deleted';
        RETURN;
    END IF;

    -- Log the moderation action before deletion
    INSERT INTO "PropertyModerationActions" (
        "PropertyId",
        "ActionType",
        "Reason",
        "PerformedBy",
        "PerformedAt"
    ) VALUES (
        p_property_id,
        'delete',
        p_reason,
        v_current_user_id,
        now()
    );

    -- Soft delete the property values first
    UPDATE "EstatePropertyValues"
    SET
        "IsDeleted" = true,
        "LastModified" = now(),
        "LastModifiedBy" = v_current_user_id
    WHERE "EstatePropertyId" = p_property_id;

    -- Hard delete the main property record (as specified for emergencies)
    DELETE FROM "EstateProperties" WHERE "Id" = p_property_id;

    RETURN QUERY SELECT true, 'Property permanently deleted';
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "IX_PropertyModerationActions_PropertyId" ON "PropertyModerationActions" ("PropertyId");
CREATE INDEX IF NOT EXISTS "IX_PropertyModerationActions_PerformedBy" ON "PropertyModerationActions" ("PerformedBy");
CREATE INDEX IF NOT EXISTS "IX_PropertyModerationActions_PerformedAt" ON "PropertyModerationActions" ("PerformedAt");

-- Enable RLS on the new table
ALTER TABLE "PropertyModerationActions" ENABLE ROW LEVEL SECURITY;

-- RLS policies for PropertyModerationActions
CREATE POLICY "Admins can view all property moderation actions" ON "PropertyModerationActions"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "Members" m
            WHERE m."UserId" = auth.uid()
            AND m."IsDeleted" = false
            AND m."Role" = 'admin'
        )
    );

CREATE POLICY "Admins can insert property moderation actions" ON "PropertyModerationActions"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Members" m
            WHERE m."UserId" = auth.uid()
            AND m."IsDeleted" = false
            AND m."Role" = 'admin'
        )
    );
