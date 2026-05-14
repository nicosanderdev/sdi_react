-- ============================================================================
-- SEED DATA FOR SUPABASE DATABASE
-- ============================================================================
-- Loaded after migrations on database reset.
-- Contents:
--   - Optional enum bootstrap (company_roles, plan_keys) when not already present
--   - CREATE EXTENSION pgcrypto (for gen_random_uuid in Amenities seed)
--   - Reference data: Amenities, Plans (flexible-pricing upsert)
--
-- Object storage is outside Supabase (external provider, e.g. R2); this file does
-- not insert into storage.buckets.
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENUM TYPES
-- ============================================================================

-- Create company_roles enum type (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_roles') THEN
        CREATE TYPE company_roles AS ENUM ('admin', 'manager', 'member');
    END IF;
END $$;

-- Create plan_keys enum type (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_keys') THEN
        CREATE TYPE plan_keys AS ENUM ('free', 'manager', 'manager_pro', 'company_small', 'company_unlimited');
    END IF;
END $$;

-- ============================================================================
-- SECTION 2: SEED DATA
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO public."Amenities" ("Id", "Name", "IconId", "IsDeleted", "PropertyType") VALUES

-- UNIVERSALES (los 3 tipos)

(gen_random_uuid(), 'Wi-Fi / Internet', 'wifi', false, 'RealEstate'),
(gen_random_uuid(), 'Wi-Fi / Internet', 'wifi', false, 'SummerRent'),
(gen_random_uuid(), 'Wi-Fi / Internet', 'wifi', false, 'EventVenue'),

(gen_random_uuid(), 'Aire acondicionado', 'snowflake', false, 'RealEstate'),
(gen_random_uuid(), 'Aire acondicionado', 'snowflake', false, 'SummerRent'),
(gen_random_uuid(), 'Aire acondicionado', 'snowflake', false, 'EventVenue'),

(gen_random_uuid(), 'Calefacción', 'thermometer', false, 'RealEstate'),
(gen_random_uuid(), 'Calefacción', 'thermometer', false, 'SummerRent'),
(gen_random_uuid(), 'Calefacción', 'thermometer', false, 'EventVenue'),

(gen_random_uuid(), 'Estacionamiento', 'car', false, 'RealEstate'),
(gen_random_uuid(), 'Estacionamiento', 'car', false, 'SummerRent'),
(gen_random_uuid(), 'Estacionamiento', 'car', false, 'EventVenue'),

(gen_random_uuid(), 'Seguridad / CCTV', 'shield', false, 'RealEstate'),
(gen_random_uuid(), 'Seguridad / CCTV', 'shield', false, 'SummerRent'),
(gen_random_uuid(), 'Seguridad / CCTV', 'shield', false, 'EventVenue'),

(gen_random_uuid(), 'Acceso para silla de ruedas', 'accessibility', false, 'RealEstate'),
(gen_random_uuid(), 'Acceso para silla de ruedas', 'accessibility', false, 'SummerRent'),
(gen_random_uuid(), 'Acceso para silla de ruedas', 'accessibility', false, 'EventVenue'),

(gen_random_uuid(), 'Vista al mar', 'waves', false, 'RealEstate'),
(gen_random_uuid(), 'Vista al mar', 'waves', false, 'SummerRent'),
(gen_random_uuid(), 'Vista a la montaña', 'mountain', false, 'RealEstate'),
(gen_random_uuid(), 'Vista a la montaña', 'mountain', false, 'SummerRent'),
(gen_random_uuid(), 'Vista a la ciudad', 'building', false, 'RealEstate'),
(gen_random_uuid(), 'Vista a la ciudad', 'building', false, 'SummerRent'),

-- REAL ESTATE + SUMMER RENT

(gen_random_uuid(), 'Piscina', 'pool', false, 'RealEstate'),
(gen_random_uuid(), 'Piscina', 'pool', false, 'SummerRent'),

(gen_random_uuid(), 'Jardín', 'leaf', false, 'RealEstate'),
(gen_random_uuid(), 'Jardín', 'leaf', false, 'SummerRent'),

(gen_random_uuid(), 'Balcón', 'balcony', false, 'RealEstate'),
(gen_random_uuid(), 'Balcón', 'balcony', false, 'SummerRent'),

(gen_random_uuid(), 'Terraza', 'sun', false, 'RealEstate'),
(gen_random_uuid(), 'Terraza', 'sun', false, 'SummerRent'),

(gen_random_uuid(), 'Parrillero', 'grill', false, 'RealEstate'),
(gen_random_uuid(), 'Parrillero', 'grill', false, 'SummerRent'),

(gen_random_uuid(), 'Amueblado', 'sofa', false, 'RealEstate'),
(gen_random_uuid(), 'Amueblado', 'sofa', false, 'SummerRent'),

(gen_random_uuid(), 'Lavadero', 'washing-machine', false, 'RealEstate'),
(gen_random_uuid(), 'Lavadero', 'washing-machine', false, 'SummerRent'),

(gen_random_uuid(), 'Chimenea', 'flame', false, 'RealEstate'),
(gen_random_uuid(), 'Chimenea', 'flame', false, 'SummerRent'),

(gen_random_uuid(), 'Mascotas permitidas', 'pets-allowed', false, 'RealEstate'),
(gen_random_uuid(), 'Mascotas permitidas', 'pets-allowed', false, 'SummerRent'),

(gen_random_uuid(), 'Apto para mascotas', 'paw', false, 'RealEstate'),
(gen_random_uuid(), 'Apto para mascotas', 'paw', false, 'SummerRent'),

-- SOLO REAL ESTATE

(gen_random_uuid(), 'Ascensor', 'elevator', false, 'RealEstate'),
(gen_random_uuid(), 'Depósito', 'archive', false, 'RealEstate'),
(gen_random_uuid(), 'Paneles solares', 'sun-electric', false, 'RealEstate'),
(gen_random_uuid(), 'Generador de respaldo', 'battery', false, 'RealEstate'),
(gen_random_uuid(), 'Sistema de casa inteligente', 'cpu', false, 'RealEstate'),
(gen_random_uuid(), 'Estacionamiento privado', 'garage', false, 'RealEstate'),
(gen_random_uuid(), 'Comunidad cerrada', 'gate', false, 'RealEstate'),
(gen_random_uuid(), 'Conserjería 24h', 'user-shield', false, 'RealEstate'),

-- SOLO SUMMER RENT

(gen_random_uuid(), 'Parque infantil', 'baby', false, 'SummerRent'),

-- SOLO EVENT VENUE

(gen_random_uuid(), 'Sala de conferencias', 'briefcase', false, 'EventVenue'),
(gen_random_uuid(), 'Recepción', 'reception', false, 'EventVenue'),

-- EVENT VENUE + SUMMER RENT (uso híbrido interesante)

(gen_random_uuid(), 'Piscina', 'pool', false, 'EventVenue'),
(gen_random_uuid(), 'Jardín', 'leaf', false, 'EventVenue')

ON CONFLICT DO NOTHING;

-- Reference plans with flexible-pricing fields (migration-safe: only if column exists).
-- Upserts by "Id"; fills NOT NULL legacy columns aligned with listing limits and app Key mapping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Plans'
      AND column_name = 'PricingModel'
  ) THEN
    INSERT INTO public."Plans" (
      "Id",
      "Key",
      "Name",
      "MonthlyPrice",
      "Currency",
      "MaxProperties",
      "MaxPublishedProperties",
      "MaxUsers",
      "MaxStorageMb",
      "BillingCycle",
      "IsActive",
      "IsDeleted",
      "Created",
      "LastModified",
      "PricingModel",
      "Price",
      "MinMonthlyFee",
      "PricePerBooking",
      "ListingLimit",
      "DurationDays",
      "IsActiveV2"
    )
    VALUES
      (
        '11111111-1111-4111-8111-111111111111'::uuid,
        0,
        'Free',
        0,
        'USD',
        3,
        3,
        1,
        512,
        30,
        true,
        false,
        now(),
        now(),
        'hybrid',
        0,
        0,
        NULL,
        3,
        30,
        true
      ),
      (
        '22222222-2222-4222-8222-222222222222'::uuid,
        1,
        'Manager Pro',
        29,
        'USD',
        25,
        25,
        5,
        4096,
        30,
        true,
        false,
        now(),
        now(),
        'hybrid',
        NULL,
        29,
        2.5,
        25,
        30,
        true
      ),
      (
        '33333333-3333-4333-8333-333333333333'::uuid,
        2,
        'Company Small',
        15,
        'USD',
        200,
        200,
        50,
        8192,
        30,
        true,
        false,
        now(),
        now(),
        'per_listing',
        15,
        NULL,
        NULL,
        200,
        30,
        true
      )
    ON CONFLICT ("Id") DO UPDATE SET
      "Key" = excluded."Key",
      "Name" = excluded."Name",
      "MonthlyPrice" = excluded."MonthlyPrice",
      "Currency" = excluded."Currency",
      "MaxProperties" = excluded."MaxProperties",
      "MaxPublishedProperties" = excluded."MaxPublishedProperties",
      "MaxUsers" = excluded."MaxUsers",
      "MaxStorageMb" = excluded."MaxStorageMb",
      "BillingCycle" = excluded."BillingCycle",
      "IsActive" = excluded."IsActive",
      "IsDeleted" = excluded."IsDeleted",
      "LastModified" = excluded."LastModified",
      "PricingModel" = excluded."PricingModel",
      "Price" = excluded."Price",
      "MinMonthlyFee" = excluded."MinMonthlyFee",
      "PricePerBooking" = excluded."PricePerBooking",
      "ListingLimit" = excluded."ListingLimit",
      "DurationDays" = excluded."DurationDays",
      "IsActiveV2" = excluded."IsActiveV2";
  END IF;
END $$;