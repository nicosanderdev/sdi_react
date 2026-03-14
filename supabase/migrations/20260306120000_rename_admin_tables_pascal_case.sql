-- ============================================================================
-- Rename admin-task-03 tables and columns to PascalCase
-- ============================================================================
-- Tables: auth_email_change_requests, user_apps, verification_codes
-- Apply this migration manually after the tables exist.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) auth_email_change_requests → AuthEmailChangeRequests
-- ----------------------------------------------------------------------------
ALTER TABLE public.auth_email_change_requests RENAME TO "AuthEmailChangeRequests";

ALTER TABLE public."AuthEmailChangeRequests" RENAME COLUMN id TO "Id";
ALTER TABLE public."AuthEmailChangeRequests" RENAME COLUMN user_id TO "UserId";
ALTER TABLE public."AuthEmailChangeRequests" RENAME COLUMN new_email TO "NewEmail";
ALTER TABLE public."AuthEmailChangeRequests" RENAME COLUMN code_hash TO "CodeHash";
ALTER TABLE public."AuthEmailChangeRequests" RENAME COLUMN expires_at TO "ExpiresAt";
ALTER TABLE public."AuthEmailChangeRequests" RENAME COLUMN consumed_at TO "ConsumedAt";
ALTER TABLE public."AuthEmailChangeRequests" RENAME COLUMN created_at TO "CreatedAt";

ALTER TABLE public."AuthEmailChangeRequests" DROP CONSTRAINT IF EXISTS auth_email_change_requests_user_id_fkey;
ALTER TABLE public."AuthEmailChangeRequests" DROP CONSTRAINT IF EXISTS auth_email_change_requests_pkey;

ALTER TABLE public."AuthEmailChangeRequests" ADD CONSTRAINT "PK_AuthEmailChangeRequests" PRIMARY KEY ("Id");
ALTER TABLE public."AuthEmailChangeRequests" ADD CONSTRAINT "FK_AuthEmailChangeRequests_UserId"
  FOREIGN KEY ("UserId") REFERENCES auth.users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.auth_email_change_requests_user_active_idx;
CREATE UNIQUE INDEX "IX_AuthEmailChangeRequests_UserId_Active"
  ON public."AuthEmailChangeRequests" USING btree ("UserId")
  WHERE ("ConsumedAt" IS NULL);

-- ----------------------------------------------------------------------------
-- 2) user_apps → UserApps
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_apps RENAME TO "UserApps";

-- Drop RLS policies (they reference user_id; we will recreate with "UserId")
DROP POLICY IF EXISTS "Users can select own user_apps" ON public."UserApps";
DROP POLICY IF EXISTS "Users can insert own user_apps" ON public."UserApps";

ALTER TABLE public."UserApps" RENAME COLUMN id TO "Id";
ALTER TABLE public."UserApps" RENAME COLUMN user_id TO "UserId";
ALTER TABLE public."UserApps" RENAME COLUMN app_name TO "AppName";
ALTER TABLE public."UserApps" RENAME COLUMN created_at TO "CreatedAt";

ALTER TABLE public."UserApps" DROP CONSTRAINT IF EXISTS user_apps_user_id_fkey;
ALTER TABLE public."UserApps" DROP CONSTRAINT IF EXISTS uq_user_apps_user_id_app_name;
ALTER TABLE public."UserApps" DROP CONSTRAINT IF EXISTS pk_user_apps;

ALTER TABLE public."UserApps" ADD CONSTRAINT "PK_UserApps" PRIMARY KEY ("Id");
ALTER TABLE public."UserApps" ADD CONSTRAINT "UQ_UserApps_UserId_AppName" UNIQUE ("UserId", "AppName");
ALTER TABLE public."UserApps" ADD CONSTRAINT "FK_UserApps_UserId"
  FOREIGN KEY ("UserId") REFERENCES auth.users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.ix_user_apps_user_id_app_name;
CREATE INDEX "IX_UserApps_UserId_AppName" ON public."UserApps" USING btree ("UserId", "AppName");

COMMENT ON TABLE public."UserApps" IS 'Tracks which platform apps (rentals_app, admin_app, venues_app) a user has used for first-time messaging.';
COMMENT ON COLUMN public."UserApps"."AppName" IS 'One of: rentals_app, admin_app, venues_app';

-- RLS: users can only read their own rows
CREATE POLICY "Users can select own UserApps"
  ON public."UserApps" FOR SELECT
  USING ("UserId" = auth.uid());

-- RLS: users can only insert rows for themselves
CREATE POLICY "Users can insert own UserApps"
  ON public."UserApps" FOR INSERT
  WITH CHECK ("UserId" = auth.uid());

-- ----------------------------------------------------------------------------
-- 3) verification_codes → VerificationCodes
-- ----------------------------------------------------------------------------
ALTER TABLE public.verification_codes RENAME TO "VerificationCodes";

ALTER TABLE public."VerificationCodes" RENAME COLUMN id TO "Id";
ALTER TABLE public."VerificationCodes" RENAME COLUMN user_id TO "UserId";
ALTER TABLE public."VerificationCodes" RENAME COLUMN email TO "Email";
ALTER TABLE public."VerificationCodes" RENAME COLUMN phone TO "Phone";
ALTER TABLE public."VerificationCodes" RENAME COLUMN code TO "Code";
ALTER TABLE public."VerificationCodes" RENAME COLUMN type TO "Type";
ALTER TABLE public."VerificationCodes" RENAME COLUMN expires_at TO "ExpiresAt";
ALTER TABLE public."VerificationCodes" RENAME COLUMN created_at TO "CreatedAt";
ALTER TABLE public."VerificationCodes" RENAME COLUMN used_at TO "UsedAt";

ALTER TABLE public."VerificationCodes" DROP CONSTRAINT IF EXISTS verification_codes_type_check;
ALTER TABLE public."VerificationCodes" DROP CONSTRAINT IF EXISTS verification_codes_pkey;

ALTER TABLE public."VerificationCodes" ADD CONSTRAINT "PK_VerificationCodes" PRIMARY KEY ("Id");
ALTER TABLE public."VerificationCodes" ADD CONSTRAINT "CK_VerificationCodes_Type" CHECK (
  "Type" = ANY (ARRAY['email_change'::text, 'phone_change'::text])
);

DROP INDEX IF EXISTS public.idx_verification_codes_user_id;
DROP INDEX IF EXISTS public.idx_verification_codes_type;
DROP INDEX IF EXISTS public.idx_verification_codes_expires_at;

CREATE INDEX "IX_VerificationCodes_UserId" ON public."VerificationCodes" USING btree ("UserId");
CREATE INDEX "IX_VerificationCodes_Type" ON public."VerificationCodes" USING btree ("Type");
CREATE INDEX "IX_VerificationCodes_ExpiresAt" ON public."VerificationCodes" USING btree ("ExpiresAt");
