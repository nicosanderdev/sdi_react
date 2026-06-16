-- PROPOSAL ONLY: Users admin RPC contract alignment
-- This file versions RPCs referenced by src/services/UserAdminService.tsx.
-- Replace placeholder logic with final business rules before apply.

begin;

create schema if not exists admin_internal;

create or replace function admin_internal.require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public."Members" m
    where m."UserId" = auth.uid()
      and m."IsDeleted" = false
      and m."Role" = 'admin'
  ) then
    raise exception 'Forbidden: admin only';
  end if;
end;
$$;

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
    m."FirstName",
    m."LastName",
    m."Email",
    m."AvatarUrl",
    m."Phone",
    m."Street",
    m."Street2",
    m."City",
    m."State",
    m."PostalCode",
    m."Country",
    m."Role",
    'none'::text as subscription_status,
    null::integer as subscription_tier,
    null::timestamptz as subscription_expires_at,
    case
      when m."IsDeleted" then 'deleted'
      when u.banned_until is not null and u.banned_until > timezone('utc', now()) then 'suspended'
      else 'active'
    end as account_status,
    m."Created" as registration_date,
    u.last_sign_in_at as last_login,
    0::bigint as properties_count,
    'none'::text as payment_status,
    coalesce(m."OnboardingStep", 0) as onboarding_step,
    coalesce(m."OnboardingComplete", false) as onboarding_complete,
    '[]'::jsonb as action_history
  from public."Members" m
  join auth.users u on u.id = m."UserId"
  where m."Id" = p_user_id
  limit 1;
end;
$$;

create or replace function public.suspend_user(p_member_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members" set "LastModified" = timezone('utc', now()) where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'User suspended');
end;
$$;

create or replace function public.reactivate_user(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members" set "LastModified" = timezone('utc', now()) where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'User reactivated');
end;
$$;

create or replace function public.reset_user_onboarding(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "OnboardingStep" = 0,
    "OnboardingComplete" = false,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'Onboarding reset');
end;
$$;

create or replace function public.update_user_role(p_member_id uuid, p_new_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "Role" = p_new_role,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'Role updated');
end;
$$;

create or replace function public.soft_delete_user(p_member_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_internal.require_admin();
  update public."Members"
  set
    "IsDeleted" = true,
    "LastModified" = timezone('utc', now())
  where "Id" = p_member_id;
  return jsonb_build_object('success', true, 'message', 'User soft-deleted');
end;
$$;

commit;
