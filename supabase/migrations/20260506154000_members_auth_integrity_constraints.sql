-- PROPOSAL ONLY: Members/Auth integrity hardening
-- Review in staging before applying.

begin;

-- 1) Ensure each member maps to exactly one auth user and vice versa.
alter table public."Members"
  alter column "UserId" set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_userid_fkey_auth_users'
  ) then
    alter table public."Members"
      add constraint members_userid_fkey_auth_users
      foreign key ("UserId")
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists members_userid_unique_idx
  on public."Members" ("UserId");

-- 2) Optional uniqueness for active emails/phones to reduce duplicate directory records.
-- Keep partial (`IsDeleted = false`) to preserve historical soft-deleted rows.
create unique index if not exists members_email_active_unique_idx
  on public."Members" (lower(coalesce("Email", '')))
  where "IsDeleted" = false and "Email" is not null and length(trim("Email")) > 0;

create unique index if not exists members_phone_active_unique_idx
  on public."Members" ("Phone")
  where "IsDeleted" = false and "Phone" is not null and length(trim("Phone")) > 0;

-- 3) Trigger contract: ensure auth.users creation produces a member row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."Members" (
    "Id",
    "UserId",
    "Email",
    "FirstName",
    "LastName",
    "Role",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  values (
    gen_random_uuid(),
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'firstName', ''),
    nullif(new.raw_user_meta_data ->> 'lastName', ''),
    'user',
    false,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict ("UserId") do update
  set
    "Email" = excluded."Email",
    "FirstName" = coalesce(excluded."FirstName", public."Members"."FirstName"),
    "LastName" = coalesce(excluded."LastName", public."Members"."LastName"),
    "LastModified" = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

commit;
