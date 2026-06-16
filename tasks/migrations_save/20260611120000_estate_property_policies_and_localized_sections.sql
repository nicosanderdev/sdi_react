-- Estate property policies + localized content sections on propertydetailssection.
-- Manual apply by project owner (idempotent where possible).
-- Prerequisite: 20260430131000_property_section_rpcs.sql, 20260610120000 (amenity localized helpers).

begin;

-- ---------------------------------------------------------------------------
-- 1) Shared localized JSON helpers (generalize amenity pattern)
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_localized_text_json(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(coalesce(p, '{}'::jsonb)) = 'object'
    and coalesce(p, '{}'::jsonb) - 'en' - 'es' - 'pt' = '{}'::jsonb;
$$;

create or replace function public.sanitize_localized_text_json(p_text jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_object_agg(k, v)
      from (
        select key as k, trim(both from value #>> '{}') as v
        from jsonb_each(coalesce(p_text, '{}'::jsonb))
        where key in ('en', 'es', 'pt')
          and jsonb_typeof(value) = 'string'
          and nullif(trim(both from value #>> '{}'), '') is not null
      ) s
      where v is not null
    ),
    '{}'::jsonb
  );
$$;

comment on function public.sanitize_localized_text_json(jsonb) is
  'Strips empty/invalid keys from en/es/pt localized text objects.';

-- Keep amenity sanitizer as alias for backward compatibility
create or replace function public.sanitize_amenity_localized_descriptions(p_descriptions jsonb)
returns jsonb
language sql
immutable
as $$
  select public.sanitize_localized_text_json(p_descriptions);
$$;

-- ---------------------------------------------------------------------------
-- 2) EstatePropertyPolicy table
-- ---------------------------------------------------------------------------
create table if not exists public."EstatePropertyPolicy" (
  "Id" uuid primary key default gen_random_uuid(),
  "EstatePropertyId" uuid not null references public."EstateProperties" ("Id") on delete cascade,
  "ListingType" public."ListingType" not null,
  "LocalizedTitle" jsonb not null default '{}'::jsonb,
  "LocalizedDescription" jsonb not null default '{}'::jsonb,
  "DisplayOrder" integer not null default 0,
  "IsDeleted" boolean not null default false,
  "Created" timestamp with time zone not null default now(),
  "LastModified" timestamp with time zone not null default now(),
  constraint estate_property_policy_localized_title_check
    check (public.is_valid_localized_text_json("LocalizedTitle")),
  constraint estate_property_policy_localized_description_check
    check (public.is_valid_localized_text_json("LocalizedDescription"))
);

create index if not exists estate_property_policy_property_listing_idx
  on public."EstatePropertyPolicy" ("EstatePropertyId", "ListingType")
  where "IsDeleted" = false;

comment on table public."EstatePropertyPolicy" is
  'Stationary policies per estate property, scoped by guest-site ListingType (not linked to Listings rows).';

-- ---------------------------------------------------------------------------
-- 3) propertydetailssection — localized columns + PropertyType
-- ---------------------------------------------------------------------------
alter table public.propertydetailssection
  add column if not exists localizedname jsonb not null default '{}'::jsonb;

alter table public.propertydetailssection
  add column if not exists localizeddescription jsonb not null default '{}'::jsonb;

alter table public.propertydetailssection
  add column if not exists propertytype public."PropertyType";

alter table public.propertydetailssection
  drop constraint if exists propertydetailssection_localizedname_check;

alter table public.propertydetailssection
  add constraint propertydetailssection_localizedname_check
  check (public.is_valid_localized_text_json(localizedname));

alter table public.propertydetailssection
  drop constraint if exists propertydetailssection_localizeddescription_check;

alter table public.propertydetailssection
  add constraint propertydetailssection_localizeddescription_check
  check (public.is_valid_localized_text_json(localizeddescription));

-- Backfill from legacy plain columns
update public.propertydetailssection pds
set
  localizedname = case
    when nullif(btrim(coalesce(pds.name, '')), '') is not null
      and (pds.localizedname is null or pds.localizedname = '{}'::jsonb)
    then jsonb_build_object('es', btrim(pds.name))
    else coalesce(pds.localizedname, '{}'::jsonb)
  end,
  localizeddescription = case
    when nullif(btrim(coalesce(pds.description, '')), '') is not null
      and (pds.localizeddescription is null or pds.localizeddescription = '{}'::jsonb)
    then jsonb_build_object('es', btrim(pds.description))
    else coalesce(pds.localizeddescription, '{}'::jsonb)
  end
where pds.isdeleted = false;

-- ---------------------------------------------------------------------------
-- 4) JSON builders for public detail RPCs
-- ---------------------------------------------------------------------------
create or replace function public.build_property_policies_json(
  p_estate_property_id uuid,
  p_listing_type public."ListingType"
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', epp."Id",
        'listingType', epp."ListingType",
        'title', public.sanitize_localized_text_json(epp."LocalizedTitle"),
        'description', public.sanitize_localized_text_json(epp."LocalizedDescription"),
        'displayOrder', epp."DisplayOrder"
      )
      order by epp."DisplayOrder", epp."Created"
    ),
    '[]'::jsonb
  )
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_estate_property_id
    and epp."ListingType" = p_listing_type
    and epp."IsDeleted" = false
    and (
      public.sanitize_localized_text_json(epp."LocalizedTitle") <> '{}'::jsonb
      or public.sanitize_localized_text_json(epp."LocalizedDescription") <> '{}'::jsonb
    );
