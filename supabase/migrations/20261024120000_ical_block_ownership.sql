-- Tie imported iCal blocks to the feed that created them, stop a block from
-- conflicting with itself on re-import, and validate the public export token
-- without minting one.

ALTER TABLE public."AvailabilityBlocks"
  ADD COLUMN IF NOT EXISTS "CalendarIntegrationId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FK_AvailabilityBlocks_CalendarIntegration'
      AND conrelid = 'public."AvailabilityBlocks"'::regclass
  ) THEN
    ALTER TABLE public."AvailabilityBlocks"
      ADD CONSTRAINT "FK_AvailabilityBlocks_CalendarIntegration"
      FOREIGN KEY ("CalendarIntegrationId")
      REFERENCES public."CalendarIntegrations"("Id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IX_AvailabilityBlocks_CalendarIntegrationId"
  ON public."AvailabilityBlocks" ("CalendarIntegrationId")
  WHERE "CalendarIntegrationId" IS NOT NULL;

-- One iCal feed on the property: those blocks belong to it.
-- Several feeds: leave null; the next import of each feed claims its own UIDs.
UPDATE public."AvailabilityBlocks" ab
SET "CalendarIntegrationId" = sole."Id"
FROM (
  SELECT "EstatePropertyId", (array_agg("Id"))[1] AS "Id"
  FROM public."CalendarIntegrations"
  WHERE "IsDeleted" = false
    AND "PlatformType" IN (2, 3, 4)
  GROUP BY "EstatePropertyId"
  HAVING count(*) = 1
) sole
WHERE ab."EstatePropertyId" = sole."EstatePropertyId"
  AND ab."Source" = 'ical'
  AND ab."CalendarIntegrationId" IS NULL;

DROP FUNCTION IF EXISTS public.detect_availability_conflicts(uuid, timestamp with time zone, timestamp with time zone);

CREATE FUNCTION public.detect_availability_conflicts(
  property_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  exclude_external_event_id text DEFAULT NULL
) RETURNS TABLE("Id" uuid, "Title" text, "BlockType" integer, "Source" text, "IsReadOnly" boolean, "ConflictFlagged" boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ab."Id",
    ab."Title",
    ab."BlockType",
    ab."Source"::text,
    ab."IsReadOnly",
    ab."ConflictFlagged"
  FROM public."AvailabilityBlocks" ab
  WHERE ab."EstatePropertyId" = property_id
    AND ab."IsDeleted" = false
    AND ab."IsAvailable" = false
    AND (
      (ab."StartDate" <= start_date AND ab."EndDate" > start_date) OR
      (ab."StartDate" < end_date AND ab."EndDate" >= end_date) OR
      (ab."StartDate" >= start_date AND ab."EndDate" <= end_date)
    )
    AND NOT (
      exclude_external_event_id IS NOT NULL
      AND ab."Source" = 'ical'
      AND ab."ExternalEventId" = exclude_external_event_id
    );
END;
$$;

COMMENT ON FUNCTION public.detect_availability_conflicts(uuid, timestamp with time zone, timestamp with time zone, text) IS
  'Overlapping unavailable blocks. exclude_external_event_id skips the iCal block for that UID so a re-import does not conflict with itself.';

REVOKE ALL ON FUNCTION public.detect_availability_conflicts(uuid, timestamp with time zone, timestamp with time zone, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_availability_conflicts(uuid, timestamp with time zone, timestamp with time zone, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.detect_availability_conflicts(uuid, timestamp with time zone, timestamp with time zone, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_property_ical_export_token(property_id uuid, token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."SummerRentExtension" s
    WHERE s."EstatePropertyId" = property_id
      AND s."ICalExportToken" IS NOT NULL
      AND s."ICalExportToken"::text = token
  );
$$;

COMMENT ON FUNCTION public.validate_property_ical_export_token(uuid, text) IS
  'True when token matches the property export token. Does not create a token.';

REVOKE ALL ON FUNCTION public.validate_property_ical_export_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_property_ical_export_token(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_property_ical_export_token(uuid, text) TO service_role;
