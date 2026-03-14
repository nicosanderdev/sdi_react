-- Migrate existing EstateProperties.OwnerId to Owners table
-- This creates Owner records for all existing properties

-- Create Owner records for all existing properties
-- All current properties are owned by members, so we create 'member' type owners
INSERT INTO "public"."Owners" (
    "Id",
    "OwnerType",
    "MemberId",
    "CompanyId",
    "IsDeleted",
    "Created",
    "CreatedBy",
    "LastModified",
    "LastModifiedBy"
)
SELECT
    gen_random_uuid() as "Id",
    'member'::"OwnerType" as "OwnerType",
    ep."OwnerId" as "MemberId",
    NULL as "CompanyId",
    false as "IsDeleted",
    COALESCE(ep."Created", now()) as "Created",
    ep."CreatedBy",
    COALESCE(ep."LastModified", now()) as "LastModified",
    ep."LastModifiedBy"
FROM "public"."EstateProperties" ep
WHERE ep."IsDeleted" = false
AND NOT EXISTS (
    -- Avoid duplicates if migration is run multiple times
    SELECT 1 FROM "public"."Owners" o
    WHERE o."OwnerType" = 'member'
    AND o."MemberId" = ep."OwnerId"
    AND o."IsDeleted" = false
);

-- Update EstateProperties to reference the new Owner records
-- Match by MemberId since all existing properties are member-owned
UPDATE "public"."EstateProperties"
SET "OwnerId" = o."Id"
FROM "public"."Owners" o
WHERE o."OwnerType" = 'member'
AND o."MemberId" = "EstateProperties"."OwnerId"
AND "EstateProperties"."IsDeleted" = false
AND o."IsDeleted" = false;

-- Add comments to document the change
COMMENT ON COLUMN "public"."EstateProperties"."OwnerId" IS 'References Owners.Id - unified ownership for members and companies';
COMMENT ON TABLE "public"."Owners" IS 'Unified ownership table supporting both member and company ownership of properties';
