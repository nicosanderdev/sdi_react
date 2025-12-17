-- Backfill Email field for existing Members records from auth.users
-- This migration ensures all existing Members records have their Email field populated

UPDATE "public"."Members"
SET "Email" = au.email,
    "LastModified" = NOW(),
    "LastModifiedBy" = 'system'
FROM auth.users au
WHERE "Members"."UserId" = au.id
  AND "Members"."IsDeleted" = false
  AND ("Members"."Email" IS NULL OR "Members"."Email" = '');

-- Add a comment to document this migration
COMMENT ON COLUMN "public"."Members"."Email" IS 'User email address, synced from auth.users during signup and backfilled for existing records';
