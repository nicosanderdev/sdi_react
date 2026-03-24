-- Fix get_property_availability to match latest table schema.
-- SummerRentExtension no longer has IsDeleted.

CREATE OR REPLACE FUNCTION public.get_property_availability(
  property_id uuid,
  start_date date,
  end_date date
)
RETURNS TABLE(date date, is_available boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  property_record RECORD;
  booking_record RECORD;
  block_record RECORD;
  current_check_date DATE;
  is_blocked BOOLEAN;
BEGIN
  -- Validate input dates
  IF start_date IS NULL OR end_date IS NULL OR start_date >= end_date THEN
    RAISE EXCEPTION 'Invalid date range provided';
  END IF;

  -- Check if property exists and is not deleted, and load booking rules.
  -- Booking rules currently come from SummerRentExtension.
  SELECT
    sx."MinStayDays" AS "MinStayDays",
    sx."MaxStayDays" AS "MaxStayDays",
    sx."LeadTimeDays" AS "LeadTimeDays",
    sx."BufferDays" AS "BufferDays"
  INTO property_record
  FROM public."EstateProperties" ep
  LEFT JOIN public."SummerRentExtension" sx
    ON sx."EstatePropertyId" = ep."Id"
  WHERE ep."Id" = property_id
    AND ep."IsDeleted" = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  -- Generate date series and check availability for each date
  current_check_date := start_date;

  WHILE current_check_date < end_date LOOP
    is_blocked := false;

    -- Check against bookings (pending, confirmed, cancelled)
    FOR booking_record IN
      SELECT "CheckInDate", "CheckOutDate"
      FROM public."Bookings"
      WHERE "EstatePropertyId" = property_id
        AND "IsDeleted" = false
        AND "Status" IN (0, 1, 2)
        AND current_check_date >= "CheckInDate"
        AND current_check_date < "CheckOutDate"
    LOOP
      is_blocked := true;
      EXIT;
    END LOOP;

    -- If not blocked by booking, check availability blocks
    IF NOT is_blocked THEN
      FOR block_record IN
        SELECT "StartDate", "EndDate", "IsAvailable"
        FROM public."AvailabilityBlocks"
        WHERE "EstatePropertyId" = property_id
          AND "IsDeleted" = false
          AND "IsAvailable" = false
          AND current_check_date >= "StartDate"::date
          AND current_check_date < "EndDate"::date
      LOOP
        is_blocked := true;
        EXIT;
      END LOOP;
    END IF;

    -- Apply lead time rule (earliest bookable date)
    IF property_record."LeadTimeDays" IS NOT NULL
       AND current_check_date < (CURRENT_DATE + INTERVAL '1 day' * property_record."LeadTimeDays") THEN
      is_blocked := true;
    END IF;

    -- BufferDays handling can be expanded here if needed; for now we keep
    -- the same simplified logic as the previous implementation.
    RETURN QUERY SELECT current_check_date, NOT is_blocked;

    -- Move to next date
    current_check_date := current_check_date + INTERVAL '1 day';
  END LOOP;

  RETURN;
END;
$$;
