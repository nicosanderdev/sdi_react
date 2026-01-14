-- Make GuestId nullable in Bookings table to allow bookings without assigned guests
-- This allows creating internal bookings or placeholders without requiring a guest

-- First, drop the existing foreign key constraint
ALTER TABLE "public"."Bookings"
    DROP CONSTRAINT "FK_Bookings_Members_GuestId";

-- Make GuestId nullable
ALTER TABLE "public"."Bookings"
    ALTER COLUMN "GuestId" DROP NOT NULL;

-- Recreate the foreign key constraint allowing NULL values
ALTER TABLE "public"."Bookings"
    ADD CONSTRAINT "FK_Bookings_Members_GuestId" FOREIGN KEY ("GuestId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;