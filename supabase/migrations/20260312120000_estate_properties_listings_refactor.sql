-- ============================================================================
-- EstateProperties & Listings refactor
-- - Add PropertyType, LocationCategory, ViewType to EstateProperties
-- - Create per-purpose extension tables
-- - Create Listings table to replace EstatePropertyValues
-- - Migrate data from EstatePropertyValues into Listings
-- ============================================================================

-- 1) ENUM TYPES ----------------------------------------------------------------

DO $$
BEGIN
    -- PropertyType: end-purpose of the property
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PropertyType') THEN
        CREATE TYPE "PropertyType" AS ENUM ('SummerRent', 'EventVenue', 'AnnualRent', 'RealEstate');
    END IF;

    -- ListingType: purpose of a specific listing
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ListingType') THEN
        CREATE TYPE "ListingType" AS ENUM ('SummerRent', 'EventVenue', 'AnnualRent', 'RealEstate');
    END IF;

    -- LocationCategory: high-level location classification
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LocationCategory') THEN
        CREATE TYPE "LocationCategory" AS ENUM ('rural', 'city', 'near_shore');
    END IF;

    -- ViewType: view classification
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ViewType') THEN
        CREATE TYPE "ViewType" AS ENUM ('city', 'mountain', 'rural', 'sea');
    END IF;
END $$;


-- 2) ESTATEPROPERTIES COLUMNS --------------------------------------------------

DO $$
BEGIN
    -- Add PropertyType (end-purpose) to EstateProperties
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'PropertyType'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "PropertyType" "PropertyType";
    END IF;

    -- Add infrastructure booleans where they make sense globally
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'HasLaundryRoom'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "HasLaundryRoom" boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'HasPool'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "HasPool" boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'HasBalcony'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "HasBalcony" boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'IsFurnished'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "IsFurnished" boolean NOT NULL DEFAULT false;
    END IF;

    -- Add capacity at property level if not present (structural)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'Capacity'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "Capacity" integer;
    END IF;

    -- Add LocationCategory and ViewType enums
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'LocationCategory'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "LocationCategory" "LocationCategory";
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'EstateProperties'
          AND column_name = 'ViewType'
    ) THEN
        ALTER TABLE public."EstateProperties"
        ADD COLUMN "ViewType" "ViewType";
    END IF;
END $$;


-- 3) EXTENSION TABLES ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public."SummerRentExtension" (
    "EstatePropertyId" uuid PRIMARY KEY REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE,
    "MinStayDays" integer,
    "MaxStayDays" integer,
    "LeadTimeDays" integer,
    "BufferDays" integer,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamptz NOT NULL DEFAULT now(),
    "CreatedBy" text,
    "LastModified" timestamptz NOT NULL DEFAULT now(),
    "LastModifiedBy" text
);

CREATE TABLE IF NOT EXISTS public."EventVenueExtension" (
    "EstatePropertyId" uuid PRIMARY KEY REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE,
    "MaxGuests" integer,
    "HasCatering" boolean,
    "HasSoundSystem" boolean,
    "ClosingHour" time,
    "AllowedEventsDescription" text,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamptz NOT NULL DEFAULT now(),
    "CreatedBy" text,
    "LastModified" timestamptz NOT NULL DEFAULT now(),
    "LastModifiedBy" text
);

CREATE TABLE IF NOT EXISTS public."AnnualRentExtension" (
    "EstatePropertyId" uuid PRIMARY KEY REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE,
    "MinContractMonths" integer,
    "RequiresGuarantee" boolean,
    "GuaranteeType" text,
    "AllowsPets" boolean,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamptz NOT NULL DEFAULT now(),
    "CreatedBy" text,
    "LastModified" timestamptz NOT NULL DEFAULT now(),
    "LastModifiedBy" text
);

