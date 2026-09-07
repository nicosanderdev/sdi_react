-- Transactional company create (company + first Admin) and tighten SELECT
-- so authenticated users cannot read every company / membership row.

CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."CompanyMembers" cm
    JOIN public."Members" m
      ON m."Id" = cm."MemberId"
     AND m."IsDeleted" = false
    WHERE cm."CompanyId" = _company_id
      AND cm."IsDeleted" = false
      AND m."UserId" = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_company_member(uuid) IS
  'True when the current auth user is an active member of the company (any company role).';

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_company_for_current_member(
  p_name text,
  p_billing_email text,
  p_description text DEFAULT ''
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

  RETURN to_jsonb(v_company);
END;
$$;

COMMENT ON FUNCTION public.create_company_for_current_member(text, text, text) IS
  'Creates a company and the caller as first Admin in one transaction. Platform user members must have verified email and phone.';

REVOKE ALL ON FUNCTION public.create_company_for_current_member(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_for_current_member(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_for_current_member(text, text, text) TO service_role;

-- Membership list: same-company members (or platform admin), not every row.
DROP POLICY IF EXISTS "CompanyMembers_authenticated_select_all" ON public."CompanyMembers";
DROP POLICY IF EXISTS company_members_select_policy ON public."CompanyMembers";

CREATE POLICY company_members_select_policy
  ON public."CompanyMembers"
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_company_member("CompanyId")
  );

-- Company rows: members of that company or platform admin, not every company.
DROP POLICY IF EXISTS "Companies_authenticated_select_all" ON public."Companies";

CREATE OR REPLACE FUNCTION public.add_company_member_by_email(
  p_company_id uuid,
  p_email text,
  p_role text DEFAULT 'Member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := public.current_member_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := trim(coalesce(p_role, 'Member'));
  v_target public."Members"%ROWTYPE;
  v_row public."CompanyMembers"%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required.';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'Por favor, ingresa un correo electrónico';
  END IF;

  IF v_role NOT IN ('Admin', 'Manager', 'Member') THEN
    RAISE EXCEPTION 'Rol de compañía inválido.';
  END IF;

  IF NOT public.is_admin() AND NOT public.is_company_admin(p_company_id) THEN
    RAISE EXCEPTION 'Only company Admins can manage company members.';
  END IF;

  SELECT *
    INTO v_target
  FROM public."Members" m
  WHERE lower(trim(coalesce(m."Email", ''))) = v_email
    AND m."IsDeleted" = false
  LIMIT 1;

  IF v_target."Id" IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario registrado con ese correo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."CompanyMembers" cm
    WHERE cm."CompanyId" = p_company_id
      AND cm."MemberId" = v_target."Id"
      AND cm."IsDeleted" = false
  ) THEN
    RAISE EXCEPTION 'User is already linked to this company';
  END IF;

  INSERT INTO public."CompanyMembers" (
    "MemberId",
    "CompanyId",
    "Role",
    "AddedBy",
    "JoinedAt",
    "IsDeleted"
  ) VALUES (
    v_target."Id",
    p_company_id,
    v_role,
    coalesce(v_actor_id, v_target."Id"),
    timezone('utc', now()),
    false
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'Id', v_row."Id",
    'MemberId', v_row."MemberId",
    'CompanyId', v_row."CompanyId",
    'Role', v_row."Role",
    'AddedBy', v_row."AddedBy",
    'JoinedAt', v_row."JoinedAt",
    'IsDeleted', v_row."IsDeleted",
    'Members', jsonb_build_object(
      'Id', v_target."Id",
      'FirstName', v_target."FirstName",
      'LastName', v_target."LastName",
      'Email', v_target."Email",
      'AvatarUrl', v_target."AvatarUrl"
    )
  );
END;
$$;

COMMENT ON FUNCTION public.add_company_member_by_email(uuid, text, text) IS
  'Adds an existing member to a company by email. Company Admin or platform admin only.';

REVOKE ALL ON FUNCTION public.add_company_member_by_email(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_company_member_by_email(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_company_member_by_email(uuid, text, text) TO service_role;
