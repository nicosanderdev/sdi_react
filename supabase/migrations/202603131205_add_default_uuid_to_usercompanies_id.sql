-- ============================================================================
-- Add DEFAULT UUID generator to UserCompanies.Id
-- - Ensures inserts without explicit Id value do not violate NOT NULL
-- - Uses pgcrypto's gen_random_uuid() for UUID generation
-- ============================================================================

-- UP: ensure pgcrypto extension exists and set default on Id
DO $$
BEGIN
    -- Create pgcrypto extension if it does not exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pgcrypto'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    END IF;

    -- Set DEFAULT for UserCompanies.Id if not already set
    PERFORM 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'UserCompanies'
      AND column_name = 'Id'
      AND column_default IS NOT NULL;

    IF NOT FOUND THEN
        ALTER TABLE public."UserCompanies"
        ALTER COLUMN "Id" SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- DOWN: remove DEFAULT from UserCompanies.Id (no-op if already removed)
DO $$
BEGIN
    ALTER TABLE public."UserCompanies"
    ALTER COLUMN "Id" DROP DEFAULT;

    ALTER TABLE public."UserCompanies"
    ALTER COLUMN "Id" SET DEFAULT gen_random_uuid();
END $$;
