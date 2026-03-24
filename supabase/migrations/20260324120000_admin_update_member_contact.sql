-- Admin-only: update member contact fields with email/phone uniqueness among active members.
-- Called from authenticated admin JWT (e.g. edge function forwards Authorization header).

CREATE OR REPLACE FUNCTION public.admin_update_member_contact(
  p_member_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_member_id uuid;
  v_email_taken boolean;
  v_phone_taken boolean;
  v_phone_norm text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Forbidden');
  END IF;

  p_email := trim(coalesce(p_email, ''));
  v_phone_norm := nullif(trim(coalesce(p_phone, '')), '');

  IF p_email = '' THEN
    RETURN json_build_object('success', false, 'message', 'Email is required');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public."Members" m
    WHERE m."IsDeleted" = false
      AND m."Id" <> p_member_id
      AND lower(trim(coalesce(m."Email", ''))) = lower(p_email)
  ) INTO v_email_taken;

  IF v_email_taken THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Email already in use',
      'field_errors', json_build_object('email', 'This email is already used by another member')
    );
  END IF;

  IF v_phone_norm IS NOT NULL AND v_phone_norm <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public."Members" m
      WHERE m."IsDeleted" = false
        AND m."Id" <> p_member_id
        AND trim(coalesce(m."Phone", '')) <> ''
        AND trim(m."Phone") = v_phone_norm
    ) INTO v_phone_taken;

    IF v_phone_taken THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Phone already in use',
        'field_errors', json_build_object('phone', 'This phone number is already used by another member')
      );
    END IF;
  END IF;

  SELECT m."Id"
  INTO v_admin_member_id
  FROM public."Members" m
  WHERE m."UserId" = auth.uid()
    AND m."IsDeleted" = false
  LIMIT 1;

  UPDATE public."Members"
  SET
    "FirstName" = nullif(trim(coalesce(p_first_name, '')), ''),
    "LastName" = nullif(trim(coalesce(p_last_name, '')), ''),
    "Email" = p_email,
    "Phone" = v_phone_norm,
    "LastModified" = now(),
    "LastModifiedBy" = coalesce(v_admin_member_id::text, 'admin_update_member_contact')
  WHERE "Id" = p_member_id
    AND "IsDeleted" = false;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Member not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Updated');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_member_contact(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_member_contact(uuid, text, text, text, text) TO authenticated;
