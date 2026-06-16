-- RPCs for property detail marketing sections used by create-property wizard step 4.
-- Note: these sections are separate from extension tables (RealEstate/SummerRent/EventVenue).

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pricing_model'
      and n.nspname = 'public'
  ) then
    create type public.pricing_model as enum (
      'free',
      'per_booking',
      'per_listing',
      'hybrid'
    );
  end if;
end;
$$;

create or replace function public.insert_property_details_section(
  p_property_id uuid,
  p_name text,
  p_description text default null,
  p_property_type text default null,
  p_layout_type text default 'split',
  p_layout_config jsonb default null,
  p_display_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section_id uuid := gen_random_uuid();
  v_layout_type text := lower(coalesce(nullif(trim(p_layout_type), ''), 'split'));
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'p_name is required';
  end if;

  if v_layout_type not in ('split', 'carousel', 'stacked') then
    raise exception 'Invalid layout type: %', p_layout_type;
  end if;

  insert into public.propertydetailssection (
    id,
    propertyid,
    name,
    description,
    layouttype,
    layoutconfig,
    displayorder,
    isdeleted,
    createdat,
    updatedat
  ) values (
    v_section_id,
    p_property_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    v_layout_type,
    p_layout_config,
    greatest(coalesce(p_display_order, 0), 0),
    false,
    now(),
    now()
  );

  return v_section_id;
end;
$$;

comment on function public.insert_property_details_section(
  uuid, text, text, text, text, jsonb, integer
) is
  'Creates one marketing/details section for a property wizard submission.';

grant execute on function public.insert_property_details_section(
  uuid, text, text, text, text, jsonb, integer
) to authenticated;

grant execute on function public.insert_property_details_section(
  uuid, text, text, text, text, jsonb, integer
) to service_role;

create or replace function public.insert_property_section_image(
  p_section_id uuid,
  p_property_image_id uuid,
  p_display_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_relation_id uuid := gen_random_uuid();
begin
  if p_section_id is null then
    raise exception 'p_section_id is required';
  end if;

  if p_property_image_id is null then
    raise exception 'p_property_image_id is required';
  end if;

  insert into public.propertysectionimages (
    id,
    sectionid,
    propertyimageid,
    displayorder,
    createdat,
    updatedat
  ) values (
    v_relation_id,
    p_section_id,
    p_property_image_id,
    greatest(coalesce(p_display_order, 0), 0),
    now(),
    now()
  );

  return v_relation_id;
end;
$$;

comment on function public.insert_property_section_image(
  uuid, uuid, integer
) is
  'Links a property image to a property details section with display order.';

grant execute on function public.insert_property_section_image(
  uuid, uuid, integer
) to authenticated;

grant execute on function public.insert_property_section_image(
  uuid, uuid, integer
) to service_role;

commit;
