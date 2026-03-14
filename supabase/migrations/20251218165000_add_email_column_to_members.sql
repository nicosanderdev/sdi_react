-- Add Email column to Members table
-- This migration adds the Email column and backfills existing records from auth.users

-- Step 1: Add Email column to Members table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'Members'
        AND column_name = 'Email'
    ) THEN
        ALTER TABLE public."Members" ADD COLUMN "Email" character varying(255) NULL;
        RAISE NOTICE 'Added Email column to Members table';
    ELSE
        RAISE NOTICE 'Email column already exists in Members table';
    END IF;
END $$;

-- Step 2: Backfill Email column with data from auth.users for existing Members
UPDATE public."Members"
SET "Email" = au.email,
    "LastModified" = NOW(),
    "LastModifiedBy" = 'system'
FROM auth.users au
WHERE "Members"."UserId" = au.id
  AND "Members"."IsDeleted" = false
  AND ("Members"."Email" IS NULL OR "Members"."Email" = '');

-- Step 3: Update the trigger function to populate Email for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public."Members" ("Id", "UserId", "FirstName", "LastName", "Email", "AvatarUrl", "IsDeleted", "Created", "LastModified")
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    NEW.email,
    'https://placehold.co/150x150',
    false,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Drop and recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Add a comment to document the Email column
COMMENT ON COLUMN public."Members"."Email" IS 'User email address, synced from auth.users during signup and backfilled for existing records';
