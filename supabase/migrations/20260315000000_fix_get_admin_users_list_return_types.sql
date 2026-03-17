-- Fix: "structure of query does not match function result type"
-- PostgreSQL requires exact type match for RETURNS TABLE. Declared types are text for
-- subscription_status, account_status, payment_status but the query returned character varying.
-- Explicit ::text casts ensure the returned type matches the function result type.

CREATE OR REPLACE FUNCTION public.get_admin_users_list(
    p_page integer DEFAULT 1,
    p_limit integer DEFAULT 20,
    p_subscription_status text DEFAULT NULL::text,
    p_subscription_tier integer DEFAULT NULL::integer,
    p_account_status text DEFAULT NULL::text,
    p_registration_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_registration_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_search text DEFAULT NULL::text
)
RETURNS TABLE(
    id uuid,
    user_id uuid,
    first_name character varying,
    last_name character varying,
    email character varying,
    avatar_url character varying,
    roles text[],
    subscription_status text,
    subscription_tier integer,
    subscription_expires_at timestamp with time zone,
    account_status text,
    registration_date timestamp with time zone,
    last_login timestamp with time zone,
    properties_count bigint,
    payment_status text,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset integer;
    v_total_count bigint;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    SELECT COUNT(*) INTO v_total_count
    FROM "Members" m
    WHERE m."IsDeleted" = false
    AND (p_search IS NULL OR
         LOWER(COALESCE(m."FirstName", '') || ' ' || COALESCE(m."LastName", '')) LIKE '%' || LOWER(p_search) || '%' OR
         LOWER(m."Email") LIKE '%' || LOWER(p_search) || '%')
    AND (p_registration_date_from IS NULL OR m."Created" >= p_registration_date_from)
    AND (p_registration_date_to IS NULL OR m."Created" <= p_registration_date_to);

    RETURN QUERY
    SELECT
        m."Id" as id,
        m."UserId" as user_id,
        m."FirstName" as first_name,
        m."LastName" as last_name,
        m."Email" as email,
        m."AvatarUrl" as avatar_url,
        ARRAY[m."Role"::text] as roles,
        (CASE
            WHEN ms."isActive" = true AND (ms."ExpiresAtUtc" IS NULL OR ms."ExpiresAtUtc" > now()) THEN 'active'
            WHEN ms."isActive" = true AND ms."ExpiresAtUtc" <= now() THEN 'expired'
            ELSE 'none'
        END)::text as subscription_status,
        ms."SubscriptionTier" as subscription_tier,
        ms."ExpiresAtUtc" as subscription_expires_at,
        (COALESCE(ms_current."Status", 'active'))::text as account_status,
        m."Created" as registration_date,
        NULL::timestamp with time zone as last_login,
        COALESCE(prop_count.count, 0)::bigint as properties_count,
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
        END)::text as payment_status,
        v_total_count as total_count
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
        SELECT "OwnerId", COUNT(*) as count
        FROM "EstateProperties"
        WHERE "IsDeleted" = false
        GROUP BY "OwnerId"
    ) prop_count ON prop_count."OwnerId" = m."Id"
    LEFT JOIN LATERAL (
        SELECT bh."SubscriptionId", bh."Status"
        FROM "BillingHistories" bh
        WHERE bh."SubscriptionId" = ms."Id" AND bh."IsDeleted" = false
        ORDER BY bh."Created" DESC
        LIMIT 1
    ) bh_latest ON true
    WHERE m."IsDeleted" = false
    AND (p_search IS NULL OR
         LOWER(COALESCE(m."FirstName", '') || ' ' || COALESCE(m."LastName", '')) LIKE '%' || LOWER(p_search) || '%' OR
         LOWER(m."Email") LIKE '%' || LOWER(p_search) || '%')
    AND (p_subscription_status IS NULL OR
         (CASE
             WHEN ms."isActive" = true AND (ms."ExpiresAtUtc" IS NULL OR ms."ExpiresAtUtc" > now()) THEN 'active'
             WHEN ms."isActive" = true AND ms."ExpiresAtUtc" <= now() THEN 'expired'
             ELSE 'none'
         END) = p_subscription_status)
    AND (p_subscription_tier IS NULL OR ms."SubscriptionTier" = p_subscription_tier)
    AND (p_account_status IS NULL OR (COALESCE(ms_current."Status", 'active')) = p_account_status)
    AND (p_registration_date_from IS NULL OR m."Created" >= p_registration_date_from)
    AND (p_registration_date_to IS NULL OR m."Created" <= p_registration_date_to)
    ORDER BY m."Created" DESC
    LIMIT p_limit
    OFFSET v_offset;
END;
$$;
