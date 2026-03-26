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

-- Insert seed data for Plans table (only if not exists)
-- Plan 1: Inicial (Initial) - Up to 5 published properties, 7 total, Free, 6.5% commission (min USD 9), No extra properties
-- Plan 2: Profesional (Professional) - Up to 10 published properties, 12 total, USD 129/month, 3.5% commission, No extra properties
-- Plan 3: Inmobiliaria (Real Estate) - 10 included published, unlimited total, USD 199/month, 2.5% commission, USD 8 (11-30) / USD 5 (31+)
-- Each plan is duplicated for the four estate property types: RealEstate, AnnualRent, EventVenue, SummerRent
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
-- Inicial (Key 0) per property type
('a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789'::uuid, 0, 'Inicial - RealEstate', 0, 'USD', 7, 1, 50, 1, true, false, NOW(), 'system', NOW(), 'system', 5, 6.5, 9, NULL, NULL, NULL, 'RealEstate'::"PropertyType"),
('d1e2f3a4-b5c6-4789-d012-e3f4a5b6c7d8'::uuid, 0, 'Inicial - AnnualRent', 0, 'USD', 7, 1, 50, 1, true, false, NOW(), 'system', NOW(), 'system', 5, 6.5, 9, NULL, NULL, NULL, 'AnnualRent'::"PropertyType"),
('e2f3a4b5-c6d7-4890-e123-f4a5b6c7d8e9'::uuid, 0, 'Inicial - EventVenue', 0, 'USD', 7, 1, 50, 1, true, false, NOW(), 'system', NOW(), 'system', 5, 6.5, 9, NULL, NULL, NULL, 'EventVenue'::"PropertyType"),
('f3a4b5c6-d7e8-4901-f234-a5b6c7d8e9f0'::uuid, 0, 'Inicial - SummerRent', 0, 'USD', 7, 1, 50, 1, true, false, NOW(), 'system', NOW(), 'system', 5, 6.5, 9, NULL, NULL, NULL, 'SummerRent'::"PropertyType"),

-- Profesional (Key 1) per property type
('b2c3d4e5-f6a7-4890-b123-c4d5e6f7a890'::uuid, 1, 'Profesional - RealEstate', 129, 'USD', 12, 3, 500, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 3.5, NULL, NULL, NULL, NULL, 'RealEstate'::"PropertyType"),
('c4d5e6f7-a8b9-4a01-c234-d6e7f8a9b012'::uuid, 1, 'Profesional - AnnualRent', 129, 'USD', 12, 3, 500, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 3.5, NULL, NULL, NULL, NULL, 'AnnualRent'::"PropertyType"),
('d5e6f7a8-b9c0-4b12-d345-e7f8a9b0c123'::uuid, 1, 'Profesional - EventVenue', 129, 'USD', 12, 3, 500, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 3.5, NULL, NULL, NULL, NULL, 'EventVenue'::"PropertyType"),
('e6f7a8b9-c0d1-4c23-e456-f8a9b0c1d234'::uuid, 1, 'Profesional - SummerRent', 129, 'USD', 12, 3, 500, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 3.5, NULL, NULL, NULL, NULL, 'SummerRent'::"PropertyType"),

-- Inmobiliaria (Key 2) per property type
('c3d4e5f6-a7b8-4901-c234-d5e6f7a8b901'::uuid, 2, 'Inmobiliaria - RealEstate', 199, 'USD', 999999, 10, 2000, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 2.5, NULL, 8, 5, NULL, 'RealEstate'::"PropertyType"),
('d7e8f9a0-b1c2-4d34-e567-f9a0b1c2d345'::uuid, 2, 'Inmobiliaria - AnnualRent', 199, 'USD', 999999, 10, 2000, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 2.5, NULL, 8, 5, NULL, 'AnnualRent'::"PropertyType"),
('e8f9a0b1-c2d3-4e45-f678-a0b1c2d3e456'::uuid, 2, 'Inmobiliaria - EventVenue', 199, 'USD', 999999, 10, 2000, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 2.5, NULL, 8, 5, NULL, 'EventVenue'::"PropertyType"),
('f9a0b1c2-d3e4-4f56-a789-b1c2d3e4f567'::uuid, 2, 'Inmobiliaria - SummerRent', 199, 'USD', 999999, 10, 2000, 1, true, false, NOW(), 'system', NOW(), 'system', 10, 2.5, NULL, 8, 5, NULL, 'SummerRent'::"PropertyType")
ON CONFLICT ("Id") DO NOTHING;

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
