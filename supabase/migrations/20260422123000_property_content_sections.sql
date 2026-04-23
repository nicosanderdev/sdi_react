-- Property content sections abstraction for detail pages.
-- File-only artifact: apply manually in Supabase.
-- NOTE: PropertyImages already exists in DB; do not recreate it.

alter table if exists public."PropertyImages"
  add column if not exists "Metadata" jsonb null;

alter table if exists public."PropertyImages"
  add column if not exists "DisplayOrder" integer not null default 0;

create table if not exists public.PropertyDetailsSection (
  Id uuid primary key default gen_random_uuid(),
  PropertyId uuid not null references public."EstateProperties"("Id") on delete cascade,
  Name text not null,
  Description text null,
  PropertyType text not null check (PropertyType in ('SummerRent', 'EventVenue', 'RealEstate')),
  LayoutType text not null default 'split' check (LayoutType in ('split', 'carousel', 'stacked')),
  LayoutConfig jsonb null,
  DisplayOrder integer not null default 0,
  IsDeleted boolean not null default false,
  CreatedAt timestamptz not null default now(),
  UpdatedAt timestamptz not null default now()
);

alter table if exists public.PropertyDetailsSection
  add column if not exists PropertyType text;

alter table if exists public.PropertyDetailsSection
  add constraint propertydetailssection_propertytype_check
  check (PropertyType in ('SummerRent', 'EventVenue', 'RealEstate'));

create table if not exists public.PropertySectionImages (
  Id uuid primary key default gen_random_uuid(),
  SectionId uuid not null references public.PropertyDetailsSection(Id) on delete cascade,
  PropertyImageId uuid not null references public."PropertyImages"("Id") on delete cascade,
  DisplayOrder integer not null default 0,
  CreatedAt timestamptz not null default now(),
  UpdatedAt timestamptz not null default now(),
  unique (SectionId, PropertyImageId)
);

create index if not exists idx_propertyimages_property_display
  on public."PropertyImages"("EstatePropertyId", "DisplayOrder");

create index if not exists idx_propertydetailssection_property_display
  on public.PropertyDetailsSection(PropertyId, DisplayOrder);

create index if not exists idx_propertydetailssection_property_type_display
  on public.PropertyDetailsSection(PropertyId, PropertyType, DisplayOrder);

create index if not exists idx_propertysectionimages_section_display
  on public.PropertySectionImages(SectionId, DisplayOrder);

create index if not exists idx_propertysectionimages_propertyimage
  on public.PropertySectionImages(PropertyImageId);

create or replace function public.insert_property_details_section(
  p_property_id uuid,
  p_name text,
  p_description text default null,
  p_property_type text default 'RealEstate',
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
  v_section_id uuid;
begin
  if p_property_type not in ('SummerRent', 'EventVenue', 'RealEstate') then
    raise exception 'Invalid property type: %', p_property_type;
  end if;

  if p_layout_type not in ('split', 'carousel', 'stacked') then
    raise exception 'Invalid layout type: %', p_layout_type;
  end if;

  insert into public.PropertyDetailsSection (
    PropertyId,
    Name,
    Description,
    PropertyType,
    LayoutType,
    LayoutConfig,
    DisplayOrder
  ) values (
    p_property_id,
    p_name,
    p_description,
    p_property_type,
    p_layout_type,
    p_layout_config,
    coalesce(p_display_order, 0)
  )
  returning Id into v_section_id;

  return v_section_id;
end;
$$;

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
  v_row_id uuid;
begin
  insert into public.PropertySectionImages (
    SectionId,
    PropertyImageId,
    DisplayOrder
  ) values (
    p_section_id,
    p_property_image_id,
    coalesce(p_display_order, 0)
  )
  on conflict (SectionId, PropertyImageId) do update
    set DisplayOrder = excluded.DisplayOrder,
        UpdatedAt = now()
  returning Id into v_row_id;

  return v_row_id;
end;
$$;