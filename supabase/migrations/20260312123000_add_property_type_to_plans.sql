-- ============================================================================
-- Add PropertyType to Plans
-- - Uses existing "PropertyType" enum from estate properties refactor
-- - Backfills existing rows with a sensible default
-- ============================================================================

DO $$
BEGIN
    -- Add PropertyType column to Plans if it does not exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Plans'
          AND column_name = 'PropertyType'
    ) THEN
        ALTER TABLE public."Plans"
        ADD COLUMN "PropertyType" "PropertyType";
    END IF;
END $$;

-- Optional index to speed up queries by property type
CREATE INDEX IF NOT EXISTS "IX_Plans_PropertyType"
    ON public."Plans" ("PropertyType");

-- Backfill: set a default PropertyType for existing rows that don't have one yet
-- For now, default everything to RealEstate so existing behaviour remains unchanged.
UPDATE public."Plans"
SET "PropertyType" = 'RealEstate'::"PropertyType"
WHERE "PropertyType" IS NULL;

