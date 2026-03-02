-- ============================================================================
-- MIGRATION: Add test subscriptions, properties and bookings for e2e tests
-- ============================================================================
-- This migration seeds deterministic data used by Playwright end-to-end tests:
--   - Subscriptions for the existing test users (free plan for basic user)
--   - Owners and properties for those users
--   - Bookings in different statuses (pending / confirmed / completed)
--
-- Notes:
-- - Uses the test users created in 20251222100000_add_test_users_for_e2e.sql:
--     * Basic user:
--         auth.users.id  = 'fb14039e-4a32-4593-9236-7d5170ffe987'
--         Members.Id     = 'fb14039e-4a32-4593-9236-7d5170ffe988'
--     * Company admin user (not used directly in this seed for now):
--         auth.users.id  = 'b99c57ef-4fab-4615-9ccc-83a534c54601'
--         Members.Id     = 'b99c57ef-4fab-4615-9ccc-83a534c54602'
--
-- - Uses the plans seeded in supabase/seed.sql:
--     * Inicial      (Key = 0, Id = 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789')
--     * Profesional  (Key = 1, Id = 'b2c3d4e5-f6a7-4890-b123-c4d5e6f7a890')
--     * Inmobiliaria (Key = 2, Id = 'c3d4e5f6-a7b8-4901-c234-d5e6f7a8b901')
--
-- - All IDs below are fixed so tests can rely on them.
-- - This seed is safe to run multiple times thanks to ON CONFLICT checks.
-- ============================================================================

-- Ensure BookingReceiptMinimumAmount is low enough for tests on Inicial plan
UPDATE public."Plans"
SET "BookingReceiptMinimumAmount" = COALESCE("BookingReceiptMinimumAmount", 10)
WHERE "Id" = 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789'::uuid;

-- ============================================================================
-- SECTION 1: Owners and Properties for basic test user
-- ============================================================================

-- Owner for basic test user as member owner
INSERT INTO public."Owners" (
  "Id",
  "OwnerType",
  "MemberId",
  "CompanyId",
  "IsDeleted"
)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'member',
  'fb14039e-4a32-4593-9236-7d5170ffe988'::uuid,
  NULL,
  FALSE
)
ON CONFLICT ("Id") DO NOTHING;

