-- ============================================================================
-- Make Plans.Key non-unique so we can have one row per
-- logical plan *and* per estate PropertyType.
--
-- Previously there was a UNIQUE index "IX_Plans_Key" on ("Key"),
-- which prevented multiple rows with the same Key (0,1,2,...).
-- This migration drops that uniqueness and recreates a plain index.
-- ============================================================================

DO $$
BEGIN
    -- Drop the existing unique index on "Key" if it exists
    IF EXISTS (
        SELECT 1
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        WHERE  c.relkind = 'i'
        AND    c.relname = 'IX_Plans_Key'
        AND    n.nspname = 'public'
    ) THEN
        DROP INDEX "IX_Plans_Key";
    END IF;
END $$;

-- Recreate a non-unique index on Key to keep lookups fast
CREATE INDEX IF NOT EXISTS "IX_Plans_Key"
    ON public."Plans" ("Key");

