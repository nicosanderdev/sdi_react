-- Unblock Airbnb/Booking/Other iCal inserts, make iCal block upserts idempotent,
-- and align calendar RLS with company Admin/Manager write vs Member view-only.

-- 1. PlatformType: keep 0–4, drop the conflicting 0–1-only check.
ALTER TABLE public."CalendarIntegrations"
  DROP CONSTRAINT IF EXISTS "CalendarIntegrations_PlatformType_check";

-- 2. Idempotent iCal → AvailabilityBlocks upserts
DELETE FROM public."AvailabilityBlocks" a
USING public."AvailabilityBlocks" b
WHERE a."EstatePropertyId" = b."EstatePropertyId"
  AND a."Source" IS NOT DISTINCT FROM b."Source"
  AND a."ExternalEventId" IS NOT NULL
  AND a."ExternalEventId" = b."ExternalEventId"
  AND a."Id" > b."Id";

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_AvailabilityBlocks_Property_ExternalEvent_Source"
  ON public."AvailabilityBlocks" ("EstatePropertyId", "ExternalEventId", "Source");

-- 3. View helper: personal owner, company Admin/Manager, or company Member
CREATE OR REPLACE FUNCTION public.user_can_view_estate_property(p_estate_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.user_can_manage_estate_property(p_estate_property_id)
    OR EXISTS (
      SELECT 1
      FROM public."EstateProperties" ep
      WHERE ep."Id" = p_estate_property_id
        AND ep."IsDeleted" = false
        AND public.user_can_read_owner_record(ep."OwnerId")
    );
$$;

COMMENT ON FUNCTION public.user_can_view_estate_property(uuid) IS
  'True when the caller can manage the property or is any active member of the owning company (view-only for company Member).';

GRANT EXECUTE ON FUNCTION public.user_can_view_estate_property(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_estate_property(uuid) TO service_role;

-- 4. Drop legacy policies that let any company Member mutate calendar rows
DROP POLICY IF EXISTS "Property owners can manage their availability blocks" ON public."AvailabilityBlocks";
DROP POLICY IF EXISTS "Property owners can manage their calendar integrations" ON public."CalendarIntegrations";

DROP POLICY IF EXISTS "AvailabilityBlocks_user_select" ON public."AvailabilityBlocks";
CREATE POLICY "AvailabilityBlocks_user_select"
  ON public."AvailabilityBlocks"
  FOR SELECT
  TO authenticated
  USING (("IsDeleted" = false) AND public.user_can_view_estate_property("EstatePropertyId"));

DROP POLICY IF EXISTS "CalendarIntegrations_user_select" ON public."CalendarIntegrations";
CREATE POLICY "CalendarIntegrations_user_select"
  ON public."CalendarIntegrations"
  FOR SELECT
  TO authenticated
  USING (("IsDeleted" = false) AND public.user_can_view_estate_property("EstatePropertyId"));

-- 5. Regenerating the public export token is a write: Admin/Manager/personal owner only
CREATE OR REPLACE FUNCTION public.regenerate_property_ical_export_token(property_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_uid uuid;
  v_new_token uuid := gen_random_uuid();
begin
  if auth.role() = 'service_role' then
    raise exception 'Not allowed'
      using errcode = 'P0001';
  end if;

  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated'
      using errcode = 'P0001';
  end if;

  if not public.is_property_owner(v_uid, property_id) then
    raise exception 'Access denied'
      using errcode = 'P0001';
  end if;

  update public."SummerRentExtension" s
  set "ICalExportToken" = v_new_token,
      "LastModified" = now()
  where s."EstatePropertyId" = property_id;

  if not found then
    raise exception 'Summer rent extension not found for property'
      using errcode = 'P0001';
  end if;

  return v_new_token::text;
end;
$$;