-- EstateProperty for basic user
INSERT INTO public."EstateProperties" (
  "Id",
  "StreetName",
  "HouseNumber",
  "Neighborhood",
  "City",
  "State",
  "ZipCode",
  "Country",
  "LocationLatitude",
  "LocationLongitude",
  "Title",
  "Type",
  "AreaValue",
  "AreaUnit",
  "Bedrooms",
  "Bathrooms",
  "HasGarage",
  "GarageSpaces",
  "Visits",
  "MainImageId",
  "OwnerId",
  "IsDeleted",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
VALUES (
  '33333333-3333-3333-3333-333333333331'::uuid,
  'Av. 18 de Julio',
  '1000',
  'Centro',
  'Montevideo',
  'Montevideo',
  '11000',
  'Uruguay',
  -34.905,
  -56.191,
  'E2E Test Property - Inicial Plan',
  0,          -- Type: house
  80,         -- AreaValue
  0,          -- AreaUnit: m²
  2,          -- Bedrooms
  1,          -- Bathrooms
  FALSE,      -- HasGarage
  0,          -- GarageSpaces
  0,          -- Visits
  NULL,
  '11111111-1111-1111-1111-111111111111'::uuid,
  FALSE,
  NOW(),
  'e2e-seed',
  NOW(),
  'e2e-seed'
)
ON CONFLICT ("Id") DO NOTHING;

-- Latest value row for the property
INSERT INTO public."EstatePropertyValues" (
  "Id",
  "Description",
  "AvailableFrom",
  "Capacity",
  "Currency",
  "SalePrice",
  "RentPrice",
  "HasCommonExpenses",
  "CommonExpensesValue",
  "IsElectricityIncluded",
  "IsWaterIncluded",
  "IsPriceVisible",
  "Status",
  "IsActive",
  "IsPropertyVisible",
  "IsFeatured",
  "EstatePropertyId",
  "IsDeleted",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
VALUES (
  '44444444-4444-4444-4444-444444444441'::uuid,
  'E2E property values for bookings & receipts tests',
  NOW(),
  4,
  0,          -- Currency: 0 = USD
  NULL,
  120,
  FALSE,
  NULL,
  FALSE,
  FALSE,
  TRUE,
  1,          -- Status (e.g. active / for rent)
  TRUE,
  TRUE,
  FALSE,
  '33333333-3333-3333-3333-333333333331'::uuid,
  FALSE,
  NOW(),
  'e2e-seed',
  NOW(),
  'e2e-seed'
)
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================================
-- SECTION 2: Subscription for basic user on Inicial plan
-- ============================================================================

-- Active subscription for basic user on Inicial plan.
-- For OwnerType = 0 we follow the app convention: OwnerId = auth user id.
INSERT INTO public."Subscriptions" (
  "Id",
  "OwnerType",
  "OwnerId",
  "ProviderCustomerId",
  "ProviderSubscriptionId",
  "PlanId",
  "Status",
  "CurrentPeriodStart",
  "CurrentPeriodEnd",
  "CancelAtPeriodEnd",
  "CreatedAt",
  "UpdatedAt",
  "CompanyId",
  "IsDeleted",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
VALUES (
  '55555555-5555-5555-5555-555555555551'::uuid,
  0,  -- OwnerType: 0 = member/user
  'fb14039e-4a32-4593-9236-7d5170ffe987'::uuid, -- auth.users.id for test@example.com
  NULL,
  NULL,
  'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789'::uuid, -- Inicial plan
  1,     -- Status: 1 = active
  NOW() - INTERVAL '30 days',
  NOW() + INTERVAL '30 days',
  FALSE,
  NOW() - INTERVAL '30 days',
  NOW(),
  NULL,
  FALSE,
  NOW(),
  'e2e-seed',
  NOW(),
  'e2e-seed'
)
ON CONFLICT ("Id") DO NOTHING;

-- ============================================================================
-- SECTION 3: Bookings for the basic user's property
-- ============================================================================

-- Helper note: BookingStatus enum (CalendarSync) mapping:
--   0 = Pending, 1 = Confirmed, 2 = Cancelled, 3 = Completed, 4 = NoShow

-- Pending future booking (appears in "Pendientes" with actions)
INSERT INTO public."Bookings" (
  "Id",
  "EstatePropertyId",
  "GuestId",
  "CheckInDate",
  "CheckOutDate",
  "Status",
  "ValidationStatus",
  "HasConflict",
  "ConflictReason",
  "GuestCount",
  "TotalAmount",
  "Currency",
  "Notes",
  "BookingSource",
  "ExternalBookingId",
  "IsDeleted",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
VALUES (
  '66666666-6666-6666-6666-666666666661'::uuid,
  '33333333-3333-3333-3333-333333333331'::uuid,
  'fb14039e-4a32-4593-9236-7d5170ffe988'::uuid, -- basic Member as guest
  (CURRENT_DATE + INTERVAL '10 days')::date,
  (CURRENT_DATE + INTERVAL '12 days')::date,
  0,   -- Pending
  0,
  FALSE,
  NULL,
  2,
  300,
  0,   -- USD
  'E2E Pending Booking - should be accept/reject-able',
  'internal',
  NULL,
  FALSE,
  NOW(),
  'e2e-seed',
  NOW(),
  'e2e-seed'
)
ON CONFLICT ("Id") DO NOTHING;

-- Confirmed upcoming booking (appears in "Próximas / Actuales")
INSERT INTO public."Bookings" (
  "Id",
  "EstatePropertyId",
  "GuestId",
  "CheckInDate",
  "CheckOutDate",
  "Status",
  "ValidationStatus",
  "HasConflict",
  "ConflictReason",
  "GuestCount",
  "TotalAmount",
  "Currency",
  "Notes",
  "BookingSource",
  "ExternalBookingId",
  "IsDeleted",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
VALUES (
  '77777777-7777-7777-7777-777777777771'::uuid,
  '33333333-3333-3333-3333-333333333331'::uuid,
  'fb14039e-4a32-4593-9236-7d5170ffe988'::uuid,
  (CURRENT_DATE + INTERVAL '5 days')::date,
  (CURRENT_DATE + INTERVAL '7 days')::date,
  1,   -- Confirmed
  1,
  FALSE,
  NULL,
  3,
  500,
  0,
  'E2E Confirmed Booking - upcoming',
  'internal',
  NULL,
  FALSE,
  NOW() - INTERVAL '1 day',
  'e2e-seed',
  NOW() - INTERVAL '1 day',
  'e2e-seed'
)
ON CONFLICT ("Id") DO NOTHING;

-- Completed past booking (used to generate commission receipts)
INSERT INTO public."Bookings" (
  "Id",
  "EstatePropertyId",
  "GuestId",
  "CheckInDate",
  "CheckOutDate",
  "Status",
  "ValidationStatus",
  "HasConflict",
  "ConflictReason",
  "GuestCount",
  "TotalAmount",
  "Currency",
  "Notes",
  "BookingSource",
  "ExternalBookingId",
  "IsDeleted",
  "Created",
  "CreatedBy",
  "LastModified",
  "LastModifiedBy"
)
VALUES (
  '88888888-8888-8888-8888-888888888881'::uuid,
  '33333333-3333-3333-3333-333333333331'::uuid,
  'fb14039e-4a32-4593-9236-7d5170ffe988'::uuid,
  (CURRENT_DATE - INTERVAL '20 days')::date,
  (CURRENT_DATE - INTERVAL '18 days')::date,
  3,   -- Completed
  1,
  FALSE,
  NULL,
  2,
  800,
  0,
  'E2E Completed Booking - for receipt commission',
  'internal',
  NULL,
  FALSE,
  NOW() - INTERVAL '20 days',
  'e2e-seed',
  NOW() - INTERVAL '18 days',
  'e2e-seed'
)
ON CONFLICT ("Id") DO NOTHING;

