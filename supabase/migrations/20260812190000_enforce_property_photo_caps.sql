-- Enforce per-property photo caps: min(plan.MaxPhotosPerProperty ?? 30, 30).
-- Existing over-cap libraries are kept; new inserts are blocked when at/over the cap.

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
  v_plan_cap integer;
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

  SELECT p."MaxPhotosPerProperty"
    INTO v_plan_cap
  FROM public."BillingPlanAssignments" bpa
  JOIN public."Plans" p
    ON p."Id" = bpa."PlanId"
   AND coalesce(p."IsActiveV2", p."IsActive", true) = true
   AND p."IsDeleted" = false
  WHERE bpa."SubjectType" = v_subject_type
    AND bpa."MemberOrCompanyId" = v_subject_id
    AND bpa."IsActive" = true
    AND bpa."StartDate" <= now()
    AND (bpa."EndDate" IS NULL OR bpa."EndDate" >= now())
  ORDER BY bpa."StartDate" DESC
  LIMIT 1;

  RETURN LEAST(COALESCE(v_plan_cap, 30), 30);
END;
$$;

COMMENT ON FUNCTION public.resolve_estate_property_photo_cap(uuid) IS
  'Effective photo cap for a property: min(plan MaxPhotosPerProperty ?? 30, 30).';

CREATE OR REPLACE FUNCTION public.assert_estate_property_photo_count_allowed(
  p_estate_property_id uuid,
  p_desired_total integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cap integer;
BEGIN
  v_cap := public.resolve_estate_property_photo_cap(p_estate_property_id);
  IF p_desired_total IS NULL THEN
    RETURN;
  END IF;
  IF p_desired_total > v_cap THEN
    RAISE EXCEPTION 'Photo limit exceeded. This property allows a maximum of % photos (requested %).',
      v_cap, p_desired_total;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_property_image_cap_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cap integer;
  v_count integer;
BEGIN
  IF NEW."IsDeleted" = true THEN
    RETURN NEW;
  END IF;

  v_cap := public.resolve_estate_property_photo_cap(NEW."EstatePropertyId");

  SELECT count(*)::integer
    INTO v_count
  FROM public."PropertyImages" pi
  WHERE pi."EstatePropertyId" = NEW."EstatePropertyId"
    AND pi."IsDeleted" = false
    AND (TG_OP <> 'UPDATE' OR pi."Id" IS DISTINCT FROM NEW."Id");

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'Photo limit exceeded. This property already has % photos; plan allows a maximum of %.',
      v_count, v_cap;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_images_enforce_photo_cap ON public."PropertyImages";
CREATE TRIGGER trg_property_images_enforce_photo_cap
  BEFORE INSERT OR UPDATE OF "IsDeleted", "EstatePropertyId"
  ON public."PropertyImages"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_property_image_cap_trigger();

CREATE OR REPLACE FUNCTION public.insert_property_image(
  p_estate_property_id uuid,
  p_url text,
  p_alt_text text DEFAULT NULL::text,
  p_is_main boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_image_id uuid := gen_random_uuid();
  v_cap integer;
  v_count integer;
BEGIN
  v_cap := public.resolve_estate_property_photo_cap(p_estate_property_id);

  SELECT count(*)::integer
    INTO v_count
  FROM public."PropertyImages" pi
  WHERE pi."EstatePropertyId" = p_estate_property_id
    AND pi."IsDeleted" = false;

  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'Photo limit exceeded. This property already has % photos; plan allows a maximum of %.',
      v_count, v_cap;
  END IF;

  INSERT INTO public."PropertyImages" (
    "Id",
    "Url",
    "AltText",
    "IsMain",
    "EstatePropertyId",
    "IsDeleted",
    "Created",
    "CreatedBy",
    "LastModified",
    "LastModifiedBy"
  ) VALUES (
    v_image_id,
    p_url,
    p_alt_text,
    p_is_main,
    p_estate_property_id,
    false,
    now(),
    NULL,
    now(),
    NULL
  );

  RETURN v_image_id;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Photo limit exceeded%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'Failed to insert property image for estate property %: %', p_estate_property_id, SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_estate_property_photo_cap(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_estate_property_photo_cap(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_estate_property_photo_count_allowed(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_estate_property_photo_count_allowed(uuid, integer) TO service_role;
