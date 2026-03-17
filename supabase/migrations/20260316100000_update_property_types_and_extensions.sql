-- NOTE: This migration is drafted and NOT yet applied.
-- Please review, adjust if needed, and run manually in your Supabase project.

-- 2) Unify AnnualRentExtension attributes into RealEstateExtension

-- Add AnnualRentExtension-like columns to RealEstateExtension.
ALTER TABLE public."RealEstateExtension"
  ADD COLUMN IF NOT EXISTS "MinContractMonths" integer,
  ADD COLUMN IF NOT EXISTS "RequiresGuarantee" boolean,
  ADD COLUMN IF NOT EXISTS "GuaranteeType" text,
  ADD COLUMN IF NOT EXISTS "AllowsPets" boolean;

-- Optional: if you previously had data in AnnualRentExtension that you want to preserve,
-- you can migrate it into RealEstateExtension here. This block assumes that any
-- EstateProperty that had an AnnualRentExtension row should keep those values under
-- its RealEstateExtension row. Adjust this logic to match your real data model.
DO $$
BEGIN
  -- This is written defensively: only updates RealEstateExtension rows that already exist.
  UPDATE public."RealEstateExtension" re
  SET
    "MinContractMonths" = COALESCE(re."MinContractMonths", ar."MinContractMonths"),
    "RequiresGuarantee" = COALESCE(re."RequiresGuarantee", ar."RequiresGuarantee"),
    "GuaranteeType" = COALESCE(re."GuaranteeType", ar."GuaranteeType"),
    "AllowsPets" = COALESCE(re."AllowsPets", ar."AllowsPets")
  FROM public."AnnualRentExtension" ar
  WHERE re."EstatePropertyId" = ar."EstatePropertyId";
END;
$$;


-- 3) Drop AnnualRentExtension table and its constraints/grants

-- Drop FKs and PK if they still exist (wrapped in DO blocks so reruns are safe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AnnualRentExtension_EstatePropertyId_fkey'
  ) THEN
    ALTER TABLE public."AnnualRentExtension"
      DROP CONSTRAINT "AnnualRentExtension_EstatePropertyId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AnnualRentExtension_pkey'
  ) THEN
    ALTER TABLE public."AnnualRentExtension"
      DROP CONSTRAINT "AnnualRentExtension_pkey";
  END IF;
END;
$$;

-- Drop the table itself.
DROP TABLE IF EXISTS public."AnnualRentExtension";

-- Note: ACL/grant cleanup is optional; keeping them does not affect runtime
-- once the table is dropped. If you prefer, you can explicitly drop/recreate
-- any relevant privileges here.

