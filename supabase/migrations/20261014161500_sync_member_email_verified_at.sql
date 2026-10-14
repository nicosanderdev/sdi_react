-- Profile "email verified" reads Members.EmailVerifiedAt.
-- Auth confirmation only set auth.users.email_confirmed_at, so the profile
-- stayed pending after the confirmation link. Copy that timestamp onto the
-- member when Auth confirms, without overwriting a date already stored and
-- without touching phone verification.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_plan_id uuid;
  v_phone text;
  v_phone_prefix text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_space_pos int;
  v_provider text;
  v_is_oauth boolean;
  v_email_verified_at timestamptz;
  v_now timestamptz := timezone('utc', now());
  v_created_by_admin boolean;
  v_display text;
BEGIN
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_phone_prefix := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phonePrefix', '')), '');

  v_first_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'firstName', '')), '');
  v_last_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'lastName', '')), '');

  IF v_first_name IS NULL AND v_last_name IS NULL THEN
    v_full_name := nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    );

    IF v_full_name IS NOT NULL THEN
      v_space_pos := position(' ' IN v_full_name);
      IF v_space_pos > 0 THEN
        v_first_name := nullif(trim(substring(v_full_name FROM 1 FOR v_space_pos - 1)), '');
        v_last_name := nullif(trim(substring(v_full_name FROM v_space_pos + 1)), '');
      ELSE
        v_first_name := v_full_name;
        v_last_name := NULL;
      END IF;
    END IF;
  END IF;

  v_provider := lower(coalesce(new.raw_app_meta_data ->> 'provider', ''));
  v_is_oauth := v_provider NOT IN ('', 'email');
  IF NOT v_is_oauth
     AND jsonb_typeof(new.raw_app_meta_data -> 'providers') = 'array' THEN
    v_is_oauth := EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(new.raw_app_meta_data -> 'providers') AS p(value)
      WHERE p.value IS DISTINCT FROM 'email'
    );
  END IF;
  IF new.email_confirmed_at IS NOT NULL THEN
    v_email_verified_at := new.email_confirmed_at;
  ELSIF v_is_oauth AND new.email IS NOT NULL THEN
    v_email_verified_at := v_now;
  ELSE
    v_email_verified_at := NULL;
  END IF;

  v_created_by_admin := coalesce((new.raw_user_meta_data ->> 'created_by_admin')::boolean, false);

  INSERT INTO public."Members" (
    "Id",
    "UserId",
    "Email",
    "FirstName",
    "LastName",
    "Phone",
    "PhonePrefix",
    "EmailVerifiedAt",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  VALUES (
    gen_random_uuid(),
    new.id,
    new.email,
    v_first_name,
    v_last_name,
    v_phone,
    v_phone_prefix,
    v_email_verified_at,
    'user',
    false,
    v_now,
    v_now
  )
  ON CONFLICT ("UserId") DO UPDATE
  SET
    "Email" = excluded."Email",
    "FirstName" = coalesce(excluded."FirstName", public."Members"."FirstName"),
    "LastName" = coalesce(excluded."LastName", public."Members"."LastName"),
    "Phone" = coalesce(excluded."Phone", public."Members"."Phone"),
    "PhonePrefix" = coalesce(excluded."PhonePrefix", public."Members"."PhonePrefix"),
    "EmailVerifiedAt" = coalesce(public."Members"."EmailVerifiedAt", excluded."EmailVerifiedAt"),
    "LastModified" = v_now
  RETURNING "Id" INTO v_member_id;

  SELECT p."Id"
  INTO v_plan_id
  FROM public."Plans" p
  WHERE p."Id" = '77777777-7777-4777-8777-777777777777'::uuid
    AND p."IsDeleted" = false
    AND coalesce(p."IsActiveV2", p."IsActive", true) = true;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Default signup plan "Standard" not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."BillingPlanAssignments" bpa
    WHERE bpa."SubjectType" = 'member'
      AND bpa."MemberOrCompanyId" = v_member_id
      AND bpa."IsActive" = true
  ) THEN
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
      v_now,
      true,
      v_now,
      v_now
    );
  END IF;

  IF NOT v_created_by_admin THEN
    v_display := trim(coalesce(v_first_name, '') || ' ' || coalesce(v_last_name, ''));
    v_display := nullif(v_display, '');
    v_display := coalesce(v_display, '') || coalesce(' <' || nullif(trim(new.email), '') || '>', '');
    v_display := nullif(trim(v_display), '');

    PERFORM public.log_admin_activity(
      'user',
      'user_registration',
      v_member_id,
      coalesce(v_display, coalesce(new.email, v_member_id::text)),
      v_member_id,
      NULL,
      jsonb_build_object('authUserId', new.id, 'oauth', v_is_oauth)
    );
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_member_email_verified_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public."Members" m
    SET "EmailVerifiedAt" = NEW.email_confirmed_at
    WHERE m."UserId" = NEW.id
      AND m."IsDeleted" = false
      AND m."EmailVerifiedAt" IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_member_email_verified_from_auth();

UPDATE public."Members" m
SET "EmailVerifiedAt" = u.email_confirmed_at
FROM auth.users u
WHERE m."UserId" = u.id
  AND m."IsDeleted" = false
  AND m."EmailVerifiedAt" IS NULL
  AND u.email_confirmed_at IS NOT NULL;
