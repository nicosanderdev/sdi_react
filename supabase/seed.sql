-- ============================================================================
-- SEED DATA FOR SUPABASE DATABASE
-- ============================================================================
-- Loaded after migrations on database reset.
-- Contents:
--   - Optional enum bootstrap (company_roles, plan_keys) when not already present
--   - Reference data: Plans (six UYU catalog plans), AppParameters (dynamic pricing)
--   - Amenities catalog is seeded in migration 20260917180000_amenity_templates.sql
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

-- Amenities catalog (keys, localized copy, type intersections) lives in
-- supabase/migrations/20260917180000_amenity_templates.sql so db reset does not
-- insert a second copy of UUID rows.

-- UYU catalog. Upserts by "Id".
-- Plan gratuito compañía is inserted by migration 20260907180000 and stays active.
-- The five legacy seed plans are deactivated when those rows exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Plans'
      AND column_name = 'PricingModel'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Plans'
      AND column_name = 'Audience'
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
      "IsActiveV2",
      "BookingLimit",
      "CommissionPercentage",
      "CommissionMinimumAmount",
      "BookingReceiptMinimumAmount",
      "Audience"
    )
    VALUES
      (
        '77777777-7777-4777-8777-777777777777'::uuid,
        6, 'Standard', 0, 'UYU',
        10, 10, NULL, NULL,
        30, true, false, now(), now(),
        'per_booking', 0, 0, NULL,
        10, 30, true, NULL,
        5, 350, NULL,
        'member'
      ),
      (
        '88888888-8888-4888-8888-888888888888'::uuid,
        7, 'Partner', 0, 'UYU',
        20, 20, NULL, NULL,
        30, true, false, now(), now(),
        'per_booking', 0, 0, NULL,
        20, 30, true, NULL,
        4.5, 300, NULL,
        'member'
      ),
      (
        '99999999-9999-4999-8999-999999999999'::uuid,
        8, 'Premium', 0, 'UYU',
        NULL, NULL, NULL, NULL,
        30, true, false, now(), now(),
        'per_booking', 0, 0, NULL,
        NULL, 30, true, NULL,
        4, 250, NULL,
        'member'
      ),
      (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
        9, 'Monthly standard', 1500, 'UYU',
        20, 20, NULL, NULL,
        30, true, false, now(), now(),
        'hybrid', 1500, 1500, NULL,
        20, 30, true, NULL,
        NULL, NULL, NULL,
        'member'
      ),
      (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
        10, 'Company Standard', 0, 'UYU',
        20, 20, 10, NULL,
        30, true, false, now(), now(),
        'per_booking', 0, 0, NULL,
        20, 30, true, NULL,
        4.5, 300, NULL,
        'company'
      ),
      (
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
        11, 'Company Premium', 0, 'UYU',
        NULL, NULL, 10, NULL,
        30, true, false, now(), now(),
        'per_booking', 0, 0, NULL,
        NULL, 30, true, NULL,
        4, 250, NULL,
        'company'
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
      "IsActiveV2" = excluded."IsActiveV2",
      "BookingLimit" = excluded."BookingLimit",
      "CommissionPercentage" = excluded."CommissionPercentage",
      "CommissionMinimumAmount" = excluded."CommissionMinimumAmount",
      "BookingReceiptMinimumAmount" = excluded."BookingReceiptMinimumAmount",
      "Audience" = excluded."Audience";

    UPDATE public."Plans"
    SET
      "IsActive" = false,
      "IsActiveV2" = false,
      "LastModified" = now()
    WHERE "Id" IN (
      '11111111-1111-4111-8111-111111111111'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      '33333333-3333-4333-8333-333333333333'::uuid,
      '44444444-4444-4444-8444-444444444444'::uuid,
      '55555555-5555-4555-8555-555555555555'::uuid
    );
  END IF;
END $$;

-- Dynamic pricing defaults (SummerRent / EventVenue). Requires 20260602120000_dynamic_pricing_schema.sql.
DO $$
BEGIN
  IF to_regclass('public."AppParameters"') IS NOT NULL THEN
    INSERT INTO public."AppParameters" ("Name", "ParameterType", "Value", "SiteScope", "Description")
    VALUES
      ('SEASON_FACTOR_LOW', 'number', '0.90'::jsonb, 'global', 'Low season multiplier'),
      ('SEASON_FACTOR_MID', 'number', '1.00'::jsonb, 'global', 'Mid season multiplier'),
      ('SEASON_FACTOR_HIGH', 'number', '1.20'::jsonb, 'global', 'High season multiplier'),
      (
        'SEASON_CALENDAR',
        'json',
        '[
          {"from": "05-01", "to": "08-31", "tier": "high"},
          {"from": "12-15", "to": "01-15", "tier": "high"},
          {"from": "03-01", "to": "04-30", "tier": "mid"},
          {"from": "09-01", "to": "11-30", "tier": "mid"}
        ]'::jsonb,
        'global',
        'MM-DD ranges to low|mid|high tier (Southern hemisphere summer example)'
      ),
      (
        'SPECIAL_DATES',
        'json',
        '[]'::jsonb,
        'global',
        'Array of {start, end, multiplier} holiday/special periods'
      ),
      (
        'ANTICIPATION_MIN_DAYS',
        'number',
        '30'::jsonb,
        'global',
        'Days before check-in to apply anticipation discount'
      ),
      (
        'ANTICIPATION_MULTIPLIER',
        'number',
        '0.95'::jsonb,
        'global',
        'Multiplier when anticipation threshold met'
      ),
      (
        'PRICE_ROUNDING_MODE',
        'string',
        '"tens"'::jsonb,
        'global',
        'none | tens | ending_99'
      ),
      (
        'PRICE_QUOTE_TOLERANCE',
        'number',
        '1'::jsonb,
        'global',
        'Max abs diff for client vs server total on hold'
      ),
      ('DEMAND_FACTOR_MIN', 'number', '1.00'::jsonb, 'global', 'Demand multiplier at score 0'),
      ('DEMAND_FACTOR_MAX', 'number', '1.25'::jsonb, 'global', 'Demand multiplier at score 1'),
      (
        'DEMAND_LOOKBACK_DAYS',
        'number',
        '90'::jsonb,
        'global',
        'Lookback window for demand signals (phase 2 cron)'
      ),
      (
        'DEMAND_WEIGHTS',
        'json',
        '{"bookings": 0.6, "holds": 0.3, "views": 0.1}'::jsonb,
        'global',
        'Signal weights for demand cron'
      )
    ON CONFLICT ("Name", "SiteScope") DO UPDATE SET
      "ParameterType" = excluded."ParameterType",
      "Value" = excluded."Value",
      "Description" = excluded."Description",
      "IsActive" = true,
      "IsDeleted" = false,
      "LastModified" = now();
  END IF;
END $$;

-- Local only (seed is not applied to hosted projects): print booking manage
-- tokens to postgres logs / SQL editor notices even without an Origin header.
ALTER DATABASE postgres SET app.log_booking_dev_secrets = 'true';