-- When a row is inserted into auth.users (dashboard, Admin API, sign-up, etc.),
-- create the matching public."Members" row with "UserId" = auth user id.
-- This is server-side only; no app or Cursor hook runs for dashboard inserts.

create unique index if not exists members_userid_unique_idx
  on public."Members" ("UserId");

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
