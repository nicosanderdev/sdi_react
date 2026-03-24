-- Fix: json_agg + ORDER BY mah."PerformedAt" at same level caused
-- "column mah.PerformedAt must appear in the GROUP BY" when opening admin user detail.
-- Use inner LIMIT 10 + outer json_agg(... ORDER BY ...).
--
-- Fix: explicit ::text on status fields (same as get_admin_users_list) — PostgreSQL
-- RETURN QUERY requires exact match to RETURNS TABLE; CASE/COALESCE on varchar yields
-- character varying, not text. action_history cast to json for json_agg/jsonb consistency.

CREATE OR REPLACE FUNCTION public.get_admin_user_detail(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  first_name character varying,
  last_name character varying,
  email character varying,
  avatar_url character varying,
  phone character varying,
  street character varying,
  street2 character varying,
  city character varying,
  state character varying,
  postal_code character varying,
  country character varying,
  roles text[],
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamp with time zone,
  account_status text,
  registration_date timestamp with time zone,
  last_login timestamp with time zone,
  properties_count bigint,
  payment_status text,
  onboarding_step integer,
  onboarding_complete boolean,
  action_history json
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m."Id" AS id,
    m."UserId" AS user_id,
    m."FirstName" AS first_name,
    m."LastName" AS last_name,
    m."Email" AS email,
    m."AvatarUrl" AS avatar_url,
    m."Phone" AS phone,
    m."Street" AS street,
    m."Street2" AS street2,
    m."City" AS city,
    m."State" AS state,
    m."PostalCode" AS postal_code,
    m."Country" AS country,
    ARRAY[m."Role"::text] AS roles,
    (CASE
      WHEN ms."isActive" = true AND (ms."ExpiresAtUtc" IS NULL OR ms."ExpiresAtUtc" > now()) THEN 'active'
      WHEN ms."isActive" = true AND ms."ExpiresAtUtc" <= now() THEN 'expired'
      ELSE 'none'
    END)::text AS subscription_status,
    ms."SubscriptionTier" AS subscription_tier,
    ms."ExpiresAtUtc" AS subscription_expires_at,
    (COALESCE(ms_current."Status", 'active'))::text AS account_status,
    m."Created" AS registration_date,
    NULL::timestamp with time zone AS last_login,
    COALESCE(prop_count.count, 0)::bigint AS properties_count,
    (CASE
      WHEN bh_latest."SubscriptionId" IS NOT NULL THEN
        CASE bh_latest."Status"
          WHEN 0 THEN 'pending'
          WHEN 1 THEN 'paid'
          WHEN 2 THEN 'failed'
          WHEN 3 THEN 'refunded'
          ELSE 'unknown'
        END
      ELSE 'none'
    END)::text AS payment_status,
    COALESCE(mo."OnboardingStep", 0) AS onboarding_step,
    COALESCE(mo."IsComplete", false) AS onboarding_complete,
    (COALESCE(action_history.history, '[]'::json))::json AS action_history
  FROM "Members" m
  LEFT JOIN "MemberSubscriptions" ms ON ms."MemberId" = m."Id" AND ms."IsDeleted" = false
  LEFT JOIN "MemberStatus" ms_current ON ms_current."MemberId" = m."Id"
    AND ms_current."Id" = (
      SELECT ms_inner."Id"
      FROM "MemberStatus" ms_inner
      WHERE ms_inner."MemberId" = m."Id" AND ms_inner."IsDeleted" = false
      ORDER BY ms_inner."ChangedAt" DESC
      LIMIT 1
    )
  LEFT JOIN (
    SELECT "OwnerId", COUNT(*) AS count
    FROM "EstateProperties"
    WHERE "IsDeleted" = false
    GROUP BY "OwnerId"
  ) prop_count ON prop_count."OwnerId" = m."Id"
  LEFT JOIN LATERAL (
    SELECT bh.*
    FROM "BillingHistories" bh
    WHERE bh."SubscriptionId" = ms."Id" AND bh."IsDeleted" = false
    ORDER BY bh."Created" DESC
    LIMIT 1
  ) bh_latest ON true
  LEFT JOIN "MemberOnboarding" mo ON mo."MemberId" = m."Id" AND mo."IsDeleted" = false
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', h."Id",
            'actionType', h."ActionType",
            'actionDetails', h."ActionDetails",
            'performedAt', h."PerformedAt",
            'performedBy', json_build_object(
              'id', h.admin_member_id,
              'name', COALESCE(h.admin_first_name, '') || ' ' || COALESCE(h.admin_last_name, ''),
              'email', h.admin_email
            )
          )
          ORDER BY h."PerformedAt" DESC
        )
        FROM (
          SELECT
            mah."Id",
            mah."ActionType",
            mah."ActionDetails",
            mah."PerformedAt",
            admin_m."Id" AS admin_member_id,
            admin_m."FirstName" AS admin_first_name,
            admin_m."LastName" AS admin_last_name,
            admin_au.email AS admin_email
          FROM "MemberActionHistory" mah
          LEFT JOIN "Members" admin_m ON admin_m."Id" = mah."PerformedBy"
          LEFT JOIN auth.users admin_au ON admin_au.id = admin_m."UserId"
          WHERE mah."MemberId" = m."Id" AND mah."IsDeleted" = false
          ORDER BY mah."PerformedAt" DESC
          LIMIT 10
        ) h
      ),
      '[]'::json
    ) AS history
  ) action_history ON true
  WHERE m."Id" = p_user_id AND m."IsDeleted" = false;
END;
$$;
