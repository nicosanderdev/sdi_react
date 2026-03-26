-- Edge function helper RPC: regenerate_property_ical_export_token
-- Regenerates the iCal export token for a property's SummerRentExtension row.

CREATE OR REPLACE FUNCTION public.regenerate_property_ical_export_token(
    property_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_token uuid := gen_random_uuid();
BEGIN
    UPDATE public."SummerRentExtension"
    SET "ICalExportToken" = v_new_token
    WHERE "EstatePropertyId" = property_id
      AND "IsDeleted" = false;

    RETURN v_new_token;
END;
$$;

