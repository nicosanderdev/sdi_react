-- iCal Calendar Synchronization Schema Extension
-- Extends existing calendar integration schema to support iCal URL-based synchronization

-- Add iCal support columns to CalendarIntegrations table
ALTER TABLE "public"."CalendarIntegrations"
ADD COLUMN IF NOT EXISTS "ICalUrl" TEXT,
ADD COLUMN IF NOT EXISTS "ICalSyncToken" TEXT;

-- Make OAuth-specific columns nullable for iCal integrations
ALTER TABLE "public"."CalendarIntegrations"
ALTER COLUMN "AccessToken" DROP NOT NULL,
ALTER COLUMN "RefreshToken" DROP NOT NULL;

-- Update PlatformType constraint to include iCal platforms
-- 0: Google Calendar, 1: Apple Calendar, 2: Airbnb iCal, 3: Booking.com iCal, 4: Other iCal
ALTER TABLE "public"."CalendarIntegrations"
DROP CONSTRAINT IF EXISTS "CHK_CalendarIntegrations_PlatformType";

ALTER TABLE "public"."CalendarIntegrations"
ADD CONSTRAINT "CHK_CalendarIntegrations_PlatformType"
CHECK ("PlatformType" IN (0, 1, 2, 3, 4));

-- Add ICalExportToken to EstateProperties for public export URLs
ALTER TABLE "public"."EstateProperties"
ADD COLUMN IF NOT EXISTS "ICalExportToken" UUID DEFAULT gen_random_uuid();

-- Performance indexes
CREATE INDEX IF NOT EXISTS "IX_CalendarIntegrations_ICalUrl" ON "public"."CalendarIntegrations" ("ICalUrl")
WHERE "ICalUrl" IS NOT NULL;

-- Helper function to get property iCal export URL
CREATE OR REPLACE FUNCTION "public"."get_property_ical_export_url"(property_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    export_token uuid;
    export_url text;
BEGIN
    -- Get the export token for this property
    SELECT "ICalExportToken" INTO export_token
    FROM "EstateProperties"
    WHERE "Id" = property_id
        AND "IsDeleted" = false;

    -- Return null if property doesn't exist or no token
    IF export_token IS NULL THEN
        RETURN NULL;
    END IF;

    -- Construct the public export URL
    -- Note: Replace 'your-domain.com' with actual domain in production
    export_url := 'https://your-domain.com/functions/v1/ical-export/' || property_id || '?token=' || export_token;

    RETURN export_url;
END;
$$;

-- Add comment to document the new constraint
COMMENT ON CONSTRAINT "CHK_CalendarIntegrations_PlatformType" ON "public"."CalendarIntegrations"
IS 'Platform types: 0=Google Calendar, 1=Apple Calendar, 2=Airbnb iCal, 3=Booking.com iCal, 4=Other iCal';

COMMENT ON COLUMN "public"."CalendarIntegrations"."ICalUrl" IS 'iCal feed URL for external calendar import (HTTPS only)';
COMMENT ON COLUMN "public"."CalendarIntegrations"."ICalSyncToken" IS 'ETag or sync token for iCal optimization';

COMMENT ON COLUMN "public"."EstateProperties"."ICalExportToken" IS 'UUID token for public iCal export URLs (regenerates on request)';

COMMENT ON FUNCTION "public"."get_property_ical_export_url"(uuid) IS 'Returns the public iCal export URL for a property. Returns NULL if property not found or no export token.';