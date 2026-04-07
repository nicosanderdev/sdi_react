-- ============================================================================
-- SEED DATA FOR SUPABASE DATABASE
-- ============================================================================
-- This file contains seed data that will be loaded when the database is reset.
-- It includes:
--   - ENUM types
--   - Seed data (Amenities, Plans)
--   - Storage buckets
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

-- Insert seed data for flexible billing plans.
-- Uses deterministic IDs and upsert semantics so it can be re-run safely.
INSERT INTO public."Plans" (
    "Id",
    "Key",
    "Name",
    "MonthlyPrice",
    "Currency",
    "MaxProperties",
    "MaxUsers",
    "MaxStorageMb",
    "BillingCycle",
    "IsActive",
    "IsDeleted",
    "Created",
    "CreatedBy",
    "LastModified",
    "LastModifiedBy",
    "MaxPublishedProperties",
    "CommissionPercentage",
    "CommissionMinimumAmount",
    "ExtraPropertiesPrice11to30",
    "ExtraPropertiesPrice31Plus",
    "BookingReceiptMinimumAmount",
    "PropertyType"
) VALUES
('11111111-1111-4111-8111-111111111111'::uuid, 0, 'Free Plan', 0, 'USD', 3, 1, 100, 1, true, false, NOW(), 'system', NOW(), 'system', 3, NULL, NULL, NULL, NULL, NULL, 'RealEstate'::"PropertyType"),
('22222222-2222-4222-8222-222222222222'::uuid, 1, 'Starter Plan', 29, 'USD', 25, 3, 500, 1, true, false, NOW(), 'system', NOW(), 'system', 25, NULL, NULL, NULL, NULL, NULL, 'RealEstate'::"PropertyType"),
('33333333-3333-4333-8333-333333333333'::uuid, 2, 'Pro Plan', 15, 'USD', 200, 10, 2000, 1, true, false, NOW(), 'system', NOW(), 'system', 200, NULL, NULL, NULL, NULL, NULL, 'RealEstate'::"PropertyType")
ON CONFLICT ("Id") DO UPDATE
SET
  "Name" = EXCLUDED."Name",
  "MonthlyPrice" = EXCLUDED."MonthlyPrice",
  "Currency" = EXCLUDED."Currency",
  "MaxProperties" = EXCLUDED."MaxProperties",
  "MaxUsers" = EXCLUDED."MaxUsers",
  "MaxStorageMb" = EXCLUDED."MaxStorageMb",
  "BillingCycle" = EXCLUDED."BillingCycle",
  "IsActive" = EXCLUDED."IsActive",
  "IsDeleted" = EXCLUDED."IsDeleted",
  "LastModified" = NOW(),
  "LastModifiedBy" = 'system',
  "MaxPublishedProperties" = EXCLUDED."MaxPublishedProperties";

-- Populate flexible-pricing columns only if they exist (migration-safe seed).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Plans'
      AND column_name = 'PricingModel'
  ) THEN
    UPDATE public."Plans"
    SET
      "PricingModel" = 'free',
      "Price" = 0,
      "MinMonthlyFee" = 0,
      "PricePerBooking" = NULL,
      "ListingLimit" = 3,
      "DurationDays" = NULL,
      "IsActiveV2" = true
    WHERE "Id" = '11111111-1111-4111-8111-111111111111'::uuid;

    UPDATE public."Plans"
    SET
      "PricingModel" = 'hybrid',
      "Price" = NULL,
      "MinMonthlyFee" = 29,
      "PricePerBooking" = 2.5,
      "ListingLimit" = 25,
      "DurationDays" = 30,
      "IsActiveV2" = true
    WHERE "Id" = '22222222-2222-4222-8222-222222222222'::uuid;

    UPDATE public."Plans"
    SET
      "PricingModel" = 'per_listing',
      "Price" = 15,
      "MinMonthlyFee" = NULL,
      "PricePerBooking" = NULL,
      "ListingLimit" = 200,
      "DurationDays" = 30,
      "IsActiveV2" = true
    WHERE "Id" = '33333333-3333-4333-8333-333333333333'::uuid;
  END IF;
END $$;

-- SECTION 3: STORAGE BUCKETS
-- ============================================================================

-- Create property_images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property_images', 'property_images', true)
ON CONFLICT (id) DO NOTHING;

-- Create property_documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property_documents', 'property_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