$$;

create or replace function public.build_property_content_sections_json(
  p_estate_property_id uuid,
  p_property_type public."PropertyType"
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'propertyType', s.propertytype,
        'localizedName', public.sanitize_localized_text_json(s.localizedname),
        'localizedDescription', public.sanitize_localized_text_json(s.localizeddescription),
        'layoutType', s.layouttype,
        'layoutConfig', coalesce(s.layoutconfig, '{}'::jsonb),
        'displayOrder', s.displayorder,
        'images', coalesce(img.images, '[]'::jsonb)
      )
      order by s.displayorder, s.createdat
    ),
    '[]'::jsonb
  )
  from public.propertydetailssection s
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'propertyImageId', psi.propertyimageid,
          'url', pi."Url",
          'altText', pi."AltText",
          'displayOrder', psi.displayorder
        )
        order by psi.displayorder
      ),
      '[]'::jsonb
    ) as images
    from public.propertysectionimages psi
    join public."PropertyImages" pi
      on pi."Id" = psi.propertyimageid
     and pi."IsDeleted" = false
    where psi.sectionid = s.id
  ) img on true
  where s.propertyid = p_estate_property_id
    and s.isdeleted = false
    and (s.propertytype is null or s.propertytype = p_property_type)
    and public.sanitize_localized_text_json(s.localizedname) <> '{}'::jsonb;
$$;

comment on function public.build_property_policies_json(uuid, public."ListingType") is
  'Policies array for public property detail RPCs, filtered by ListingType.';

comment on function public.build_property_content_sections_json(uuid, public."PropertyType") is
  'Content sections array for public property detail RPCs, filtered by PropertyType.';

