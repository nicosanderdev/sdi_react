-- Add test users for end-to-end testing
-- This migration creates test user accounts that can be used for Playwright e2e tests

-- Insert test user into Supabase auth.users (this is handled by Supabase auth automatically)
-- We need to create corresponding entries in our Members table

-- Test User 1: Basic user with property creation permissions
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
) VALUES (
    'fb14039e-4a32-4593-9236-7d5170ffe987',
    'test@example.com',
    -- Password: "testpassword123" (bcrypt hash)
    '$2a$10$ck8e5zULdYkyjiWgwvknT.45oTMnBCaR.8wczqZOEVLhgF25AYZ/K',
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Test User"}'::jsonb,
    false
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding member record
INSERT INTO "public"."Members" (
    "Id",
    "UserId",
    "FirstName",
    "LastName",
    "Phone",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
) VALUES (
    'fb14039e-4a32-4593-9236-7d5170ffe988',
    'fb14039e-4a32-4593-9236-7d5170ffe987',
    'Test',
    'User',
    '+598 99 123 456',
    'User',
    false,
    NOW(),
    NOW()
) ON CONFLICT ("UserId") DO NOTHING;

-- Set up member status as active (only if member exists)
INSERT INTO "public"."MemberStatus" (
    "Id",
    "MemberId",
    "Status",
    "ChangedBy",
    "ChangedAt"
)
SELECT
    gen_random_uuid(),
    'fb14039e-4a32-4593-9236-7d5170ffe988',
    'active',
    'fb14039e-4a32-4593-9236-7d5170ffe988',
    NOW()
WHERE EXISTS (
    SELECT 1 FROM "public"."Members"
    WHERE "Id" = 'fb14039e-4a32-4593-9236-7d5170ffe988'
) ON CONFLICT DO NOTHING;

-- Complete onboarding for the test user (only if member exists)
INSERT INTO "public"."MemberOnboarding" (
    "Id",
    "MemberId",
    "OnboardingStep",
    "IsComplete",
    "CompletedAt"
)
SELECT
    gen_random_uuid(),
    'fb14039e-4a32-4593-9236-7d5170ffe988',
    10,
    true,
    NOW()
WHERE EXISTS (
    SELECT 1 FROM "public"."Members"
    WHERE "Id" = 'fb14039e-4a32-4593-9236-7d5170ffe988'
) ON CONFLICT DO NOTHING;

-- Test User 2: Company admin user
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
) VALUES (
    'b99c57ef-4fab-4615-9ccc-83a534c54601',
    'admin@testcompany.com',
    -- Password: "adminpassword123" (bcrypt hash)
    '$2a$10$37I3ffAX/N3Gwyiyz.zBlOxsxBaxrmrfN12hhSctkBMPGOCpKzyh.',
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"full_name": "Company Admin"}'::jsonb,
    false
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding member record for company admin
INSERT INTO "public"."Members" (
    "Id",
    "UserId",
    "FirstName",
    "LastName",
    "Phone",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
) VALUES (
    'b99c57ef-4fab-4615-9ccc-83a534c54602',
    'b99c57ef-4fab-4615-9ccc-83a534c54601',
    'Company',
    'Admin',
    '+598 99 654 321',
    'Admin',
    false,
    NOW(),
    NOW()
) ON CONFLICT ("UserId") DO NOTHING;

-- Set up member status as active for admin (only if member exists)
INSERT INTO "public"."MemberStatus" (
    "Id",
    "MemberId",
    "Status",
    "ChangedBy",
    "ChangedAt"
)
SELECT
    gen_random_uuid(),
    'b99c57ef-4fab-4615-9ccc-83a534c54602',
    'active',
    'b99c57ef-4fab-4615-9ccc-83a534c54602',
    NOW()
WHERE EXISTS (
    SELECT 1 FROM "public"."Members"
    WHERE "Id" = 'b99c57ef-4fab-4615-9ccc-83a534c54602'
) ON CONFLICT DO NOTHING;

-- Complete onboarding for the admin user (only if member exists)
INSERT INTO "public"."MemberOnboarding" (
    "Id",
    "MemberId",
    "OnboardingStep",
    "IsComplete",
    "CompletedAt"
)
SELECT
    gen_random_uuid(),
    'b99c57ef-4fab-4615-9ccc-83a534c54602',
    10,
    true,
    NOW()
WHERE EXISTS (
    SELECT 1 FROM "public"."Members"
    WHERE "Id" = 'b99c57ef-4fab-4615-9ccc-83a534c54602'
) ON CONFLICT DO NOTHING;

-- Create a test company for the admin user
INSERT INTO "public"."Companies" (
    "Id",
    "Name",
    "BillingContactUserId",
    "BillingEmail",
    "CreatedAt",
    "Street",
    "City",
    "State",
    "Country",
    "Phone",
    "IsDeleted",
    "Created",
    "LastModified"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'Test Real Estate Company',
    'b99c57ef-4fab-4615-9ccc-83a534c54602',
    'info@testcompany.com',
    NOW(),
    'Avenida 18 de Julio 1234',
    'Montevideo',
    'Montevideo',
    'Uruguay',
    '+598 2 123 4567',
    false,
    NOW(),
    NOW()
) ON CONFLICT ("Id") DO NOTHING;

-- Add the admin user to the company (only if member and company exist)
INSERT INTO "public"."UserCompanies" (
    "Id",
    "MemberId",
    "CompanyId",
    "Role",
    "AddedBy",
    "JoinedAt",
    "IsDeleted"
)
SELECT
    gen_random_uuid(),
    'b99c57ef-4fab-4615-9ccc-83a534c54602',
    '550e8400-e29b-41d4-a716-446655440003',
    'Admin', -- Admin role for company management
    'b99c57ef-4fab-4615-9ccc-83a534c54602',
    NOW(),
    false
WHERE EXISTS (
    SELECT 1 FROM "public"."Members"
    WHERE "Id" = 'b99c57ef-4fab-4615-9ccc-83a534c54602'
) AND EXISTS (
    SELECT 1 FROM "public"."Companies"
    WHERE "Id" = '550e8400-e29b-41d4-a716-446655440003'
) ON CONFLICT DO NOTHING;
