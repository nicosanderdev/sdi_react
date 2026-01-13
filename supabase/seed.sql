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
INSERT INTO public."Plans" ("Id", "Key", "Name", "MonthlyPrice", "Currency", "MaxProperties", "MaxUsers", "MaxStorageMb", "BillingCycle", "IsActive", "IsDeleted", "Created", "CreatedBy", "LastModified", "LastModifiedBy") VALUES
('9f9a6d25-94f2-4f8d-bbcb-1d2b5678c001', 0, 'Free User', 0, 'USD', 3, 1, 50, 1, true, false, '2025-11-12 10:14:14.231-03'::timestamptz, 'system', '2025-11-12 10:14:14.231-03'::timestamptz, 'system'),
('b2eabf63-65f8-4c43-8f3d-8abfd43e2c02', 1, 'Manager (Basic)', 9.99, 'USD', 20, 3, 500, 1, true, false, '2025-11-12 10:14:14.231-03'::timestamptz, 'system', '2025-11-12 10:14:14.231-03'::timestamptz, 'system'),
('d4b5c6e7-f8a9-4b2c-8d3e-9f1a2b3c4d5e', 4, 'Manager Pro', 19.99, 'USD', 50, 5, 1000, 1, true, false, '2025-11-12 10:14:14.231-03'::timestamptz, 'system', '2025-11-12 10:14:14.231-03'::timestamptz, 'system'),
('e3f92f84-48a2-4f1b-9e2c-5a13fd98b303', 2, 'Real Estate Company (Small)', 29.99, 'USD', 100, 10, 2000, 1, true, false, '2025-11-12 10:14:14.231-03'::timestamptz, 'system', '2025-11-12 10:14:14.231-03'::timestamptz, 'system'),
('c5adf485-0a2d-4f91-913e-2dcd76f4d404', 3, 'Real Estate Company (Unlimited)', 99.99, 'USD', 999999, 999999, 100000, 1, true, false, '2025-11-12 10:14:14.231-03'::timestamptz, 'system', '2025-11-12 10:14:14.231-03'::timestamptz, 'system')
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================================
-- SECTION 3: STORAGE BUCKETS
-- ============================================================================

-- Create property-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create property-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-documents', 'property-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
