-- Fix UserCompanies Role column type to match application enum usage
ALTER TABLE "public"."UserCompanies" ALTER COLUMN "Role" TYPE text;

-- Update RLS policies to use string comparisons instead of enum casting
DROP POLICY IF EXISTS "Admins and managers can update company properties" ON "public"."EstateProperties";
DROP POLICY IF EXISTS "Admins can delete company properties" ON "public"."EstateProperties";

-- Policy 5: Admin/Manager users can update company properties
CREATE POLICY "Admins and managers can update company properties" ON "public"."EstateProperties"
  FOR UPDATE USING (
    "OwnerId" IN (
      SELECT "CompanyId" FROM "public"."UserCompanies"
      WHERE "MemberId" IN (
        SELECT "Id" FROM "public"."Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false
      )
      AND "Role" IN ('Admin', 'Manager')
      AND "IsDeleted" = false
    )
  );

-- Policy 7: Admin users can delete company properties
CREATE POLICY "Admins can delete company properties" ON "public"."EstateProperties"
  FOR DELETE USING (
    "OwnerId" IN (
      SELECT "CompanyId" FROM "public"."UserCompanies"
      WHERE "MemberId" IN (
        SELECT "Id" FROM "public"."Members"
        WHERE "UserId" = auth.uid() AND "IsDeleted" = false
      )
      AND "Role" = 'Admin'
      AND "IsDeleted" = false
    )
  );
