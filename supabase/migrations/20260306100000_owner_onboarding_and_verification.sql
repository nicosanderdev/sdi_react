-- ============================================================================
-- Owner onboarding and member verification
-- ============================================================================
-- Adds: OwnerOnboarding table, Members verification columns, RPCs.
-- Apply this migration manually; the app does not run migrations.
-- ============================================================================

-- 1) Add verification columns to Members (if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Members' AND column_name = 'EmailVerifiedAt'
    ) THEN
        ALTER TABLE public."Members" ADD COLUMN "EmailVerifiedAt" timestamp with time zone NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Members' AND column_name = 'PhoneVerifiedAt'
    ) THEN
        ALTER TABLE public."Members" ADD COLUMN "PhoneVerifiedAt" timestamp with time zone NULL;
    END IF;
END $$;

-- 2) OwnerOnboarding table (one row per member)
CREATE TABLE IF NOT EXISTS public."OwnerOnboarding" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "MemberId" uuid NOT NULL,
    "CurrentStep" integer NOT NULL DEFAULT 0,
    "CompletedAt" timestamp with time zone NULL,
    "DismissedAt" timestamp with time zone NULL,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" text NULL,
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" text NULL,
    CONSTRAINT "PK_OwnerOnboarding" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_OwnerOnboarding_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES public."Members"("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_OwnerOnboarding_MemberId" ON public."OwnerOnboarding" ("MemberId");
CREATE INDEX IF NOT EXISTS "IX_OwnerOnboarding_CurrentStep" ON public."OwnerOnboarding" ("CurrentStep");

ALTER TABLE public."OwnerOnboarding" ENABLE ROW LEVEL SECURITY;

-- RLS: member can only read/update their own row
CREATE POLICY "Members can view own owner onboarding"
    ON public."OwnerOnboarding" FOR SELECT
    USING (
        "MemberId" IN (SELECT "Id" FROM public."Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
    );

CREATE POLICY "Members can insert own owner onboarding"
    ON public."OwnerOnboarding" FOR INSERT
    WITH CHECK (
        "MemberId" IN (SELECT "Id" FROM public."Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
    );

CREATE POLICY "Members can update own owner onboarding"
    ON public."OwnerOnboarding" FOR UPDATE
    USING (
        "MemberId" IN (SELECT "Id" FROM public."Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
    );

-- 3) get_owner_onboarding_state(p_member_id uuid)
-- Returns current_step, completed_at, dismissed_at, published_properties_count, email_verified, phone_verified, plan_published_limit, plan_key.
-- Caller must pass their own member id (frontend resolves via profile).
CREATE OR REPLACE FUNCTION public.get_owner_onboarding_state(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_row record;
    v_published_count bigint;
    v_plan_key int;
    v_plan_published int;
BEGIN
    -- Ensure caller can only request their own member id
    SELECT "UserId" INTO v_user_id FROM public."Members" WHERE "Id" = p_member_id AND "IsDeleted" = false;
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('error', 'unauthorized');
    END IF;

    -- Published properties count (EstateProperties owned by this member, visible and active)
    SELECT COUNT(*) INTO v_published_count
    FROM public."EstateProperties" ep
    INNER JOIN public."EstatePropertyValues" epv ON epv."EstatePropertyId" = ep."Id" AND epv."IsDeleted" = false
    WHERE ep."OwnerId" = p_member_id AND ep."IsDeleted" = false
      AND epv."IsPropertyVisible" = true AND epv."IsActive" = true;

    -- Subscription plan: Subscriptions.OwnerId is auth user id
    SELECT p."Key", p."MaxPublishedProperties" INTO v_plan_key, v_plan_published
    FROM public."Subscriptions" s
    INNER JOIN public."Plans" p ON p."Id" = s."PlanId"
    WHERE s."OwnerId" = v_user_id AND s."Status" = 1 AND s."IsDeleted" = false
    ORDER BY s."CreatedAt" DESC
    LIMIT 1;

    IF v_plan_published IS NULL THEN
        v_plan_published := 5;
        v_plan_key := 0;
    END IF;

    SELECT
        oo."CurrentStep",
        oo."CompletedAt",
        oo."DismissedAt",
        m."EmailVerifiedAt" IS NOT NULL AS email_verified,
        m."PhoneVerifiedAt" IS NOT NULL AS phone_verified
    INTO v_row
    FROM public."Members" m
    LEFT JOIN public."OwnerOnboarding" oo ON oo."MemberId" = m."Id" AND oo."IsDeleted" = false
    WHERE m."Id" = p_member_id AND m."IsDeleted" = false;

    IF v_row IS NULL THEN
        RETURN jsonb_build_object(
            'current_step', 0,
            'completed_at', NULL,
            'dismissed_at', NULL,
            'published_properties_count', COALESCE(v_published_count, 0),
            'email_verified', false,
            'phone_verified', false,
            'plan_published_limit', v_plan_published,
            'plan_key', COALESCE(v_plan_key, 0)
        );
    END IF;

    RETURN jsonb_build_object(
        'current_step', COALESCE(v_row."CurrentStep", 0),
        'completed_at', v_row."CompletedAt",
        'dismissed_at', v_row."DismissedAt",
        'published_properties_count', COALESCE(v_published_count, 0),
        'email_verified', COALESCE(v_row.email_verified, false),
        'phone_verified', COALESCE(v_row.phone_verified, false),
        'plan_published_limit', v_plan_published,
        'plan_key', COALESCE(v_plan_key, 0)
    );
END;
$$;

-- 4) update_owner_onboarding_step(p_member_id uuid, p_step int, p_dismissed boolean default false)
CREATE OR REPLACE FUNCTION public.update_owner_onboarding_step(
    p_member_id uuid,
    p_step int,
    p_dismissed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT "UserId" INTO v_user_id FROM public."Members" WHERE "Id" = p_member_id AND "IsDeleted" = false;
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    INSERT INTO public."OwnerOnboarding" ("MemberId", "CurrentStep", "DismissedAt", "LastModified")
    VALUES (
        p_member_id,
        p_step,
        CASE WHEN p_dismissed THEN now() ELSE NULL END,
        now()
    )
    ON CONFLICT ("MemberId") DO UPDATE SET
        "CurrentStep" = EXCLUDED."CurrentStep",
        "DismissedAt" = CASE WHEN p_dismissed THEN now() ELSE "OwnerOnboarding"."DismissedAt" END,
        "LastModified" = now();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5) set_owner_onboarding_complete(p_member_id uuid)
CREATE OR REPLACE FUNCTION public.set_owner_onboarding_complete(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT "UserId" INTO v_user_id FROM public."Members" WHERE "Id" = p_member_id AND "IsDeleted" = false;
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    INSERT INTO public."OwnerOnboarding" ("MemberId", "CurrentStep", "CompletedAt", "LastModified")
    VALUES (p_member_id, 5, now(), now())
    ON CONFLICT ("MemberId") DO UPDATE SET
        "CurrentStep" = 5,
        "CompletedAt" = now(),
        "LastModified" = now();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6) set_member_verification(p_member_id uuid, p_type text) — p_type in ('email', 'phone')
-- Call after successful verify-email-code / verify-phone-code from the frontend.
CREATE OR REPLACE FUNCTION public.set_member_verification(p_member_id uuid, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT "UserId" INTO v_user_id FROM public."Members" WHERE "Id" = p_member_id AND "IsDeleted" = false;
    IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    IF p_type = 'email' THEN
        UPDATE public."Members" SET "EmailVerifiedAt" = now(), "LastModified" = now() WHERE "Id" = p_member_id;
    ELSIF p_type = 'phone' THEN
        UPDATE public."Members" SET "PhoneVerifiedAt" = now(), "LastModified" = now() WHERE "Id" = p_member_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'invalid type');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON TABLE public."OwnerOnboarding" IS 'Tracks owner activation onboarding progress (first property publish flow).';
COMMENT ON COLUMN public."Members"."EmailVerifiedAt" IS 'When the member verified their email (e.g. after change-email flow).';
COMMENT ON COLUMN public."Members"."PhoneVerifiedAt" IS 'When the member verified their phone (e.g. after change-phone flow).';
