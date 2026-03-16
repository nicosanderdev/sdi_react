## PropertyType / Extensions Rollout Notes

This document describes how to safely roll out the changes introduced in:

- `20260316100000_update_property_types_and_extensions.sql`

The goal is to:

- Remove `AnnualRent` from `PropertyType` (keeping it in `ListingType`).
- Unify `AnnualRentExtension` columns into `RealEstateExtension`.
- Drop the `AnnualRentExtension` table and its constraints.

### 1. Pre-migration checks and data cleanup

Run this query to check if there are still properties with `PropertyType = 'AnnualRent'`:

```sql
SELECT *
FROM public."EstateProperties"
WHERE "PropertyType" = 'AnnualRent'::public."PropertyType";
```

- If any rows are returned, decide how you want to handle them. A common approach is:
  - Change their `PropertyType` to `'RealEstate'`.
  - Keep (or create) an `AnnualRent` listing in `public."Listings"` for those properties.

Example update (adjust to your needs, and run only after you are sure about the mapping):

```sql
UPDATE public."EstateProperties"
SET "PropertyType" = 'RealEstate'::public."PropertyType"
WHERE "PropertyType" = 'AnnualRent'::public."PropertyType";
```

Only after there are **no** `AnnualRent` `PropertyType` rows left should you run the SQL migration file.

### 2. Running the migration

Apply `20260316100000_update_property_types_and_extensions.sql` to your Supabase database using your usual migration workflow.

The migration will:

- Assert (via a DO block) that there are no remaining `EstateProperties` with `PropertyType = 'AnnualRent'`.
- Drop `AnnualRent` from the `public."PropertyType"` enum.
- Add the following columns to `public."RealEstateExtension"` (if they do not exist):
  - `"MinContractMonths" integer`
  - `"RequiresGuarantee" boolean`
  - `"GuaranteeType" text`
  - `"AllowsPets" boolean`
- Optionally copy data from `public."AnnualRentExtension"` into `public."RealEstateExtension"` when both rows exist for the same `EstatePropertyId`.
- Drop `public."AnnualRentExtension"` and its PK/FK constraints.

### 3. Post-migration verification

After applying the migration, run these checks:

1. Confirm that `PropertyType` no longer contains `AnnualRent`:

```sql
SELECT unnest(enum_range(NULL::public."PropertyType")) AS value;
```

You should see only:

- `SummerRent`
- `EventVenue`
- `RealEstate`

2. Confirm that `RealEstateExtension` has the new columns:

```sql
SELECT
  column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'RealEstateExtension'
  AND column_name IN ('MinContractMonths', 'RequiresGuarantee', 'GuaranteeType', 'AllowsPets');
```

3. Confirm that `AnnualRentExtension` is gone:

```sql
SELECT *
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'AnnualRentExtension';
```

It should return **no rows**.

### 4. Frontend and API alignment

Once the migration is applied:

- The frontend `PropertyType` enum (and related Zod schemas) must no longer include `AnnualRent`.
- `ListingType` continues to support `AnnualRent`, so annual rent remains a listing-level concept for properties that are now typed as `RealEstate`.
- Any API or edge functions that previously referenced `AnnualRentExtension` should now treat the unified columns as part of `RealEstateExtension`.

