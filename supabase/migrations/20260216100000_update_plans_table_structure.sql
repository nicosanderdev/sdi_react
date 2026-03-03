-- ============================================================================
-- MIGRATION: Update Plans Table Structure
-- ============================================================================
-- This migration adds new columns to the Plans table to support:
--   - Published property limits
--   - Commission rates and minimum amounts
--   - Extra property pricing tiers
-- ============================================================================

-- Add MaxPublishedProperties column (maximum published properties allowed)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Plans' 
        AND column_name = 'MaxPublishedProperties'
    ) THEN
        ALTER TABLE public."Plans" 
        ADD COLUMN "MaxPublishedProperties" integer NULL;
    END IF;
END $$;

-- Add CommissionPercentage column (commission percentage per reservation)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Plans' 
        AND column_name = 'CommissionPercentage'
    ) THEN
        ALTER TABLE public."Plans" 
        ADD COLUMN "CommissionPercentage" numeric NULL;
    END IF;
END $$;

-- Add CommissionMinimumAmount column (minimum commission amount in USD)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Plans' 
        AND column_name = 'CommissionMinimumAmount'
    ) THEN
        ALTER TABLE public."Plans" 
        ADD COLUMN "CommissionMinimumAmount" numeric NULL;
    END IF;
END $$;

-- Add ExtraPropertiesPrice11to30 column (price per extra property for 11-30 range)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Plans' 
        AND column_name = 'ExtraPropertiesPrice11to30'
    ) THEN
        ALTER TABLE public."Plans" 
        ADD COLUMN "ExtraPropertiesPrice11to30" numeric NULL;
    END IF;
END $$;

-- Add ExtraPropertiesPrice31Plus column (price per extra property for 31+ range)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Plans' 
        AND column_name = 'ExtraPropertiesPrice31Plus'
    ) THEN
        ALTER TABLE public."Plans" 
        ADD COLUMN "ExtraPropertiesPrice31Plus" numeric NULL;
    END IF;
END $$;

-- Add comments to new columns for documentation
COMMENT ON COLUMN public."Plans"."MaxPublishedProperties" IS 'Maximum number of published properties allowed for this plan';
COMMENT ON COLUMN public."Plans"."CommissionPercentage" IS 'Commission percentage per reservation (e.g., 6.5 for 6.5%)';
COMMENT ON COLUMN public."Plans"."CommissionMinimumAmount" IS 'Minimum commission amount in USD (if applicable)';
COMMENT ON COLUMN public."Plans"."ExtraPropertiesPrice11to30" IS 'Price per extra property for properties 11-30 (if applicable)';
COMMENT ON COLUMN public."Plans"."ExtraPropertiesPrice31Plus" IS 'Price per extra property for properties 31+ (if applicable)';
