-- Admin User Management System Migration
-- Creates tables and functions for managing user accounts, onboarding, force logout, and action history

-- Ensure Members table has Role column (for backward compatibility with existing schema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Members' AND column_name = 'Role') THEN
        ALTER TABLE "public"."Members" ADD COLUMN "Role" text DEFAULT 'user';
    END IF;
END $$;

-- MemberStatus table - Track user account status
CREATE TABLE IF NOT EXISTS "public"."MemberStatus" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "MemberId" "uuid" NOT NULL,
    "Status" character varying(20) NOT NULL CHECK ("Status" IN ('active', 'suspended', 'deleted')),
    "Reason" "text",
    "ChangedBy" "uuid" NOT NULL,
    "ChangedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_MemberStatus" PRIMARY KEY ("Id")
);

-- MemberOnboarding table - Track user onboarding progress
CREATE TABLE IF NOT EXISTS "public"."MemberOnboarding" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "MemberId" "uuid" NOT NULL,
    "OnboardingStep" integer NOT NULL DEFAULT 0,
    "IsComplete" boolean NOT NULL DEFAULT false,
    "CompletedAt" timestamp with time zone,
    "LastResetBy" "uuid",
    "LastResetAt" timestamp with time zone,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" "text",
    CONSTRAINT "PK_MemberOnboarding" PRIMARY KEY ("Id")
);

-- MemberForceLogout table - Flag-based force logout system
CREATE TABLE IF NOT EXISTS "public"."MemberForceLogout" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "MemberId" "uuid" NOT NULL,
    "ForceLogout" boolean NOT NULL DEFAULT false,
    "Reason" "text",
    "RequestedBy" "uuid" NOT NULL,
    "RequestedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "AcknowledgedAt" timestamp with time zone,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_MemberForceLogout" PRIMARY KEY ("Id")
);

-- MemberActionHistory table - Audit trail for admin actions
CREATE TABLE IF NOT EXISTS "public"."MemberActionHistory" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "MemberId" "uuid" NOT NULL,
    "ActionType" character varying(50) NOT NULL CHECK ("ActionType" IN ('suspend', 'reactivate', 'role_change', 'reset_onboarding', 'force_logout', 'delete')),
    "ActionDetails" "jsonb",
    "PerformedBy" "uuid" NOT NULL,
    "PerformedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    CONSTRAINT "PK_MemberActionHistory" PRIMARY KEY ("Id")
);

-- Set table ownership
ALTER TABLE "public"."MemberStatus" OWNER TO "postgres";
ALTER TABLE "public"."MemberOnboarding" OWNER TO "postgres";
ALTER TABLE "public"."MemberForceLogout" OWNER TO "postgres";
ALTER TABLE "public"."MemberActionHistory" OWNER TO "postgres";

-- Add foreign key constraints
ALTER TABLE ONLY "public"."MemberStatus"
    ADD CONSTRAINT "FK_MemberStatus_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MemberStatus"
    ADD CONSTRAINT "FK_MemberStatus_Members_ChangedBy" FOREIGN KEY ("ChangedBy") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MemberOnboarding"
    ADD CONSTRAINT "FK_MemberOnboarding_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MemberOnboarding"
    ADD CONSTRAINT "FK_MemberOnboarding_Members_LastResetBy" FOREIGN KEY ("LastResetBy") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MemberForceLogout"
    ADD CONSTRAINT "FK_MemberForceLogout_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MemberForceLogout"
    ADD CONSTRAINT "FK_MemberForceLogout_Members_RequestedBy" FOREIGN KEY ("RequestedBy") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MemberActionHistory"
    ADD CONSTRAINT "FK_MemberActionHistory_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."MemberActionHistory"
    ADD CONSTRAINT "FK_MemberActionHistory_Members_PerformedBy" FOREIGN KEY ("PerformedBy") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

