-- Add default value for IsDeleted column in Members table
ALTER TABLE "public"."Members" ALTER COLUMN "IsDeleted" SET DEFAULT false;

-- Update the handle_new_user trigger to explicitly set IsDeleted to false and populate Email
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$BEGIN
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
END;$$;
