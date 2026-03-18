-- Migration: Add PropertyType to Amenities
-- NOTE: This migration is drafted and NOT yet applied.
-- Please review, adjust if needed, and run manually in your Supabase project.

BEGIN;

-- 1) Add PropertyType column to Amenities using existing PropertyType enum.
--    This assumes public."PropertyType" already exists (values like RealEstate, SummerRent, EventVenue).
ALTER TABLE public."Amenities"
  ADD COLUMN IF NOT EXISTS "PropertyType" public."PropertyType";

-- 2) Optional: index to efficiently filter amenities by property type when creating properties.
CREATE INDEX IF NOT EXISTS "IX_Amenities_PropertyType"
  ON public."Amenities" ("PropertyType");

COMMIT;