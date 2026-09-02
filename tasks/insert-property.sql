-- ============================================================================
-- Seed a published SummerRent property for Bruno Silva, plus a sample booking.
-- ============================================================================
-- Prerequisites:
--   - Member already exists (user2@email.com / 67aae576-4d2b-4fa2-8725-4f949ad1b8aa)
--   - Owner already exists (bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002)
--   - Plans seeded (uses "Plan BASE-Inicial" if the member has no active assignment)
--   - Amenities seeded (SummerRent rows are linked by name; skipped if missing)
--
-- Does not insert Members, Users, Owners, images, documents, or videos.
--
-- Usage:
--   psql "$DATABASE_URL" -f tasks/insert-property.sql
--
-- Fixed ids (re-runnable):
--   owner     bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002
--   property  cccccccc-cccc-cccc-cccc-cccccccc0001
--   listing   cccccccc-cccc-cccc-cccc-cccccccc0002
--   booking   eeeeeeee-eeee-eeee-eeee-eeeeeeee0001
--
-- After this script, tasks/seed-booking-hold-otp.sql can create a hold on
-- the same property (dates +14..+17; this booking uses +45..+48).
-- ============================================================================

DO $$
DECLARE
  v_member_id uuid := '67aae576-4d2b-4fa2-8725-4f949ad1b8aa';
  v_owner_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002';
  v_property_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0001';
  v_listing_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0002';
  v_policy_checkin_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0003';
  v_policy_house_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0004';
  v_guest_id uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0000';
  v_booking_id uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001';
  v_plan_id uuid;
  v_check_in date := (CURRENT_DATE + 45);
  v_check_out date := (CURRENT_DATE + 48);
  v_nights integer;
  v_nightly numeric := 180;
  v_total numeric;
