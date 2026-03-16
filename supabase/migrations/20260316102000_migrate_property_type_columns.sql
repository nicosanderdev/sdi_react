BEGIN;

-- 1. Add new column with the new enum type
ALTER TABLE "EstateProperties"
ADD COLUMN "PropertyType_new" "PropertyType";

ALTER TABLE "Plans"
ADD COLUMN "PropertyType_new" "PropertyType";


-- 2. Copy values from the old enum to the new one
-- This assumes the enum values have the same names
UPDATE "EstateProperties"
SET "PropertyType_new" = "EstateProperties"."PropertyType"::text::"PropertyType";

UPDATE "Plans"
SET "PropertyType_new" = "Plans"."PropertyType"::text::"PropertyType";


-- 3. Drop old columns
ALTER TABLE "EstateProperties"
DROP COLUMN "PropertyType";

ALTER TABLE "Plans"
DROP COLUMN "PropertyType";


-- 4. Rename new column to original name
ALTER TABLE "EstateProperties"
RENAME COLUMN "PropertyType_new" TO "PropertyType";

ALTER TABLE "Plans"
RENAME COLUMN "PropertyType_new" TO "PropertyType";


COMMIT;

