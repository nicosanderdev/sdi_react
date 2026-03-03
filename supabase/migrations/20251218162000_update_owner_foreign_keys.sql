-- Update foreign key constraints for EstateProperties.OwnerId to reference Owners table

-- Drop old foreign key constraints
ALTER TABLE "public"."EstateProperties"
DROP CONSTRAINT IF EXISTS "FK_EstateProperties_Members_OwnerId";

ALTER TABLE "public"."EstateProperties"
DROP CONSTRAINT IF EXISTS "fk_estateproperties_ownerid";

-- Add new foreign key constraint to Owners table
ALTER TABLE "public"."EstateProperties"
ADD CONSTRAINT "FK_EstateProperties_Owners_OwnerId"
FOREIGN KEY ("OwnerId") REFERENCES "public"."Owners"("Id");

-- Update index if needed (should already exist)
-- CREATE INDEX IF NOT EXISTS "IX_EstateProperties_OwnerId" ON "public"."EstateProperties" ("OwnerId");
