-- Allow platform admins to update any estate property, and add the missing
-- wizard-extensions updater used by the property edit flow.

CREATE OR REPLACE FUNCTION public.is_property_owner(p_user_id uuid, p_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or exists (
      select 1
      from public."EstateProperties" ep
      join public."Owners" o
        on o."Id" = ep."OwnerId"
       and o."IsDeleted" = false
      where ep."Id" = p_property_id
        and ep."IsDeleted" = false
        and (
          (
            o."OwnerType" = 'member'
            and exists (
              select 1
              from public."Members" m
              where m."Id" = o."MemberId"
                and m."UserId" = p_user_id
                and m."IsDeleted" = false
            )
          )
          or (
            o."OwnerType" = 'company'
            and exists (
              select 1
              from public."CompanyMembers" cm
              join public."Members" m
                on m."Id" = cm."MemberId"
               and m."IsDeleted" = false
              where cm."CompanyId" = o."CompanyId"
                and cm."IsDeleted" = false
                and cm."Role" in ('Admin', 'Manager')
                and m."UserId" = p_user_id
            )
          )
        )
    );
$$;

COMMENT ON FUNCTION public.is_property_owner(uuid, uuid) IS
  'True when the caller is a platform admin, or when p_user_id owns/manages the estate property via Owners / CompanyMembers.';

CREATE OR REPLACE FUNCTION public.update_estate_property_wizard_extensions(
  p_property_id text,
  p_allows_financing boolean DEFAULT NULL,
  p_is_new_construction boolean DEFAULT NULL,
  p_has_mortgage boolean DEFAULT NULL,
  p_hoa_fees double precision DEFAULT NULL,
  p_min_contract_months integer DEFAULT NULL,
  p_requires_guarantee boolean DEFAULT NULL,
  p_guarantee_type text DEFAULT NULL,
  p_allows_pets boolean DEFAULT NULL,
  p_min_stay_days integer DEFAULT NULL,
  p_max_stay_days integer DEFAULT NULL,
  p_lead_time_days integer DEFAULT NULL,
  p_buffer_days integer DEFAULT NULL,
  p_max_guests integer DEFAULT NULL,
  p_has_catering boolean DEFAULT NULL,
  p_has_sound_system boolean DEFAULT NULL,
  p_closing_hour text DEFAULT NULL,
  p_allowed_events_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_property_id uuid := p_property_id::uuid;
BEGIN
  IF NOT public.user_can_manage_estate_property(v_property_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'User cannot manage this property';
  END IF;

  UPDATE public."RealEstateExtension"
  SET
    "AllowsFinancing" = COALESCE(p_allows_financing, "AllowsFinancing"),
    "IsNewConstruction" = COALESCE(p_is_new_construction, "IsNewConstruction"),
    "HasMortgage" = COALESCE(p_has_mortgage, "HasMortgage"),
    "HOAFees" = COALESCE(p_hoa_fees, "HOAFees"),
    "MinContractMonths" = COALESCE(p_min_contract_months, "MinContractMonths"),
    "RequiresGuarantee" = COALESCE(p_requires_guarantee, "RequiresGuarantee"),
    "GuaranteeType" = COALESCE(p_guarantee_type, "GuaranteeType"),
    "AllowsPets" = COALESCE(p_allows_pets, "AllowsPets"),
    "LastModified" = now(),
    "LastModifiedBy" = auth.uid()::text
  WHERE "EstatePropertyId" = v_property_id;

  UPDATE public."SummerRentExtension"
  SET
    "MinStayDays" = COALESCE(p_min_stay_days, "MinStayDays"),
    "MaxStayDays" = COALESCE(p_max_stay_days, "MaxStayDays"),
    "LeadTimeDays" = COALESCE(p_lead_time_days, "LeadTimeDays"),
    "BufferDays" = COALESCE(p_buffer_days, "BufferDays"),
    "LastModified" = now(),
    "LastModifiedBy" = auth.uid()::text
  WHERE "EstatePropertyId" = v_property_id;

  UPDATE public."EventVenueExtension"
  SET
    "MaxGuests" = COALESCE(p_max_guests, "MaxGuests"),
    "HasCatering" = COALESCE(p_has_catering, "HasCatering"),
    "HasSoundSystem" = COALESCE(p_has_sound_system, "HasSoundSystem"),
    "ClosingHour" = COALESCE(NULLIF(p_closing_hour, '')::time, "ClosingHour"),
    "AllowedEventsDescription" = COALESCE(p_allowed_events_description, "AllowedEventsDescription"),
    "LastModified" = now(),
    "LastModifiedBy" = auth.uid()::text
  WHERE "EstatePropertyId" = v_property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_estate_property_wizard_extensions(
  text, boolean, boolean, boolean, double precision, integer, boolean, text, boolean,
  integer, integer, integer, integer, integer, boolean, boolean, text, text
) TO authenticated;