-- ---------------------------------------------------------------------------
-- 5) replace_estate_property_policies
-- ---------------------------------------------------------------------------
create or replace function public.replace_estate_property_policies(
  p_property_id uuid,
  p_policies jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy jsonb;
  v_listing_type public."ListingType";
  v_title jsonb;
  v_description jsonb;
  v_order integer := 0;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  update public."EstatePropertyPolicy"
  set "IsDeleted" = true, "LastModified" = now()
  where "EstatePropertyId" = p_property_id
    and "IsDeleted" = false;

  if p_policies is null
     or jsonb_typeof(p_policies) <> 'array'
     or jsonb_array_length(p_policies) = 0 then
    return;
  end if;

  for v_policy in select * from jsonb_array_elements(p_policies)
  loop
    v_listing_type := nullif(trim(both from coalesce(v_policy->>'listingType', v_policy->>'listing_type', '')), '')::public."ListingType";
    if v_listing_type is null then
      continue;
    end if;

    v_title := public.sanitize_localized_text_json(coalesce(v_policy->'title', v_policy->'localizedTitle', '{}'::jsonb));
    v_description := public.sanitize_localized_text_json(coalesce(v_policy->'description', v_policy->'localizedDescription', '{}'::jsonb));

    if v_title = '{}'::jsonb and v_description = '{}'::jsonb then
      continue;
    end if;

    insert into public."EstatePropertyPolicy" (
      "EstatePropertyId",
      "ListingType",
      "LocalizedTitle",
      "LocalizedDescription",
      "DisplayOrder",
      "IsDeleted",
      "Created",
      "LastModified"
    ) values (
      p_property_id,
      v_listing_type,
      v_title,
      v_description,
      coalesce((v_policy->>'displayOrder')::integer, v_order),
      false,
      now(),
      now()
    );

    v_order := v_order + 1;
  end loop;
end;
$$;

grant execute on function public.replace_estate_property_policies(uuid, jsonb) to authenticated;
grant execute on function public.replace_estate_property_policies(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 6) replace_estate_property_content_sections
-- ---------------------------------------------------------------------------
create or replace function public.replace_estate_property_content_sections(
  p_property_id uuid,
  p_sections jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section jsonb;
  v_section_id uuid;
  v_property_type public."PropertyType";
  v_layout_type text;
  v_layout_config jsonb;
  v_name jsonb;
  v_description jsonb;
  v_order integer := 0;
  v_image_id uuid;
  v_image_elem jsonb;
  v_image_order integer;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  update public.propertydetailssection
  set isdeleted = true, updatedat = now()
  where propertyid = p_property_id
    and isdeleted = false;

  if p_sections is null
     or jsonb_typeof(p_sections) <> 'array'
     or jsonb_array_length(p_sections) = 0 then
    return;
  end if;

  for v_section in select * from jsonb_array_elements(p_sections)
  loop
    v_name := public.sanitize_localized_text_json(coalesce(v_section->'localizedName', v_section->'localized_name', '{}'::jsonb));
    if v_name = '{}'::jsonb then
      continue;
    end if;

    v_description := public.sanitize_localized_text_json(coalesce(v_section->'localizedDescription', v_section->'localized_description', '{}'::jsonb));
    v_property_type := nullif(trim(both from coalesce(v_section->>'propertyType', v_section->>'property_type', '')), '')::public."PropertyType";
    v_layout_type := lower(coalesce(nullif(trim(v_section->>'layoutType'), ''), nullif(trim(v_section->>'layout_type'), ''), 'split'));
    if v_layout_type not in ('split', 'carousel', 'stacked') then
      v_layout_type := 'split';
    end if;

    v_layout_config := coalesce(v_section->'layoutConfig', v_section->'layout_config', '{}'::jsonb);
    if v_section->>'displayVariant' is not null or v_section->>'display_variant' is not null then
      v_layout_config := v_layout_config || jsonb_build_object(
        'displayVariant',
        coalesce(v_section->>'displayVariant', v_section->>'display_variant', 'default')
      );
    end if;

    v_section_id := gen_random_uuid();
    v_order := coalesce((v_section->>'displayOrder')::integer, v_order);

    insert into public.propertydetailssection (
      id,
      propertyid,
      name,
      description,
      localizedname,
      localizeddescription,
      propertytype,
      layouttype,
      layoutconfig,
      displayorder,
      isdeleted,
      createdat,
      updatedat
    ) values (
      v_section_id,
      p_property_id,
      coalesce(v_name->>'es', v_name->>'en', v_name->>'pt', ''),
      coalesce(v_description->>'es', v_description->>'en', v_description->>'pt', ''),
      v_name,
      v_description,
      v_property_type,
      v_layout_type,
      v_layout_config,
      v_order,
      false,
      now(),
      now()
    );

    v_image_order := 0;
    if jsonb_typeof(v_section->'propertyImageIds') = 'array' then
      for v_image_id in
        select nullif(trim(both from value), '')::uuid
        from jsonb_array_elements_text(v_section->'propertyImageIds') as t(value)
        where nullif(trim(both from value), '') is not null
      loop
        insert into public.propertysectionimages (
          id, sectionid, propertyimageid, displayorder, createdat, updatedat
        ) values (
          gen_random_uuid(), v_section_id, v_image_id, v_image_order, now(), now()
        );
        v_image_order := v_image_order + 1;
      end loop;
    elsif jsonb_typeof(v_section->'images') = 'array' then
      for v_image_elem in select * from jsonb_array_elements(v_section->'images')
      loop
        v_image_id := nullif(trim(both from coalesce(v_image_elem->>'propertyImageId', v_image_elem->>'property_image_id', '')), '')::uuid;
        if v_image_id is not null then
          insert into public.propertysectionimages (
            id, sectionid, propertyimageid, displayorder, createdat, updatedat
          ) values (
            gen_random_uuid(),
            v_section_id,
            v_image_id,
            coalesce((v_image_elem->>'displayOrder')::integer, v_image_order),
            now(),
            now()
          );
          v_image_order := v_image_order + 1;
        end if;
      end loop;
    end if;

    v_order := v_order + 1;
  end loop;
end;
$$;

grant execute on function public.replace_estate_property_content_sections(uuid, jsonb) to authenticated;
grant execute on function public.replace_estate_property_content_sections(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 7) Editor load RPC (dashboard create/edit)
-- ---------------------------------------------------------------------------
create or replace function public.get_estate_property_editor_content(p_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_policies jsonb;
  v_sections jsonb;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', epp."Id",
        'listingType', epp."ListingType",
        'title', public.sanitize_localized_text_json(epp."LocalizedTitle"),
        'description', public.sanitize_localized_text_json(epp."LocalizedDescription"),
        'displayOrder', epp."DisplayOrder"
      )
      order by epp."DisplayOrder", epp."Created"
    ),
    '[]'::jsonb
  )
  into v_policies
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_property_id
    and epp."IsDeleted" = false;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'propertyType', s.propertytype,
        'localizedName', public.sanitize_localized_text_json(s.localizedname),
        'localizedDescription', public.sanitize_localized_text_json(s.localizeddescription),
        'layoutType', s.layouttype,
        'layoutConfig', coalesce(s.layoutconfig, '{}'::jsonb),
        'displayOrder', s.displayorder,
        'propertyImageIds', coalesce(
          (
            select jsonb_agg(psi.propertyimageid order by psi.displayorder)
            from public.propertysectionimages psi
            where psi.sectionid = s.id
          ),
          '[]'::jsonb
        )
      )
      order by s.displayorder, s.createdat
    ),
    '[]'::jsonb
  )
  into v_sections
  from public.propertydetailssection s
  where s.propertyid = p_property_id
    and s.isdeleted = false;

  return jsonb_build_object(
    'policies', v_policies,
    'contentSections', v_sections
  );
