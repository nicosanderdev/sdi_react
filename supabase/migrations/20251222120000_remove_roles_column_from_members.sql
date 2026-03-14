-- Remove unused "Roles" column from Members table
-- Keep only "Role" column (text type)

-- Drop the old "Roles" column (text array) if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Members'
        AND column_name = 'Roles'
    ) THEN
        ALTER TABLE "public"."Members" DROP COLUMN "Roles";
        RAISE NOTICE 'Dropped "Roles" column from Members table';
    ELSE
        RAISE NOTICE '"Roles" column does not exist in Members table';
    END IF;
END $$;

-- Ensure "Role" column exists (should already exist from previous migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Members'
        AND column_name = 'Role'
    ) THEN
        ALTER TABLE "public"."Members" ADD COLUMN "Role" text DEFAULT 'user';
        RAISE NOTICE 'Added "Role" column to Members table';
    ELSE
        RAISE NOTICE '"Role" column already exists in Members table';
    END IF;
END $$;
