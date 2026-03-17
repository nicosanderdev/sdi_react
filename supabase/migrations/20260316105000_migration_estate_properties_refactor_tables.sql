-- Migration: Refactor EstateProperties base table and move iCal token to SummerRentExtension
-- NOTE: Review carefully and run manually against the database.

BEGIN;

-- 1) Make AreaValue and AreaUnit nullable on EstateProperties
ALTER TABLE public."EstateProperties"
    ALTER COLUMN "AreaValue" DROP NOT NULL,
    ALTER COLUMN "AreaUnit" DROP NOT NULL;

-- 2) Move iCal export token from EstateProperties to SummerRentExtension
ALTER TABLE public."SummerRentExtension"
    ADD COLUMN IF NOT EXISTS "ICalExportToken" uuid DEFAULT gen_random_uuid();

-- Copy existing tokens from EstateProperties into SummerRentExtension where possible
UPDATE public."SummerRentExtension" sx
SET "ICalExportToken" = ep."ICalExportToken"
FROM public."EstateProperties" ep
WHERE sx."EstatePropertyId" = ep."Id"
  AND ep."ICalExportToken" IS NOT NULL;

-- 3) Drop business and audit columns from EstateProperties
ALTER TABLE public."EstateProperties"
    DROP COLUMN IF EXISTS "Type",
    DROP COLUMN IF EXISTS "Title",
    DROP COLUMN IF EXISTS "Visits",
    DROP COLUMN IF EXISTS "MainImageId",
    DROP COLUMN IF EXISTS "MinStayDays",
    DROP COLUMN IF EXISTS "MaxStayDays",
    DROP COLUMN IF EXISTS "LeadTimeDays",
    DROP COLUMN IF EXISTS "BufferDays",
    DROP COLUMN IF EXISTS "ICalExportToken",
    DROP COLUMN IF EXISTS "PropertyType",
    DROP COLUMN IF EXISTS "Created",
    DROP COLUMN IF EXISTS "CreatedBy",
    DROP COLUMN IF EXISTS "LastModified",
    DROP COLUMN IF EXISTS "LastModifiedBy";

-- 4) Ensure IsDeleted lives only on base EstateProperties table by removing it from extensions
ALTER TABLE public."RealEstateExtension"
    DROP COLUMN IF EXISTS "IsDeleted";

ALTER TABLE public."SummerRentExtension"
    DROP COLUMN IF EXISTS "IsDeleted";

ALTER TABLE public."EventVenueExtension"
    DROP COLUMN IF EXISTS "IsDeleted";

COMMIT;