-- Create indexes
CREATE INDEX "IX_MemberStatus_MemberId" ON "public"."MemberStatus" USING "btree" ("MemberId");
CREATE INDEX "IX_MemberStatus_Status" ON "public"."MemberStatus" USING "btree" ("Status");
CREATE INDEX "IX_MemberStatus_ChangedAt" ON "public"."MemberStatus" USING "btree" ("ChangedAt");

CREATE UNIQUE INDEX "IX_MemberOnboarding_MemberId" ON "public"."MemberOnboarding" USING "btree" ("MemberId");

CREATE INDEX "IX_MemberForceLogout_MemberId" ON "public"."MemberForceLogout" USING "btree" ("MemberId");
CREATE INDEX "IX_MemberForceLogout_ForceLogout" ON "public"."MemberForceLogout" USING "btree" ("ForceLogout");

CREATE INDEX "IX_MemberActionHistory_MemberId" ON "public"."MemberActionHistory" USING "btree" ("MemberId");
CREATE INDEX "IX_MemberActionHistory_ActionType" ON "public"."MemberActionHistory" USING "btree" ("ActionType");
CREATE INDEX "IX_MemberActionHistory_PerformedAt" ON "public"."MemberActionHistory" USING "btree" ("PerformedAt");

-- Enable Row Level Security
ALTER TABLE "public"."MemberStatus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MemberOnboarding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MemberForceLogout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MemberActionHistory" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access
CREATE POLICY "Admins can view member status" ON "public"."MemberStatus" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

CREATE POLICY "Admins can manage member status" ON "public"."MemberStatus" FOR ALL USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

CREATE POLICY "Admins can view member onboarding" ON "public"."MemberOnboarding" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

CREATE POLICY "Admins can manage member onboarding" ON "public"."MemberOnboarding" FOR ALL USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

CREATE POLICY "Admins can view member force logout" ON "public"."MemberForceLogout" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

CREATE POLICY "Admins can manage member force logout" ON "public"."MemberForceLogout" FOR ALL USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

CREATE POLICY "Admins can view member action history" ON "public"."MemberActionHistory" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

CREATE POLICY "Admins can manage member action history" ON "public"."MemberActionHistory" FOR ALL USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."IsDeleted" = false
        AND m."Role" = 'admin'
    )
);

-- Users can view their own force logout flag
CREATE POLICY "Users can view their own force logout" ON "public"."MemberForceLogout" FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM "Members" m
        WHERE m."UserId" = auth.uid()
        AND m."Id" = "MemberForceLogout"."MemberId"
        AND m."IsDeleted" = false
    )
);

-- Grant permissions
GRANT ALL ON TABLE "public"."MemberStatus" TO "anon";
GRANT ALL ON TABLE "public"."MemberStatus" TO "authenticated";
GRANT ALL ON TABLE "public"."MemberStatus" TO "service_role";

GRANT ALL ON TABLE "public"."MemberOnboarding" TO "anon";
GRANT ALL ON TABLE "public"."MemberOnboarding" TO "authenticated";
GRANT ALL ON TABLE "public"."MemberOnboarding" TO "service_role";

GRANT ALL ON TABLE "public"."MemberForceLogout" TO "anon";
GRANT ALL ON TABLE "public"."MemberForceLogout" TO "authenticated";
GRANT ALL ON TABLE "public"."MemberForceLogout" TO "service_role";

GRANT ALL ON TABLE "public"."MemberActionHistory" TO "anon";
GRANT ALL ON TABLE "public"."MemberActionHistory" TO "authenticated";
GRANT ALL ON TABLE "public"."MemberActionHistory" TO "service_role";

-- RPC Functions for Admin User Management

