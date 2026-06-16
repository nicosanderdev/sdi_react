-- get_admin_user_detail: RETURN QUERY requires column types to match RETURNS TABLE
-- exactly (varchar vs text, int vs text for Role, etc.). Mirror casts used in
-- get_admin_users_list (e.g. rrole::text, fn::text).

begin;

drop function if exists public.get_admin_user_detail(uuid);

create or replace function public.get_admin_user_detail(p_user_id uuid)
returns table (
  id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  phone text,
  street text,
  street2 text,
  city text,
  state text,
  postal_code text,
  country text,
  role text,
  subscription_status text,
  subscription_tier integer,
  subscription_expires_at timestamptz,
  account_status text,
  registration_date timestamptz,
  last_login timestamptz,
  properties_count bigint,
  payment_status text,
  onboarding_step integer,
  onboarding_complete boolean,
  action_history jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();

  return query
  select
    m."Id",
    m."UserId",
    m."FirstName"::text,
    m."LastName"::text,
    m."Email"::text,
    m."AvatarUrl"::text,
    m."Phone"::text,
    m."Street"::text,
    m."Street2"::text,
    m."City"::text,
    m."State"::text,
    m."PostalCode"::text,
    m."Country"::text,
    m."Role"::text,
    'none'::text as subscription_status,
    null::integer as subscription_tier,
    null::timestamptz as subscription_expires_at,
    (
      case
        when m."IsDeleted" then 'deleted'
        when u.banned_until is not null and u.banned_until > timezone('utc', now()) then 'suspended'
        else 'active'
      end
    )::text as account_status,
    m."Created"::timestamptz as registration_date,
    u.last_sign_in_at::timestamptz as last_login,
    0::bigint as properties_count,
    'none'::text as payment_status,
    coalesce(m."OnboardingStep", 0)::integer as onboarding_step,
    coalesce(m."OnboardingComplete", false) as onboarding_complete,
    '[]'::jsonb as action_history
  from public."Members" m
  join auth.users u on u.id = m."UserId"
  where m."Id" = p_user_id
  limit 1;
end;
$$;

commit;
