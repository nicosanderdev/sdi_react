-- NOTE: This migration is drafted and NOT yet applied.
-- Please review, adjust if needed, and run manually in your Supabase project.

-- 1) Create PropertyCategory enum in the public schema, if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PropertyCategory'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public."PropertyCategory" AS ENUM (
      'Casa',
      'Apartamento',
      'Terreno',
      'Chacra',
      'Campo'
    );
  END IF;
END;
$$;

-- 2) Add Category column to RealEstateExtension using the new enum.
ALTER TABLE public."RealEstateExtension"
  ADD COLUMN IF NOT EXISTS "Category" public."PropertyCategory";