-- Function to get admin users list with filters and pagination
CREATE OR REPLACE FUNCTION get_admin_users_list(
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 20,
    p_subscription_status text DEFAULT NULL,
    p_subscription_tier integer DEFAULT NULL,
    p_account_status text DEFAULT NULL,
    p_registration_date_from timestamp with time zone DEFAULT NULL,
    p_registration_date_to timestamp with time zone DEFAULT NULL,
    p_search text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying,
    avatar_url character varying(2048),
    roles text[],
    subscription_status text,
    subscription_tier integer,
    subscription_expires_at timestamp with time zone,
    account_status text,
    registration_date timestamp with time zone,
    last_login timestamp with time zone,
    properties_count bigint,
    payment_status text,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset integer;
    v_total_count bigint;
BEGIN
    -- Calculate offset
    v_offset := (p_page - 1) * p_limit;

    -- Get total count for pagination
    SELECT COUNT(*) INTO v_total_count
    FROM "Members" m
    WHERE m."IsDeleted" = false
    AND (p_search IS NULL OR
         LOWER(COALESCE(m."FirstName", '') || ' ' || COALESCE(m."LastName", '')) LIKE '%' || LOWER(p_search) || '%' OR
         LOWER((SELECT au.email FROM auth.users au WHERE au.id = m."UserId")) LIKE '%' || LOWER(p_search) || '%')
    AND (p_registration_date_from IS NULL OR m."Created" >= p_registration_date_from)
    AND (p_registration_date_to IS NULL OR m."Created" <= p_registration_date_to);

    -- Return paginated results with aggregated data
    RETURN QUERY
    SELECT
        m."Id" as id,
        m."UserId" as user_id,
        m."FirstName" as first_name,
        m."LastName" as last_name,
        m."Email" as email,
        m."AvatarUrl" as avatar_url,
        ARRAY[m."Role"::text] as roles,
        CASE
            WHEN ms."isActive" = true AND (ms."ExpiresAtUtc" IS NULL OR ms."ExpiresAtUtc" > now()) THEN 'active'
            WHEN ms."isActive" = true AND ms."ExpiresAtUtc" <= now() THEN 'expired'
            ELSE 'none'
        END as subscription_status,
        ms."SubscriptionTier" as subscription_tier,
        ms."ExpiresAtUtc" as subscription_expires_at,
        COALESCE(ms_current."Status", 'active') as account_status,
        m."Created" as registration_date,
        NULL as last_login,
        COALESCE(prop_count.count, 0)::bigint as properties_count,
        CASE
            WHEN bh_latest."SubscriptionId" IS NOT NULL THEN
                CASE bh_latest."Status"
                    WHEN 0 THEN 'pending'
                    WHEN 1 THEN 'paid'
                    WHEN 2 THEN 'failed'
                    WHEN 3 THEN 'refunded'
                    ELSE 'unknown'
                END
            ELSE 'none'
        END as payment_status,
        v_total_count as total_count
    FROM "Members" m
    LEFT JOIN "MemberSubscriptions" ms ON ms."MemberId" = m."Id" AND ms."IsDeleted" = false
    LEFT JOIN "MemberStatus" ms_current ON ms_current."MemberId" = m."Id"
        AND ms_current."Id" = (
            SELECT ms_inner."Id"
            FROM "MemberStatus" ms_inner
            WHERE ms_inner."MemberId" = m."Id" AND ms_inner."IsDeleted" = false
            ORDER BY ms_inner."ChangedAt" DESC
            LIMIT 1
        )
    LEFT JOIN (
        SELECT "OwnerId", COUNT(*) as count
        FROM "EstateProperties"
        WHERE "IsDeleted" = false
        GROUP BY "OwnerId"
    ) prop_count ON prop_count."OwnerId" = m."Id"
    LEFT JOIN LATERAL (
        SELECT bh.*
        FROM "BillingHistories" bh
        WHERE bh."SubscriptionId" = ms."Id" AND bh."IsDeleted" = false
        ORDER BY bh."Created" DESC
        LIMIT 1
    ) bh_latest ON true
    WHERE m."IsDeleted" = false
    AND (p_search IS NULL OR
         LOWER(COALESCE(m."FirstName", '') || ' ' || COALESCE(m."LastName", '')) LIKE '%' || LOWER(p_search) || '%' OR
         LOWER(m."Email") LIKE '%' || LOWER(p_search) || '%')
    AND (p_subscription_status IS NULL OR
         CASE
             WHEN ms."isActive" = true AND (ms."ExpiresAtUtc" IS NULL OR ms."ExpiresAtUtc" > now()) THEN 'active'
             WHEN ms."isActive" = true AND ms."ExpiresAtUtc" <= now() THEN 'expired'
             ELSE 'none'
         END = p_subscription_status)
    AND (p_subscription_tier IS NULL OR ms."SubscriptionTier" = p_subscription_tier)
    AND (p_account_status IS NULL OR COALESCE(ms_current."Status", 'active') = p_account_status)
    AND (p_registration_date_from IS NULL OR m."Created" >= p_registration_date_from)
    AND (p_registration_date_to IS NULL OR m."Created" <= p_registration_date_to)
    ORDER BY m."Created" DESC
    LIMIT p_limit
    OFFSET v_offset;
END;
$$;

-- Function to get admin user detail
CREATE OR REPLACE FUNCTION get_admin_user_detail(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying,
    avatar_url character varying(2048),
    phone character varying(50),
    street character varying(255),
    street2 character varying(255),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100),
    roles text[],
    subscription_status text,
    subscription_tier integer,
    subscription_expires_at timestamp with time zone,
    account_status text,
    registration_date timestamp with time zone,
    last_login timestamp with time zone,
    properties_count bigint,
    payment_status text,
    onboarding_step integer,
    onboarding_complete boolean,
    action_history json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m."Id" as id,
        m."UserId" as user_id,
        m."FirstName" as first_name,
        m."LastName" as last_name,
        m."Email" as email,
        m."AvatarUrl" as avatar_url,
        m."Phone" as phone,
        m."Street" as street,
        m."Street2" as street2,
        m."City" as city,
        m."State" as state,
        m."PostalCode" as postal_code,
        m."Country" as country,
        ARRAY[m."Role"::text] as roles,
        CASE
            WHEN ms."isActive" = true AND (ms."ExpiresAtUtc" IS NULL OR ms."ExpiresAtUtc" > now()) THEN 'active'
            WHEN ms."isActive" = true AND ms."ExpiresAtUtc" <= now() THEN 'expired'
            ELSE 'none'
        END as subscription_status,
        ms."SubscriptionTier" as subscription_tier,
        ms."ExpiresAtUtc" as subscription_expires_at,
        COALESCE(ms_current."Status", 'active') as account_status,
        m."Created" as registration_date,
        NULL as last_login,
        COALESCE(prop_count.count, 0)::bigint as properties_count,
        CASE
            WHEN bh_latest."SubscriptionId" IS NOT NULL THEN
                CASE bh_latest."Status"
                    WHEN 0 THEN 'pending'
                    WHEN 1 THEN 'paid'
                    WHEN 2 THEN 'failed'
                    WHEN 3 THEN 'refunded'
                    ELSE 'unknown'
                END
            ELSE 'none'
        END as payment_status,
        COALESCE(mo."OnboardingStep", 0) as onboarding_step,
        COALESCE(mo."IsComplete", false) as onboarding_complete,
        COALESCE(action_history.history, '[]'::json) as action_history
    FROM "Members" m
    LEFT JOIN "MemberSubscriptions" ms ON ms."MemberId" = m."Id" AND ms."IsDeleted" = false
    LEFT JOIN "MemberStatus" ms_current ON ms_current."MemberId" = m."Id"
        AND ms_current."Id" = (
            SELECT ms_inner."Id"
            FROM "MemberStatus" ms_inner
            WHERE ms_inner."MemberId" = m."Id" AND ms_inner."IsDeleted" = false
            ORDER BY ms_inner."ChangedAt" DESC
            LIMIT 1
        )
    LEFT JOIN (
        SELECT "OwnerId", COUNT(*) as count
        FROM "EstateProperties"
        WHERE "IsDeleted" = false
        GROUP BY "OwnerId"
    ) prop_count ON prop_count."OwnerId" = m."Id"
    LEFT JOIN LATERAL (
        SELECT bh.*
        FROM "BillingHistories" bh
        WHERE bh."SubscriptionId" = ms."Id" AND bh."IsDeleted" = false
        ORDER BY bh."Created" DESC
        LIMIT 1
    ) bh_latest ON true
    LEFT JOIN "MemberOnboarding" mo ON mo."MemberId" = m."Id" AND mo."IsDeleted" = false
    LEFT JOIN LATERAL (
        SELECT json_agg(
            json_build_object(
                'id', mah."Id",
                'actionType', mah."ActionType",
                'actionDetails', mah."ActionDetails",
                'performedAt', mah."PerformedAt",
                'performedBy', json_build_object(
                    'id', admin_m."Id",
                    'name', COALESCE(admin_m."FirstName", '') || ' ' || COALESCE(admin_m."LastName", ''),
                    'email', admin_au.email
                )
            )
        ) as history
        FROM "MemberActionHistory" mah
        LEFT JOIN "Members" admin_m ON admin_m."Id" = mah."PerformedBy"
        LEFT JOIN auth.users admin_au ON admin_au.id = admin_m."UserId"
        WHERE mah."MemberId" = m."Id" AND mah."IsDeleted" = false
        ORDER BY mah."PerformedAt" DESC
        LIMIT 10
    ) action_history ON true
    WHERE m."Id" = p_user_id AND m."IsDeleted" = false;
END;
$$;

-- Function to suspend user
CREATE OR REPLACE FUNCTION suspend_user(
    p_member_id uuid,
    p_reason text DEFAULT NULL,
    p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Insert status change
    INSERT INTO "MemberStatus" ("MemberId", "Status", "Reason", "ChangedBy", "ChangedAt")
    VALUES (p_member_id, 'suspended', p_reason, v_admin_id, now());

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'suspend', json_build_object('reason', p_reason), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User suspended successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to reactivate user
CREATE OR REPLACE FUNCTION reactivate_user(
    p_member_id uuid,
    p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Insert status change
    INSERT INTO "MemberStatus" ("MemberId", "Status", "ChangedBy", "ChangedAt")
    VALUES (p_member_id, 'active', v_admin_id, now());

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "PerformedBy")
    VALUES (p_member_id, 'reactivate', v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User reactivated successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to reset user onboarding
CREATE OR REPLACE FUNCTION reset_user_onboarding(
    p_member_id uuid,
    p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Update or insert onboarding record
    INSERT INTO "MemberOnboarding" ("MemberId", "OnboardingStep", "IsComplete", "CompletedAt", "LastResetBy", "LastResetAt", "LastModifiedBy")
    VALUES (p_member_id, 0, false, NULL, v_admin_id, now(), v_admin_id::text)
    ON CONFLICT ("MemberId")
    DO UPDATE SET
        "OnboardingStep" = 0,
        "IsComplete" = false,
        "CompletedAt" = NULL,
        "LastResetBy" = v_admin_id,
        "LastResetAt" = now(),
        "LastModified" = now(),
        "LastModifiedBy" = v_admin_id::text;

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "PerformedBy")
    VALUES (p_member_id, 'reset_onboarding', v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User onboarding reset successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to force user logout
CREATE OR REPLACE FUNCTION force_user_logout(
    p_member_id uuid,
    p_reason text DEFAULT NULL,
    p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Update or insert force logout record
    INSERT INTO "MemberForceLogout" ("MemberId", "ForceLogout", "Reason", "RequestedBy", "RequestedAt")
    VALUES (p_member_id, true, p_reason, v_admin_id, now())
    ON CONFLICT ("MemberId")
    DO UPDATE SET
        "ForceLogout" = true,
        "Reason" = p_reason,
        "RequestedBy" = v_admin_id,
        "RequestedAt" = now(),
        "AcknowledgedAt" = NULL;

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'force_logout', json_build_object('reason', p_reason), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'Force logout initiated successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to update user role
CREATE OR REPLACE FUNCTION update_user_role(
    p_member_id uuid,
    p_new_role text,
    p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Validate role
    IF p_new_role NOT IN ('user', 'admin') THEN
        RETURN json_build_object('success', false, 'message', 'Invalid role specified');
    END IF;

    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Update member role (single role system)
    UPDATE "Members"
    SET "Role" = p_new_role, "LastModified" = now(), "LastModifiedBy" = v_admin_id::text
    WHERE "Id" = p_member_id AND "IsDeleted" = false;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'role_change', json_build_object('newRole', p_new_role), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User role updated successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to soft delete user
CREATE OR REPLACE FUNCTION soft_delete_user(
    p_member_id uuid,
    p_reason text DEFAULT NULL,
    p_admin_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Get admin ID from current user if not provided
    IF p_admin_id IS NULL THEN
        SELECT "Id" INTO v_admin_id
        FROM "Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false;
    ELSE
        v_admin_id := p_admin_id;
    END IF;

    -- Soft delete member
    UPDATE "Members"
    SET "IsDeleted" = true, "LastModified" = now(), "LastModifiedBy" = v_admin_id::text
    WHERE "Id" = p_member_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Insert status change
    INSERT INTO "MemberStatus" ("MemberId", "Status", "Reason", "ChangedBy", "ChangedAt")
    VALUES (p_member_id, 'deleted', p_reason, v_admin_id, now());

    -- Insert audit history
    INSERT INTO "MemberActionHistory" ("MemberId", "ActionType", "ActionDetails", "PerformedBy")
    VALUES (p_member_id, 'delete', json_build_object('reason', p_reason), v_admin_id);

    RETURN json_build_object('success', true, 'message', 'User deleted successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to check force logout for current user
CREATE OR REPLACE FUNCTION check_force_logout(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_force_logout boolean := false;
BEGIN
    -- Get user ID from current session if not provided
    IF p_user_id IS NULL THEN
        v_user_id := auth.uid();
    ELSE
        v_user_id := p_user_id;
    END IF;

    -- Check if user has force logout flag
    SELECT "ForceLogout" INTO v_force_logout
    FROM "MemberForceLogout"
    WHERE "MemberId" = (
        SELECT "Id" FROM "Members" WHERE "UserId" = v_user_id AND "IsDeleted" = false
    )
    AND "ForceLogout" = true
    AND "IsDeleted" = false
    ORDER BY "RequestedAt" DESC
    LIMIT 1;

    RETURN COALESCE(v_force_logout, false);
END;
$$;

-- Function to acknowledge force logout
CREATE OR REPLACE FUNCTION acknowledge_force_logout()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id uuid;
BEGIN
    -- Get current user's member ID
    SELECT "Id" INTO v_member_id
    FROM "Members"
    WHERE "UserId" = auth.uid() AND "IsDeleted" = false;

    -- Update force logout record
    UPDATE "MemberForceLogout"
    SET "ForceLogout" = false, "AcknowledgedAt" = now()
    WHERE "MemberId" = v_member_id AND "ForceLogout" = true;

    RETURN json_build_object('success', true, 'message', 'Force logout acknowledged');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to get active users based on last sign-in
CREATE OR REPLACE FUNCTION public.get_active_users_count(days_back INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date TIMESTAMP WITH TIME ZONE;
  active_count INTEGER;
BEGIN
  cutoff_date := NOW() - INTERVAL '1 day' * days_back;

  SELECT COUNT(DISTINCT m."Id") INTO active_count
  FROM "Members" m
  JOIN auth.users au ON m."UserId" = au.id
  WHERE m."IsDeleted" = false
  AND au.last_sign_in_at >= cutoff_date;

  RETURN COALESCE(active_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;