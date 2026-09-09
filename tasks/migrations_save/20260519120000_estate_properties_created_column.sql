-- EstateProperties.Created: required by PostgREST filters in admin metrics (HEAD count with Created range)
-- and by get_admin_dashboard_stats (20260429124600). Backfill from earliest non-deleted listing per property.

begin;

alter table public."EstateProperties"
  add column if not exists "Created" timestamptz;

update public."EstateProperties" ep
set "Created" = x.first_created
from (
  select l."EstatePropertyId", min(l."Created") as first_created
  from public."Listings" l
  where l."IsDeleted" = false
  group by l."EstatePropertyId"
) x
where ep."Id" = x."EstatePropertyId"
  and ep."Created" is null;

update public."EstateProperties"
set "Created" = timezone('utc', now())
where "Created" is null;

alter table public."EstateProperties"
  alter column "Created" set default timezone('utc', now());

alter table public."EstateProperties"
  alter column "Created" set not null;

commit;
