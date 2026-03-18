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

-- Insert seed data for Amenities table (only if not exists)
INSERT INTO public."Amenities" ("Id", "Name", "IconId", "IsDeleted") VALUES
('5198921e-4d0c-49c1-86fd-726177e60ffc', 'Mascotas permitidas', 'pets-allowed', false),
('5f36446d-d299-4d6b-8d31-9af39d2b5ac6', 'Piscina', 'pool', false),
('76522dcc-c792-47a6-8cc1-ce246fba6b80', 'Gimnasio', 'dumbbell', false),
('c66968cb-a191-48f7-be06-b6b6bf5465b6', 'Estacionamiento', 'car', false),
('32132e75-a85f-465f-9e97-253657f0c17b', 'Ascensor', 'elevator', false),
('6cbee771-c1cb-497a-bb63-60e2b77e06be', 'Balcón', 'balcony', false),
('b0d13ab0-efa2-4305-8a7d-1161ca275898', 'Jardín', 'leaf', false),
('e935309b-d252-44fc-9e28-a067ce4b8e88', 'Seguridad / CCTV', 'shield', false),
('0deaa584-11d0-40e5-b945-e541080e1d11', 'Parque infantil', 'baby', false),
('f43d3e03-cbaf-488b-93d4-5bbe4675d825', 'Apto para mascotas', 'paw', false),
('56b759b0-7c20-46b0-ae15-383277b94569', 'Aire acondicionado', 'snowflake', false),
('d986dbd8-b1a3-4825-8fba-a93068f298c5', 'Calefacción', 'thermometer', false),
('d69e1591-3811-406c-bc3b-ee966552a707', 'Amueblado', 'sofa', false),
('ffa90b48-3bba-42aa-8531-c66ff5d0eb7c', 'Wi-Fi / Internet', 'wifi', false),
('c17d38b9-604b-4a2c-bfd0-ea47c41980d0', 'Lavadero', 'washing-machine', false),
('de624fe0-d4ec-4ecd-8418-a455c2c7bd56', 'Depósito', 'archive', false),
('1ae60c1c-87eb-488c-a854-10b63b5ead91', 'Chimenea', 'flame', false),
('8ca987c0-06fe-4559-8246-017b3bacd96d', 'Terraza', 'sun', false),
('3fe5f7b8-268b-4e63-9479-66f6477959ab', 'Parrillero', 'grill', false),
('4a1bc170-40cd-43b5-ab69-6e65bb22be61', 'Acceso para silla de ruedas', 'accessibility', false),
('22a21cd1-0f6d-4c4e-ad49-861ed8a596fe', 'Conserjería 24h', 'user-shield', false),
('0f5fc509-b16a-4ce8-b30b-9fab95bb0447', 'Vista al mar', 'waves', false),
('9ed0c264-9740-45af-8e1a-6b36fd410f71', 'Vista a la montaña', 'mountain', false),
('6600d34e-f424-471a-9d4b-e23d6c33863c', 'Vista a la ciudad', 'building', false),
('57ee3939-9c72-4435-bb0d-19562ce7d508', 'Paneles solares', 'sun-electric', false),
('fbd7353e-8deb-4c30-84cd-391444905050', 'Generador de respaldo', 'battery', false),
('ea22959c-af77-4477-b60a-f40c2e7c6338', 'Sistema de casa inteligente', 'cpu', false),
('1f401285-40c2-4747-be53-4f2e467483d7', 'Estacionamiento privado', 'garage', false),
('62becb6d-b18b-4ee9-895b-c22f5e402190', 'Comunidad cerrada', 'gate', false),
('b928b351-315a-41c6-a3f6-e2e3206f281a', 'Sala de conferencias', 'briefcase', false),
('589a8389-e6ca-4247-bfe7-2ffe0a94772d', 'Recepción', 'reception', false)
ON CONFLICT ("Id") DO NOTHING;

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
