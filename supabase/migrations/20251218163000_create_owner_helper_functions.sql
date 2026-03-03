-- Helper functions for working with the Owners table

-- Function to get or create an owner record
-- Returns the Owner.Id for the specified member or company
CREATE OR REPLACE FUNCTION get_or_create_owner(
    p_member_id uuid DEFAULT NULL,
    p_company_id uuid DEFAULT NULL,
    p_owner_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id uuid;
    v_actual_owner_type text;
BEGIN
    -- Determine owner type if not provided
    IF p_owner_type IS NULL THEN
        IF p_member_id IS NOT NULL AND p_company_id IS NULL THEN
            v_actual_owner_type := 'member';
        ELSIF p_company_id IS NOT NULL AND p_member_id IS NULL THEN
            v_actual_owner_type := 'company';
        ELSE
            RAISE EXCEPTION 'Invalid owner parameters: must provide either member_id or company_id, but not both';
        END IF;
    ELSE
        v_actual_owner_type := p_owner_type;
    END IF;

    -- Validate parameters based on owner type
    IF v_actual_owner_type = 'member' AND p_member_id IS NULL THEN
        RAISE EXCEPTION 'member_id is required for member owner type';
    END IF;

    IF v_actual_owner_type = 'company' AND p_company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required for company owner type';
    END IF;

    -- Check if owner already exists
    SELECT "Id" INTO v_owner_id
    FROM "public"."Owners"
    WHERE "IsDeleted" = false
    AND (
        ("OwnerType" = 'member' AND "MemberId" = p_member_id) OR
        ("OwnerType" = 'company' AND "CompanyId" = p_company_id)
    )
    LIMIT 1;

    -- Create owner if it doesn't exist
    IF v_owner_id IS NULL THEN
        INSERT INTO "public"."Owners" (
            "OwnerType",
            "MemberId",
            "CompanyId",
            "Created",
            "LastModified"
        ) VALUES (
            v_actual_owner_type::"OwnerType",
            CASE WHEN v_actual_owner_type = 'member' THEN p_member_id ELSE NULL END,
            CASE WHEN v_actual_owner_type = 'company' THEN p_company_id ELSE NULL END,
            now(),
            now()
        )
        RETURNING "Id" INTO v_owner_id;
    END IF;

    RETURN v_owner_id;
END;
$$;

-- Function to get owner information (member or company details)
-- Returns JSONB with owner details
CREATE OR REPLACE FUNCTION get_owner_info(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT
        jsonb_build_object(
            'id', o."Id",
            'ownerType', o."OwnerType",
            'ownerDetails', CASE
                WHEN o."OwnerType" = 'member' THEN (
                    SELECT jsonb_build_object(
                        'id', m."Id",
                        'userId', m."UserId",
                        'firstName', m."FirstName",
                        'lastName', m."LastName",
                        'email', m."Email",
                        'phone', m."Phone"
                    )
                    FROM "public"."Members" m
                    WHERE m."Id" = o."MemberId"
                    AND m."IsDeleted" = false
                )
                WHEN o."OwnerType" = 'company' THEN (
                    SELECT jsonb_build_object(
                        'id', c."Id",
                        'name', c."Name",
                        'billingEmail', c."BillingEmail",
                        'phone', c."Phone"
                    )
                    FROM "public"."Companies" c
                    WHERE c."Id" = o."CompanyId"
                    AND c."IsDeleted" = false
                )
                ELSE NULL
            END
        ) INTO v_result
    FROM "public"."Owners" o
    WHERE o."Id" = p_owner_id
    AND o."IsDeleted" = false;

    RETURN v_result;
END;
$$;

-- Function to check if a user owns a property (through Owners table)
-- Returns boolean indicating ownership
CREATE OR REPLACE FUNCTION is_property_owner(
    p_user_id uuid,
    p_property_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_owner boolean := false;
    v_member_id uuid;
BEGIN
    -- Get the member's ID for this user
    SELECT "Id" INTO v_member_id
    FROM "public"."Members"
    WHERE "UserId" = p_user_id
    AND "IsDeleted" = false;

    IF v_member_id IS NULL THEN
        RETURN false;
    END IF;

    -- Check if user owns the property through Owners table
    SELECT EXISTS(
        SELECT 1
        FROM "public"."EstateProperties" ep
        JOIN "public"."Owners" o ON ep."OwnerId" = o."Id"
        WHERE ep."Id" = p_property_id
        AND ep."IsDeleted" = false
        AND o."IsDeleted" = false
        AND (
            -- Direct member ownership
            (o."OwnerType" = 'member' AND o."MemberId" = v_member_id) OR
            -- Company ownership (user is in the company)
            (o."OwnerType" = 'company' AND o."CompanyId" IN (
                SELECT "CompanyId"
                FROM "public"."UserCompanies"
                WHERE "MemberId" = v_member_id
                AND "IsDeleted" = false
            ))
        )
    ) INTO v_is_owner;

    RETURN v_is_owner;
END;
$$;