end;
$$;

grant execute on function public.get_estate_property_editor_content(uuid) to authenticated;
grant execute on function public.get_estate_property_editor_content(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 8) Update insert_property_details_section for localized fields
-- ---------------------------------------------------------------------------
create or replace function public.insert_property_details_section(
  p_property_id uuid,
  p_name text,
  p_description text default null,
  p_property_type text default null,
  p_layout_type text default 'split',
  p_layout_config jsonb default null,
  p_display_order integer default 0,
  p_localized_name jsonb default null,
  p_localized_description jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section_id uuid := gen_random_uuid();
  v_layout_type text := lower(coalesce(nullif(trim(p_layout_type), ''), 'split'));
  v_name jsonb;
  v_description jsonb;
  v_property_type public."PropertyType";
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  v_name := public.sanitize_localized_text_json(coalesce(
    p_localized_name,
    case when nullif(btrim(coalesce(p_name, '')), '') is not null
      then jsonb_build_object('es', btrim(p_name))
      else '{}'::jsonb
    end
  ));

  if v_name = '{}'::jsonb then
    raise exception 'Section name (localized) is required';
  end if;

  v_description := public.sanitize_localized_text_json(coalesce(
    p_localized_description,
    case when nullif(btrim(coalesce(p_description, '')), '') is not null
      then jsonb_build_object('es', btrim(p_description))
      else '{}'::jsonb
    end
  ));

  if v_layout_type not in ('split', 'carousel', 'stacked') then
    raise exception 'Invalid layout type: %', p_layout_type;
  end if;

  v_property_type := nullif(btrim(coalesce(p_property_type, '')), '')::public."PropertyType";

  insert into public.propertydetailssection (
    id, propertyid, name, description, localizedname, localizeddescription,
    propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat
  ) values (
    v_section_id,
    p_property_id,
    coalesce(v_name->>'es', v_name->>'en', v_name->>'pt', ''),
    coalesce(v_description->>'es', v_description->>'en', v_description->>'pt', ''),
    v_name,
    v_description,
    v_property_type,
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

commit;
