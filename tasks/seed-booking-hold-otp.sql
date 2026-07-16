-- ============================================================================
-- Seed a pending booking_hold for local OTP curl tests.
-- ============================================================================
-- Prerequisites:
--   - Local Supabase running with schema applied
--   - Prefer running tasks/mock-data.sql first so property
--     'cccccccc-cccc-cccc-cccc-cccccccc0001' exists
--
-- Usage (psql example):
--   psql "$DATABASE_URL" -f tasks/seed-booking-hold-otp.sql
--
-- Then call booking-send-otp with the printed hold id and phone.
-- ============================================================================

DO $$
DECLARE
  v_property_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0001';
  v_hold_id uuid := 'dddddddd-dddd-dddd-dddd-dddddddd0001';
  v_phone text := '+59899826714';
  v_check_in date := (CURRENT_DATE + 14);
  v_check_out date := (CURRENT_DATE + 17);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."EstateProperties" ep
    WHERE ep."Id" = v_property_id AND ep."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION
      'seed-booking-hold-otp: property % not found. Run tasks/mock-data.sql first.',
      v_property_id;
  END IF;

  INSERT INTO public.booking_holds (
    id,
    property_id,
    check_in,
    check_out,
    guests,
    status,
    expires_at,
    phone,
    listing_type,
    created_at,
    updated_at
  ) VALUES (
    v_hold_id,
    v_property_id,
    v_check_in,
    v_check_out,
    2,
    'pending',
    now() + interval '30 minutes',
    v_phone,
    'SummerRent',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'pending',
    expires_at = now() + interval '30 minutes',
    phone = EXCLUDED.phone,
    otp_verified_at = NULL,
    updated_at = now();

  RAISE NOTICE 'holdId=%', v_hold_id;
  RAISE NOTICE 'phone=%', v_phone;
  RAISE NOTICE 'POST /functions/v1/booking-send-otp with {"holdId":"%","phone":"%"}',
    v_hold_id, v_phone;
END $$;
