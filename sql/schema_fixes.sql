-- Database Schema Fixes for Supabase
-- Execute these statements in your Supabase SQL Editor

-- IMPORTANT: Drop RLS policies that depend on columns being altered before changing column types
-- Drop policies that reference UserId columns
DROP POLICY IF EXISTS "Users can view their own member record" ON "Members";
DROP POLICY IF EXISTS "Users can update their own member record" ON "Members";

-- Add foreign key constraints for proper relationships
-- (Only add if they don't already exist)

-- Add foreign key from UserCompanies.MemberId to Members.Id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_usercompanies_memberid'
    ) THEN
        ALTER TABLE "UserCompanies"
        ADD CONSTRAINT fk_usercompanies_memberid
        FOREIGN KEY ("MemberId") REFERENCES "Members"("Id");
    END IF;
END $$;

-- Add foreign key from UserCompanies.CompanyId to Companies.Id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_usercompanies_companyid'
    ) THEN
        ALTER TABLE "UserCompanies"
        ADD CONSTRAINT fk_usercompanies_companyid
        FOREIGN KEY ("CompanyId") REFERENCES "Companies"("Id");
    END IF;
END $$;

-- Add foreign key from EstateProperties.OwnerId to Companies.Id (if OwnerId references Companies)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_estateproperties_ownerid'
    ) THEN
        ALTER TABLE "EstateProperties"
        ADD CONSTRAINT fk_estateproperties_ownerid
        FOREIGN KEY ("OwnerId") REFERENCES "Companies"("Id");
    END IF;
END $$;

-- Fix data type issues - ensure UserId fields are UUID where they should be
-- (This may need adjustment based on your actual table structure)

-- Ensure Members.UserId is UUID
ALTER TABLE "Members"
ALTER COLUMN "UserId" TYPE UUID USING "UserId"::UUID;

-- Ensure UserCompanies.MemberId and CompanyId are UUID
ALTER TABLE "UserCompanies"
ALTER COLUMN "MemberId" TYPE UUID USING "MemberId"::UUID,
ALTER COLUMN "CompanyId" TYPE UUID USING "CompanyId"::UUID;

-- Ensure Companies.Id is UUID
ALTER TABLE "Companies"
ALTER COLUMN "Id" TYPE UUID USING "Id"::UUID;

-- Recreate the RLS policies after column type changes
CREATE POLICY "Users can view their own member record" ON "Members"
FOR SELECT USING (auth.uid() = "UserId");

CREATE POLICY "Users can update their own member record" ON "Members"
FOR UPDATE USING (auth.uid() = "UserId");
