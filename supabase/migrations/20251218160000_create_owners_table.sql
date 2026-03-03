-- Create Owners table to unify property ownership (member or company)
-- This replaces the direct OwnerId foreign key in EstateProperties

-- Create enum type for owner types
CREATE TYPE "OwnerType" AS ENUM ('member', 'company');

-- Create Owners table
CREATE TABLE IF NOT EXISTS "public"."Owners" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "OwnerType" "OwnerType" NOT NULL,
    "MemberId" "uuid",
    "CompanyId" "uuid",
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" "text",
    CONSTRAINT "PK_Owners" PRIMARY KEY ("Id"),
    CONSTRAINT "CHK_Owners_ExclusiveOwnership" CHECK (
        ("OwnerType" = 'member' AND "MemberId" IS NOT NULL AND "CompanyId" IS NULL) OR
        ("OwnerType" = 'company' AND "CompanyId" IS NOT NULL AND "MemberId" IS NULL)
    ),
    CONSTRAINT "FK_Owners_Members_MemberId" FOREIGN KEY ("MemberId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Owners_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "public"."Companies"("Id") ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "IX_Owners_OwnerType" ON "public"."Owners" ("OwnerType");
CREATE INDEX IF NOT EXISTS "IX_Owners_MemberId" ON "public"."Owners" ("MemberId");
CREATE INDEX IF NOT EXISTS "IX_Owners_CompanyId" ON "public"."Owners" ("CompanyId");

-- Enable RLS on Owners table
ALTER TABLE "public"."Owners" ENABLE ROW LEVEL SECURITY;

-- RLS policies for Owners table
-- Users can view owners they are associated with (their own member/company owners)
CREATE POLICY "Users can view their own owners" ON "public"."Owners"
FOR SELECT USING (
    ("OwnerType" = 'member' AND "MemberId" IN (
        SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
    )) OR
    ("OwnerType" = 'company' AND "CompanyId" IN (
        SELECT "CompanyId" FROM "UserCompanies"
        WHERE "MemberId" IN (
            SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
        ) AND "IsDeleted" = false
    ))
);

-- Users can insert owners for themselves or their companies
CREATE POLICY "Users can create their own owners" ON "public"."Owners"
FOR INSERT WITH CHECK (
    ("OwnerType" = 'member' AND "MemberId" IN (
        SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
    )) OR
    ("OwnerType" = 'company' AND "CompanyId" IN (
        SELECT "CompanyId" FROM "UserCompanies"
        WHERE "MemberId" IN (
            SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
        ) AND "IsDeleted" = false
    ))
);

-- Users can update their own owners
CREATE POLICY "Users can update their own owners" ON "public"."Owners"
FOR UPDATE USING (
    ("OwnerType" = 'member' AND "MemberId" IN (
        SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
    )) OR
    ("OwnerType" = 'company' AND "CompanyId" IN (
        SELECT "CompanyId" FROM "UserCompanies"
        WHERE "MemberId" IN (
            SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
        ) AND "IsDeleted" = false
    ))
);

-- Users can delete their own owners (soft delete by setting IsDeleted)
CREATE POLICY "Users can delete their own owners" ON "public"."Owners"
FOR UPDATE USING (
    ("OwnerType" = 'member' AND "MemberId" IN (
        SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
    )) OR
    ("OwnerType" = 'company' AND "CompanyId" IN (
        SELECT "CompanyId" FROM "UserCompanies"
        WHERE "MemberId" IN (
            SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false
        ) AND "IsDeleted" = false
    ))
);

-- Admins can manage all owners
CREATE POLICY "Admins can manage all owners" ON "public"."Owners"
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM "Members"
        WHERE "UserId" = auth.uid()
        AND "IsDeleted" = false
        AND "Role" = 'admin'
    )
);