BEGIN
  -- --------------------------------------------------------------------------
  -- Existing member + owner (do not insert Members / Owners)
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public."Members" m
    WHERE m."Id" = v_member_id
      AND m."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION
      'insert-property: member % not found. Member/user must already exist.',
      v_member_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."Owners" o
    WHERE o."Id" = v_owner_id
      AND o."MemberId" = v_member_id
      AND o."OwnerType" = 'member'
      AND o."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION
      'insert-property: owner % not found for member %.',
      v_owner_id, v_member_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Plan assignment (skip if the member already has an active plan)
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1
    FROM public."BillingPlanAssignments" bpa
    WHERE bpa."SubjectType" = 'member'
      AND bpa."MemberOrCompanyId" = v_member_id
      AND bpa."IsActive" = true
      AND bpa."StartDate" <= now()
      AND (bpa."EndDate" IS NULL OR bpa."EndDate" >= now())
  ) THEN
    SELECT p."Id"
    INTO v_plan_id
    FROM public."Plans" p
    WHERE p."Name" = 'Plan BASE-Inicial'
      AND p."IsDeleted" = false
      AND coalesce(p."IsActiveV2", p."IsActive", true) = true
    ORDER BY p."Key"
    LIMIT 1;

    IF v_plan_id IS NULL THEN
      RAISE EXCEPTION 'insert-property: plan "Plan BASE-Inicial" not found or inactive.';
    END IF;

    INSERT INTO public."BillingPlanAssignments" (
      "SubjectType",
      "MemberOrCompanyId",
      "PlanId",
      "StartDate",
      "IsActive",
      "Created",
      "LastModified"
    ) VALUES (
      'member',
      v_member_id,
      v_plan_id,
      now(),
      true,
      now(),
      now()
    );
  ELSE
    SELECT bpa."PlanId"
    INTO v_plan_id
    FROM public."BillingPlanAssignments" bpa
    WHERE bpa."SubjectType" = 'member'
      AND bpa."MemberOrCompanyId" = v_member_id
      AND bpa."IsActive" = true
    ORDER BY bpa."StartDate" DESC
    LIMIT 1;
  END IF;

  -- --------------------------------------------------------------------------
  -- EstateProperties
  -- Punta del Este (not the wizard default Montevideo pin).
  -- AreaUnit 0 = m²; LocationCategory near_shore; ViewType sea.
  -- --------------------------------------------------------------------------
  INSERT INTO public."EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "IsDeleted",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType",
    "Created"
  ) VALUES (
    v_property_id,
    'Rambla Williman',
    '4521',
    'Playa Mansa',
    'Punta del Este',
    'Maldonado',
    '20100',
    'Uruguay',
    -34.9475,
    -54.9338,
    140,
    0,
    3,
    2,
    true,
    1,
    v_owner_id,
    false,
    true,
    true,
    true,
    true,
    6,
    'near_shore'::public."LocationCategory",
    'sea'::public."ViewType",
    now()
  )
  ON CONFLICT ("Id") DO UPDATE SET
    "StreetName" = EXCLUDED."StreetName",
    "HouseNumber" = EXCLUDED."HouseNumber",
    "Neighborhood" = EXCLUDED."Neighborhood",
    "City" = EXCLUDED."City",
    "State" = EXCLUDED."State",
    "ZipCode" = EXCLUDED."ZipCode",
    "Country" = EXCLUDED."Country",
    "LocationLatitude" = EXCLUDED."LocationLatitude",
    "LocationLongitude" = EXCLUDED."LocationLongitude",
    "AreaValue" = EXCLUDED."AreaValue",
    "AreaUnit" = EXCLUDED."AreaUnit",
    "Bedrooms" = EXCLUDED."Bedrooms",
    "Bathrooms" = EXCLUDED."Bathrooms",
    "HasGarage" = EXCLUDED."HasGarage",
    "GarageSpaces" = EXCLUDED."GarageSpaces",
    "OwnerId" = EXCLUDED."OwnerId",
    "IsDeleted" = false,
    "HasLaundryRoom" = EXCLUDED."HasLaundryRoom",
    "HasPool" = EXCLUDED."HasPool",
    "HasBalcony" = EXCLUDED."HasBalcony",
    "IsFurnished" = EXCLUDED."IsFurnished",
    "Capacity" = EXCLUDED."Capacity",
    "LocationCategory" = EXCLUDED."LocationCategory",
    "ViewType" = EXCLUDED."ViewType";

  -- --------------------------------------------------------------------------
  -- SummerRentExtension (booking rules)
  -- LeadTimeDays = 1 so holds at +14 days remain valid.
  -- --------------------------------------------------------------------------
  INSERT INTO public."SummerRentExtension" (
    "EstatePropertyId",
    "MinStayDays",
    "MaxStayDays",
    "LeadTimeDays",
    "BufferDays",
    "Created",
    "LastModified"
  ) VALUES (
    v_property_id,
    3,
    30,
    1,
    1,
    now(),
    now()
  )
  ON CONFLICT ("EstatePropertyId") DO UPDATE SET
    "MinStayDays" = EXCLUDED."MinStayDays",
    "MaxStayDays" = EXCLUDED."MaxStayDays",
    "LeadTimeDays" = EXCLUDED."LeadTimeDays",
    "BufferDays" = EXCLUDED."BufferDays",
    "LastModified" = now();

  -- --------------------------------------------------------------------------
  -- Listings (published SummerRent; featured so pricing/booking RPCs find it)
  -- Currency 0 = USD; Status 1 = rent; RentPricePeriod PerNight.
  -- BasePrice is required for dynamic stay totals.
  -- --------------------------------------------------------------------------
  INSERT INTO public."Listings" (
    "Id",
    "EstatePropertyId",
    "ListingType",
    "Title",
    "Description",
    "AvailableFrom",
    "Capacity",
    "Currency",
    "RentPrice",
    "RentPricePeriod",
    "BasePrice",
    "MinPrice",
    "MaxPrice",
    "HasCommonExpenses",
    "IsElectricityIncluded",
    "IsWaterIncluded",
    "IsPriceVisible",
    "Status",
    "IsActive",
    "IsPropertyVisible",
    "IsFeatured",
    "BlockedForBooking",
    "LongStayDiscountEnabled",
    "LongStayMinDays",
    "LongStayDiscountPercentage",
    "IsDeleted",
    "Created",
    "LastModified"
  ) VALUES (
    v_listing_id,
    v_property_id,
    'SummerRent'::public."ListingType",
    'Casa de verano en Playa Mansa',
    'Casa frente al mar en Punta del Este, 3 dormitorios, pileta y parrillero. Ideal para vacaciones de verano.',
    now(),
    6,
    0,
    v_nightly,
    'PerNight'::public."RentPricePeriod",
    v_nightly,
    120,
    280,
    false,
    false,
    true,
    true,
    1,
    true,
    true,
    true,
    false,
    true,
    7,
    10,
    false,
    now(),
    now()
  )
  ON CONFLICT ("Id") DO UPDATE SET
    "EstatePropertyId" = EXCLUDED."EstatePropertyId",
    "ListingType" = EXCLUDED."ListingType",
    "Title" = EXCLUDED."Title",
    "Description" = EXCLUDED."Description",
    "AvailableFrom" = EXCLUDED."AvailableFrom",
    "Capacity" = EXCLUDED."Capacity",
    "Currency" = EXCLUDED."Currency",
    "RentPrice" = EXCLUDED."RentPrice",
    "RentPricePeriod" = EXCLUDED."RentPricePeriod",
    "BasePrice" = EXCLUDED."BasePrice",
    "MinPrice" = EXCLUDED."MinPrice",
    "MaxPrice" = EXCLUDED."MaxPrice",
    "HasCommonExpenses" = EXCLUDED."HasCommonExpenses",
    "IsElectricityIncluded" = EXCLUDED."IsElectricityIncluded",
    "IsWaterIncluded" = EXCLUDED."IsWaterIncluded",
    "IsPriceVisible" = EXCLUDED."IsPriceVisible",
    "Status" = EXCLUDED."Status",
    "IsActive" = true,
    "IsPropertyVisible" = true,
    "IsFeatured" = true,
    "BlockedForBooking" = false,
    "LongStayDiscountEnabled" = EXCLUDED."LongStayDiscountEnabled",
    "LongStayMinDays" = EXCLUDED."LongStayMinDays",
    "LongStayDiscountPercentage" = EXCLUDED."LongStayDiscountPercentage",
    "IsDeleted" = false,
    "LastModified" = now();

  -- --------------------------------------------------------------------------
  -- EstatePropertyPolicy (localized es/en only)
  -- --------------------------------------------------------------------------
  INSERT INTO public."EstatePropertyPolicy" (
    "Id",
    "EstatePropertyId",
    "ListingType",
    "LocalizedTitle",
    "LocalizedDescription",
    "DisplayOrder",
    "IsDeleted",
    "Created",
    "LastModified"
  ) VALUES (
    v_policy_checkin_id,
    v_property_id,
    'SummerRent'::public."ListingType",
    jsonb_build_object(
      'es', 'Check-in y check-out',
      'en', 'Check-in and check-out'
    ),
    jsonb_build_object(
      'es', 'Check-in desde las 15:00. Check-out hasta las 11:00.',
      'en', 'Check-in from 3:00 PM. Check-out by 11:00 AM.'
    ),
    0,
    false,
    now(),
    now()
  )
  ON CONFLICT ("Id") DO UPDATE SET
    "EstatePropertyId" = EXCLUDED."EstatePropertyId",
    "ListingType" = EXCLUDED."ListingType",
    "LocalizedTitle" = EXCLUDED."LocalizedTitle",
    "LocalizedDescription" = EXCLUDED."LocalizedDescription",
    "DisplayOrder" = EXCLUDED."DisplayOrder",
    "IsDeleted" = false,
    "LastModified" = now();

  INSERT INTO public."EstatePropertyPolicy" (
    "Id",
    "EstatePropertyId",
    "ListingType",
    "LocalizedTitle",
    "LocalizedDescription",
    "DisplayOrder",
    "IsDeleted",
    "Created",
    "LastModified"
  ) VALUES (
    v_policy_house_id,
    v_property_id,
    'SummerRent'::public."ListingType",
    jsonb_build_object(
      'es', 'Normas de la casa',
      'en', 'House rules'
    ),
    jsonb_build_object(
      'es', 'No fumar en interiores. Mascotas permitidas con aviso previo. Máximo 6 huéspedes.',
      'en', 'No indoor smoking. Pets allowed with prior notice. Maximum 6 guests.'
    ),
    1,
    false,
    now(),
    now()
  )
  ON CONFLICT ("Id") DO UPDATE SET
    "EstatePropertyId" = EXCLUDED."EstatePropertyId",
    "ListingType" = EXCLUDED."ListingType",
    "LocalizedTitle" = EXCLUDED."LocalizedTitle",
    "LocalizedDescription" = EXCLUDED."LocalizedDescription",
    "DisplayOrder" = EXCLUDED."DisplayOrder",
    "IsDeleted" = false,
    "LastModified" = now();

  -- --------------------------------------------------------------------------
  -- EstatePropertyAmenity (lookup existing SummerRent catalog rows by name)
  -- --------------------------------------------------------------------------
  DELETE FROM public."EstatePropertyAmenity"
  WHERE "EstatePropertyId" = v_property_id;

  INSERT INTO public."EstatePropertyAmenity" (
    "EstatePropertyId",
    "AmenityId",
    "CreatedAtUtc",
    "DeletedAtUtc",
    "LocalizedDescriptions"
  )
  SELECT
    v_property_id,
    a."Id",
    now(),
    NULL,
    '{}'::jsonb
  FROM public."Amenities" a
  WHERE a."IsDeleted" = false
    AND a."PropertyType" = 'SummerRent'::public."PropertyType"
    AND a."Name" IN (
      'Wi-Fi / Internet',
      'Aire acondicionado',
      'Piscina',
      'Parrillero',
      'Amueblado'
    );

  IF NOT FOUND THEN
    RAISE NOTICE 'insert-property: no matching SummerRent amenities found; amenity links skipped.';
  END IF;

  -- --------------------------------------------------------------------------
  -- Sample booking (does not overlap hold-otp dates at +14..+17)
  -- Status 0 = Pending; Currency 0 = USD; ReservationCode RSV-XXXXXX.
  -- --------------------------------------------------------------------------
  INSERT INTO public."Guests" (
    "Id",
    "FirstName",
    "LastName",
    "Email",
    "PhoneNumber",
    "Created",
    "LastModified"
  ) VALUES (
    v_guest_id,
    'Ana',
    'Pereira',
    'ana.pereira.test@email.com',
    '+59899111222',
    now(),
    now()
  )
  ON CONFLICT ("Id") DO UPDATE SET
    "FirstName" = EXCLUDED."FirstName",
    "LastName" = EXCLUDED."LastName",
    "Email" = EXCLUDED."Email",
    "PhoneNumber" = EXCLUDED."PhoneNumber",
    "LastModified" = now();

  v_nights := (v_check_out - v_check_in);
  v_total := round((v_nightly * v_nights)::numeric, 2);

  INSERT INTO public."Bookings" (
    "Id",
    "EstatePropertyId",
    "GuestId",
    "CheckInDate",
    "CheckOutDate",
    "Status",
    "ValidationStatus",
    "HasConflict",
    "GuestCount",
    "TotalAmount",
    "Currency",
    "Notes",
    "BookingSource",
    "IsDeleted",
    "Created",
    "LastModified",
    "PaymentStatus",
    "ReservationCode",
    "ListingType"
  ) VALUES (
    v_booking_id,
    v_property_id,
    v_guest_id,
    v_check_in,
    v_check_out,
    0,
    0,
    false,
    4,
    v_total,
    0,
    'Seed booking from tasks/insert-property.sql',
    'manual_seed',
    false,
    now(),
    now(),
    0,
    'RSV-SEED01',
    'SummerRent'::public."ListingType"
  )
  ON CONFLICT ("Id") DO UPDATE SET
    "EstatePropertyId" = EXCLUDED."EstatePropertyId",
    "GuestId" = EXCLUDED."GuestId",
    "CheckInDate" = EXCLUDED."CheckInDate",
    "CheckOutDate" = EXCLUDED."CheckOutDate",
    "Status" = 0,
    "GuestCount" = EXCLUDED."GuestCount",
    "TotalAmount" = EXCLUDED."TotalAmount",
    "Currency" = EXCLUDED."Currency",
    "Notes" = EXCLUDED."Notes",
    "IsDeleted" = false,
    "ReservationCode" = EXCLUDED."ReservationCode",
    "ListingType" = EXCLUDED."ListingType",
    "LastModified" = now();

  RAISE NOTICE 'ownerId=%', v_owner_id;
  RAISE NOTICE 'planId=%', v_plan_id;
  RAISE NOTICE 'propertyId=%', v_property_id;
  RAISE NOTICE 'listingId=%', v_listing_id;
  RAISE NOTICE 'bookingId=% RSV-SEED01 % to % (4 guests, total % USD)',
    v_booking_id, v_check_in, v_check_out, v_total;
  RAISE NOTICE 'create_booking_hold(property %, check_in CURRENT_DATE+14, listing_type SummerRent)',
    v_property_id;
END $$;
