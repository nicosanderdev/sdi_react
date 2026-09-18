-- Default listing currency to UYU for non-admins, unpublish non-UYU public
-- listings, deactivate USD plans, and move subjects onto UYU plans.

CREATE OR REPLACE FUNCTION public.current_assigned_plan(
  p_subject_type text,
  p_subject_id uuid
) RETURNS public."Plans"
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.*
  FROM public."BillingPlanAssignments" bpa
  JOIN public."Plans" p
    ON p."Id" = bpa."PlanId"
   AND p."IsDeleted" = false
  WHERE bpa."SubjectType" = p_subject_type
    AND bpa."MemberOrCompanyId" = p_subject_id
    AND bpa."IsActive" = true
    AND bpa."StartDate" <= now()
    AND (bpa."EndDate" IS NULL OR bpa."EndDate" >= now())
  ORDER BY bpa."StartDate" DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_assigned_plan(text, uuid) IS
  'Active billing assignment plan. Assignment wins even if the plan row is inactive.';

GRANT EXECUTE ON FUNCTION public.current_assigned_plan(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listings_enforce_owner_uyu()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW."Currency" := 1;
    RETURN NEW;
  END IF;

  NEW."Currency" := OLD."Currency";
  IF coalesce(NEW."Currency", 0) IS DISTINCT FROM 1 THEN
    NEW."IsActive" := false;
    NEW."IsPropertyVisible" := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_owner_uyu ON public."Listings";
CREATE TRIGGER listings_enforce_owner_uyu
  BEFORE INSERT OR UPDATE ON public."Listings"
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_enforce_owner_uyu();

CREATE OR REPLACE FUNCTION public.assert_published_property_within_plan(
  p_subject_type text,
  p_subject_id uuid,
  p_estate_property_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_published_count integer;
  v_already_published boolean := false;
  v_plan public."Plans"%ROWTYPE;
BEGIN
  IF p_subject_type NOT IN ('member', 'company') THEN
    RAISE EXCEPTION 'Invalid billing subject type: %', p_subject_type;
  END IF;

  SELECT * INTO v_plan FROM public.current_assigned_plan(p_subject_type, p_subject_id);
  v_limit := coalesce(v_plan."MaxPublishedProperties", v_plan."ListingLimit");

  IF v_limit IS NULL THEN
    RETURN;
  END IF;

  IF p_estate_property_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public."Listings" l
      WHERE l."EstatePropertyId" = p_estate_property_id
        AND l."IsDeleted" = false
        AND l."IsPropertyVisible" = true
        AND l."IsActive" = true
    ) INTO v_already_published;
  END IF;

  IF v_already_published THEN
    RETURN;
  END IF;

  IF p_subject_type = 'member' THEN
    SELECT count(*)::integer INTO v_published_count
    FROM public."EstateProperties" ep
    INNER JOIN public."Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
    INNER JOIN public."Listings" l ON l."EstatePropertyId" = ep."Id" AND l."IsDeleted" = false
    WHERE ep."IsDeleted" = false
      AND o."OwnerType" = 'member'
      AND o."MemberId" = p_subject_id
      AND l."IsPropertyVisible" = true
      AND l."IsActive" = true;
  ELSE
    SELECT count(*)::integer INTO v_published_count
    FROM public."EstateProperties" ep
    INNER JOIN public."Owners" o ON ep."OwnerId" = o."Id" AND o."IsDeleted" = false
    INNER JOIN public."Listings" l ON l."EstatePropertyId" = ep."Id" AND l."IsDeleted" = false
    WHERE ep."IsDeleted" = false
      AND o."OwnerType" = 'company'
      AND o."CompanyId" = p_subject_id
      AND l."IsPropertyVisible" = true
      AND l."IsActive" = true;
  END IF;

  IF v_published_count >= v_limit THEN
    RAISE EXCEPTION 'Published property limit exceeded. You have % published properties but your plan allows maximum %.',
      v_published_count, v_limit;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_estate_property_photo_cap(p_estate_property_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_type text;
  v_member_id uuid;
  v_company_id uuid;
  v_subject_type text;
  v_subject_id uuid;
  v_plan public."Plans"%ROWTYPE;
BEGIN
  IF p_estate_property_id IS NULL THEN
    RETURN 30;
  END IF;

  SELECT o."OwnerType", o."MemberId", o."CompanyId"
    INTO v_owner_type, v_member_id, v_company_id
  FROM public."EstateProperties" ep
  INNER JOIN public."Owners" o
    ON o."Id" = ep."OwnerId"
   AND o."IsDeleted" = false
  WHERE ep."Id" = p_estate_property_id
    AND ep."IsDeleted" = false;

  IF NOT FOUND THEN
    RETURN 30;
  END IF;

  IF v_owner_type = 'company' AND v_company_id IS NOT NULL THEN
    v_subject_type := 'company';
    v_subject_id := v_company_id;
  ELSIF v_member_id IS NOT NULL THEN
    v_subject_type := 'member';
    v_subject_id := v_member_id;
  ELSE
    RETURN 30;
  END IF;

  SELECT * INTO v_plan FROM public.current_assigned_plan(v_subject_type, v_subject_id);
  RETURN LEAST(COALESCE(v_plan."MaxPhotosPerProperty", 30), 30);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_permanent_billing_plan(
  p_subject_type text,
  p_subject_id uuid,
  p_plan_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_assignment_id uuid;
  v_audience text;
BEGIN
  IF p_subject_type NOT IN ('member', 'company') THEN
    RAISE EXCEPTION 'Invalid subject type.';
  END IF;

  SELECT p."Audience"
    INTO v_audience
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_audience IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  IF v_audience IS DISTINCT FROM p_subject_type THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  UPDATE public."BillingPlanAssignments"
  SET
    "IsActive" = false,
    "EndDate" = v_now,
    "LastModified" = v_now
  WHERE "SubjectType" = p_subject_type
    AND "MemberOrCompanyId" = p_subject_id
    AND "IsActive" = true;

  INSERT INTO public."BillingPlanAssignments" (
    "SubjectType",
    "MemberOrCompanyId",
    "PlanId",
    "StartDate",
    "EndDate",
    "IsActive",
    "Created",
    "LastModified"
  ) VALUES (
    p_subject_type,
    p_subject_id,
    p_plan_id,
    v_now,
    NULL,
    true,
    v_now,
    v_now
  )
  RETURNING "Id" INTO v_assignment_id;

  IF p_subject_type = 'company' THEN
    UPDATE public."BillingCycles"
    SET
      "Status" = 'closed',
      "UpdatedAt" = v_now,
      "LastModifiedBy" = 'system'
    WHERE "SubjectType" = 'company'
      AND "MemberOrCompanyId" = p_subject_id
      AND "Status" = 'open';

    PERFORM public.ensure_open_company_billing_cycle(p_subject_id);
  END IF;

  RETURN v_assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_member_plan_as_admin(
  p_member_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public."Plans"%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_member_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Member and plan are required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."Members" m
    WHERE m."Id" = p_member_id AND m."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT *
    INTO v_plan
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_plan."Id" IS NULL
     OR v_plan."Audience" IS DISTINCT FROM 'member' THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  PERFORM public.assign_permanent_billing_plan('member', p_member_id, p_plan_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_company_for_current_member(
  p_name text,
  p_billing_email text,
  p_description text DEFAULT '',
  p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_member public."Members"%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_company public."Companies"%ROWTYPE;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := nullif(trim(coalesce(p_billing_email, '')), '');
  v_description text := trim(coalesce(p_description, ''));
  v_plan public."Plans"%ROWTYPE;
  v_amount numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'El nombre de la compañía es obligatorio';
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'El correo de facturación es obligatorio';
  END IF;

  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Debes elegir un plan de compañía';
  END IF;

  SELECT *
    INTO v_member
  FROM public."Members" m
  WHERE m."UserId" = v_user_id
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_member."Id" IS NULL THEN
    RAISE EXCEPTION 'Member not found for user';
  END IF;

  IF lower(trim(coalesce(v_member."Role", 'user'))) = 'user'
     AND (v_member."EmailVerifiedAt" IS NULL OR v_member."PhoneVerifiedAt" IS NULL) THEN
    RAISE EXCEPTION 'Debes verificar tu correo electrónico y teléfono antes de crear o editar propiedades o empresas. Ve a tu perfil para verificarlos.';
  END IF;

  SELECT *
    INTO v_plan
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_plan."Id" IS NULL THEN
    RAISE EXCEPTION 'Plan not found or inactive';
  END IF;

  IF v_plan."Audience" IS DISTINCT FROM 'company' THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  IF NOT public.is_admin() THEN
    IF coalesce(v_plan."IsActiveV2", v_plan."IsActive", true) = false
       OR upper(trim(coalesce(v_plan."Currency", ''))) IS DISTINCT FROM 'UYU' THEN
      RAISE EXCEPTION 'Plan is not available for this entity type.';
    END IF;
  END IF;

  v_amount := coalesce(v_plan."MonthlyPrice", v_plan."Price", 0);
  IF v_amount > 0 AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PLAN_PAYMENT_REQUIRED';
  END IF;

  INSERT INTO public."Companies" (
    "Name",
    "Description",
    "BillingContactUserId",
    "BillingEmail",
    "CreatedAt",
    "IsDeleted",
    "Created",
    "CreatedBy",
    "LastModified",
    "LastModifiedBy"
  ) VALUES (
    v_name,
    v_description,
    v_user_id,
    v_email,
    v_now,
    false,
    v_now,
    v_user_id::text,
    v_now,
    v_user_id::text
  )
  RETURNING * INTO v_company;

  INSERT INTO public."CompanyMembers" (
    "MemberId",
    "CompanyId",
    "Role",
    "AddedBy",
    "JoinedAt",
    "IsDeleted"
  ) VALUES (
    v_member."Id",
    v_company."Id",
    'Admin',
    v_member."Id",
    v_now,
    false
  );

  PERFORM public.assign_permanent_billing_plan('company', v_company."Id", p_plan_id);

  RETURN to_jsonb(v_company);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_company_plan_for_current_admin(
  p_company_id uuid,
  p_plan_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan public."Plans"%ROWTYPE;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_company_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Company and plan are required.';
  END IF;

  IF NOT public.is_admin() AND NOT public.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'Solo los administradores de la empresa pueden cambiar el plan.';
  END IF;

  SELECT *
    INTO v_plan
  FROM public."Plans" p
  WHERE p."Id" = p_plan_id
    AND p."IsDeleted" = false;

  IF v_plan."Id" IS NULL
     OR v_plan."Audience" IS DISTINCT FROM 'company' THEN
    RAISE EXCEPTION 'Plan is not available for this entity type.';
  END IF;

  IF NOT public.is_admin() THEN
    IF coalesce(v_plan."IsActiveV2", v_plan."IsActive", true) = false
       OR upper(trim(coalesce(v_plan."Currency", ''))) IS DISTINCT FROM 'UYU' THEN
      RAISE EXCEPTION 'Plan is not available for this entity type.';
    END IF;
  END IF;

  v_amount := coalesce(v_plan."MonthlyPrice", v_plan."Price", 0);
  IF v_amount > 0 AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PLAN_PAYMENT_REQUIRED';
  END IF;

  PERFORM public.assign_permanent_billing_plan('company', p_company_id, p_plan_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_listing_version(
  p_estate_property_id uuid,
  p_listing_type text,
  p_title text,
  p_description text DEFAULT NULL::text,
  p_available_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_currency integer DEFAULT 1,
  p_sale_price double precision DEFAULT NULL::double precision,
  p_rent_price double precision DEFAULT NULL::double precision,
  p_rent_price_period text DEFAULT NULL::text,
  p_is_price_visible boolean DEFAULT true,
  p_is_active boolean DEFAULT true,
  p_is_property_visible boolean DEFAULT true,
  p_blocked_for_booking boolean DEFAULT false,
  p_base_price numeric DEFAULT NULL::numeric,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_long_stay_discount_enabled boolean DEFAULT false,
  p_long_stay_min_days integer DEFAULT NULL::integer,
  p_long_stay_discount_percentage numeric DEFAULT NULL::numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_new_listing_id uuid;
  v_rent double precision := p_rent_price;
  v_base numeric := p_base_price;
  v_period public."RentPricePeriod" := null;
  v_owner_type text;
  v_member_id uuid;
  v_company_id uuid;
  v_subject_type text;
  v_subject_id uuid;
  v_will_publish boolean;
begin
  if p_rent_price_period is not null and p_rent_price_period not in ('PerNight', 'PerMonth') then
    raise exception 'Invalid rent price period: %', p_rent_price_period;
  end if;

  if p_rent_price_period is not null then
    v_period := p_rent_price_period::public."RentPricePeriod";
  end if;

  if v_base is not null and v_rent is null then
    v_rent := v_base::double precision;
  elsif v_rent is not null and v_base is null then
    v_base := v_rent::numeric;
  end if;

  v_will_publish := coalesce(p_is_active, false) and coalesce(p_is_property_visible, false);

  if v_will_publish then
    select o."OwnerType", o."MemberId", o."CompanyId"
      into v_owner_type, v_member_id, v_company_id
    from public."EstateProperties" ep
    join public."Owners" o
      on o."Id" = ep."OwnerId"
     and o."IsDeleted" = false
    where ep."Id" = p_estate_property_id
      and ep."IsDeleted" = false;

    if v_owner_type = 'company' and v_company_id is not null then
      v_subject_type := 'company';
      v_subject_id := v_company_id;
    elsif v_member_id is not null then
      v_subject_type := 'member';
      v_subject_id := v_member_id;
    end if;

    if v_subject_type is not null and v_subject_id is not null then
      perform public.assert_published_property_within_plan(
        v_subject_type,
        v_subject_id,
        p_estate_property_id
      );
    end if;
  end if;

  update public."Listings"
  set
    "IsFeatured" = false,
    "IsActive" = false,
    "IsPropertyVisible" = false,
    "LastModified" = now()
  where "EstatePropertyId" = p_estate_property_id
    and "ListingType" = p_listing_type::public."ListingType"
    and "IsDeleted" = false
    and "IsFeatured" = true;

  insert into public."Listings" (
    "EstatePropertyId", "ListingType", "Title", "Description", "AvailableFrom", "Currency",
    "SalePrice", "RentPrice", "RentPricePeriod", "IsPriceVisible", "IsActive", "IsPropertyVisible",
    "IsFeatured", "BlockedForBooking", "BasePrice", "MinPrice", "MaxPrice",
    "LongStayDiscountEnabled", "LongStayMinDays", "LongStayDiscountPercentage",
    "IsDeleted", "Created", "LastModified"
  )
  values (
    p_estate_property_id, p_listing_type::public."ListingType", p_title, p_description,
    coalesce(p_available_from, now()), p_currency, p_sale_price, v_rent, v_period,
    p_is_price_visible, p_is_active, p_is_property_visible, true, p_blocked_for_booking,
    v_base, p_min_price, p_max_price,
    coalesce(p_long_stay_discount_enabled, false), p_long_stay_min_days, p_long_stay_discount_percentage,
    false, now(), now()
  )
  returning "Id" into v_new_listing_id;

  return v_new_listing_id;
end;
$$;

-- Unpublish public non-UYU listings (0=USD, 1=UYU).
UPDATE public."Listings"
SET
  "IsActive" = false,
  "IsPropertyVisible" = false,
  "LastModified" = now()
WHERE "IsDeleted" = false
  AND coalesce("Currency", 0) IS DISTINCT FROM 1
  AND ("IsActive" = true OR "IsPropertyVisible" = true);

-- Move members without a UYU assignment onto Plan BASE-Inicial.
DO $$
DECLARE
  v_base_inicial uuid := '44444444-4444-4444-8444-444444444444';
  v_company_free uuid := '66666666-6666-4666-8666-666666666666';
  v_member_id uuid;
  v_company_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."Plans" p
    WHERE p."Id" = v_base_inicial AND p."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION 'Plan BASE-Inicial is required for UYU member backfill.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."Plans" p
    WHERE p."Id" = v_company_free AND p."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION 'Plan gratuito compañía is required for UYU company backfill.';
  END IF;

  FOR v_member_id IN
    SELECT m."Id"
    FROM public."Members" m
    WHERE m."IsDeleted" = false
      AND NOT EXISTS (
        SELECT 1
        FROM public."BillingPlanAssignments" bpa
        JOIN public."Plans" p ON p."Id" = bpa."PlanId" AND p."IsDeleted" = false
        WHERE bpa."SubjectType" = 'member'
          AND bpa."MemberOrCompanyId" = m."Id"
          AND bpa."IsActive" = true
          AND bpa."StartDate" <= now()
          AND (bpa."EndDate" IS NULL OR bpa."EndDate" >= now())
          AND upper(trim(coalesce(p."Currency", ''))) = 'UYU'
      )
  LOOP
    PERFORM public.assign_permanent_billing_plan('member', v_member_id, v_base_inicial);
  END LOOP;

  FOR v_company_id IN
    SELECT c."Id"
    FROM public."Companies" c
    WHERE c."IsDeleted" = false
      AND NOT EXISTS (
        SELECT 1
        FROM public."BillingPlanAssignments" bpa
        JOIN public."Plans" p ON p."Id" = bpa."PlanId" AND p."IsDeleted" = false
        WHERE bpa."SubjectType" = 'company'
          AND bpa."MemberOrCompanyId" = c."Id"
          AND bpa."IsActive" = true
          AND bpa."StartDate" <= now()
          AND (bpa."EndDate" IS NULL OR bpa."EndDate" >= now())
          AND upper(trim(coalesce(p."Currency", ''))) = 'UYU'
      )
  LOOP
    PERFORM public.assign_permanent_billing_plan('company', v_company_id, v_company_free);
  END LOOP;
END
$$;

UPDATE public."Plans"
SET
  "IsActive" = false,
  "IsActiveV2" = false,
  "LastModified" = now()
WHERE "IsDeleted" = false
  AND upper(trim(coalesce("Currency", ''))) = 'USD';
