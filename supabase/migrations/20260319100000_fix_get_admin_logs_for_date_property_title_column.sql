-- Fix: get_admin_logs_for_date referenced EstateProperties."Title" (which may not exist).
-- Use the latest non-deleted Listing title instead: Listings."Title".

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_logs_for_date(p_date date)
RETURNS TABLE (
  event_type text,
  action text,
  at timestamptz,
  target_id uuid,
  target_display text,
  performed_by_display text,
  details jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT event_type, action, at, target_id, target_display, performed_by_display, details
  FROM (
    -- User events from MemberActionHistory
    SELECT
      'user'::text AS event_type,
      mah."ActionType"::text AS action,
      mah."PerformedAt" AS at,
      mah."MemberId" AS target_id,
      TRIM(COALESCE(t."FirstName", '') || ' ' || COALESCE(t."LastName", '')) || COALESCE(' <' || NULLIF(TRIM(t."Email"), '') || '>', '') AS target_display,
      TRIM(COALESCE(p."FirstName", '') || ' ' || COALESCE(p."LastName", '')) || COALESCE(' <' || NULLIF(TRIM(p."Email"), '') || '>', '') AS performed_by_display,
      mah."ActionDetails" AS details
    FROM "MemberActionHistory" mah
    JOIN "Members" t ON t."Id" = mah."MemberId" AND t."IsDeleted" = false
    JOIN "Members" p ON p."Id" = mah."PerformedBy" AND p."IsDeleted" = false
    WHERE mah."IsDeleted" = false
      AND mah."PerformedAt" >= p_date::timestamptz
      AND mah."PerformedAt" < (p_date + interval '1 day')::timestamptz

    UNION ALL

    -- Property events from PropertyModerationActions
    SELECT
      'property'::text AS event_type,
      pma."ActionType"::text AS action,
      pma."PerformedAt" AS at,
      pma."PropertyId" AS target_id,
      COALESCE(ll."Title", '') AS target_display,
      TRIM(COALESCE(m."FirstName", '') || ' ' || COALESCE(m."LastName", '')) || COALESCE(' <' || NULLIF(TRIM(m."Email"), '') || '>', '') AS performed_by_display,
      jsonb_build_object('reason', pma."Reason") AS details
    FROM "PropertyModerationActions" pma
    JOIN "EstateProperties" ep
      ON ep."Id" = pma."PropertyId"
      AND ep."IsDeleted" = false
    -- Latest non-deleted listing title for this estate property
    LEFT JOIN LATERAL (
      SELECT l."Title"
      FROM "Listings" l
      WHERE l."EstatePropertyId" = pma."PropertyId"
        AND l."IsDeleted" = false
      ORDER BY l."Created" DESC
      LIMIT 1
    ) ll ON true
    LEFT JOIN "Members" m
      ON m."UserId" = pma."PerformedBy"
      AND m."IsDeleted" = false
    WHERE pma."IsDeleted" = false
      AND pma."PerformedAt" >= p_date::timestamptz
      AND pma."PerformedAt" < (p_date + interval '1 day')::timestamptz

    UNION ALL

    -- Booking created on p_date
    SELECT
      'booking'::text AS event_type,
      'created'::text AS action,
      b."Created" AS at,
      b."Id" AS target_id,
      'Booking ' || b."Id"::text AS target_display,
      COALESCE(b."CreatedBy", '') AS performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") AS details
    FROM "Bookings" b
    WHERE b."IsDeleted" = false
      AND b."Created" >= p_date::timestamptz
      AND b."Created" < (p_date + interval '1 day')::timestamptz

    UNION ALL

    -- Booking updated on p_date (exclude same timestamp as Created to avoid duplicate row for create-only)
    SELECT
      'booking'::text AS event_type,
      'updated'::text AS action,
      b."LastModified" AS at,
      b."Id" AS target_id,
      'Booking ' || b."Id"::text AS target_display,
      COALESCE(b."LastModifiedBy", '') AS performed_by_display,
      jsonb_build_object('estatePropertyId', b."EstatePropertyId", 'checkIn', b."CheckInDate", 'checkOut', b."CheckOutDate") AS details
    FROM "Bookings" b
    WHERE b."IsDeleted" = false
      AND b."LastModified" >= p_date::timestamptz
      AND b."LastModified" < (p_date + interval '1 day')::timestamptz
      AND b."LastModified" <> b."Created"
  ) AS logs
  ORDER BY at DESC;
$$;

COMMIT;