CREATE TABLE IF NOT EXISTS public."RealEstateExtension" (
    "EstatePropertyId" uuid PRIMARY KEY REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE,
    "AllowsFinancing" boolean,
    "IsNewConstruction" boolean,
    "HasMortgage" boolean,
    "HOAFees" numeric,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamptz NOT NULL DEFAULT now(),
    "CreatedBy" text,
    "LastModified" timestamptz NOT NULL DEFAULT now(),
    "LastModifiedBy" text
);


-- 4) LISTINGS TABLE -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public."Listings" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "EstatePropertyId" uuid NOT NULL REFERENCES public."EstateProperties"("Id") ON DELETE CASCADE,
    "ListingType" "ListingType" NOT NULL,
    "Description" varchar(1000),
    "AvailableFrom" timestamptz NOT NULL,
    "Capacity" integer,
    "Currency" integer NOT NULL,
    "SalePrice" numeric,
    "RentPrice" numeric,
    "HasCommonExpenses" boolean NOT NULL,
    "CommonExpensesValue" numeric,
    "IsElectricityIncluded" boolean,
    "IsWaterIncluded" boolean,
    "IsPriceVisible" boolean NOT NULL,
    "Status" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "IsPropertyVisible" boolean NOT NULL,
    "IsFeatured" boolean NOT NULL DEFAULT false,
    "BlockedForBooking" boolean NOT NULL DEFAULT false,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamptz NOT NULL DEFAULT now(),
    "CreatedBy" text,
    "LastModified" timestamptz NOT NULL DEFAULT now(),
    "LastModifiedBy" text
);

-- Unique active listing per property per type
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Listings_EstatePropertyId_ListingType_Active"
ON public."Listings" ("EstatePropertyId", "ListingType")
WHERE "IsActive" = true AND "IsDeleted" = false;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "IX_Listings_EstatePropertyId"
    ON public."Listings" ("EstatePropertyId");

CREATE INDEX IF NOT EXISTS "IX_Listings_VisibleActive"
    ON public."Listings" ("EstatePropertyId", "ListingType")
    WHERE "IsActive" = true AND "IsDeleted" = false AND "IsPropertyVisible" = true;


-- 5) DATA MIGRATION FROM ESTATEPROPERTYVALUES ---------------------------------

DO $$
DECLARE
    v_default_listing_type "ListingType" := 'RealEstate';
BEGIN
    /*
      Copy existing EstatePropertyValues rows into Listings.
      We map 1:1 and infer ListingType using a simple rule:
      - If Status = 0 (sale) -> RealEstate
      - If Status = 1 (rent) -> AnnualRent
      - Otherwise fallback to RealEstate
      You can refine this later if you introduce dedicated flags.
    */
    INSERT INTO public."Listings" (
        "Id",
        "EstatePropertyId",
        "ListingType",
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
        "BlockedForBooking",
        "IsDeleted",
        "Created",
        "CreatedBy",
        "LastModified",
        "LastModifiedBy"
    )
    SELECT
        epv."Id",
        epv."EstatePropertyId",
        CASE
            WHEN epv."Status" = 0 THEN 'RealEstate'::"ListingType"
            WHEN epv."Status" = 1 THEN 'AnnualRent'::"ListingType"
            ELSE v_default_listing_type
        END,
        epv."Description",
        epv."AvailableFrom",
        epv."Capacity",
        epv."Currency",
        epv."SalePrice",
        epv."RentPrice",
        epv."HasCommonExpenses",
        epv."CommonExpensesValue",
        epv."IsElectricityIncluded",
        epv."IsWaterIncluded",
        epv."IsPriceVisible",
        epv."Status",
        epv."IsActive",
        epv."IsPropertyVisible",
        epv."IsFeatured",
        COALESCE(epv."BlockedForBooking", false),
        epv."IsDeleted",
        epv."Created",
        epv."CreatedBy",
        epv."LastModified",
        epv."LastModifiedBy"
    FROM public."EstatePropertyValues" epv
    ON CONFLICT ("Id") DO NOTHING;
END $$;

