-- Catalog of professionally translated policies/sections.
-- Property instances store template key + slots (live interpolation on read).
-- Only platform admin may persist custom (non-template) copy.

CREATE TABLE public.property_policy_template (
  key text PRIMARY KEY,
  listing_types public."ListingType"[] NOT NULL,
  exclusion_group text,
  localized_title jsonb NOT NULL DEFAULT '{}'::jsonb,
  localized_description jsonb NOT NULL DEFAULT '{}'::jsonb,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_policy_template_title_check
    CHECK (public.is_valid_localized_text_json(localized_title)),
  CONSTRAINT property_policy_template_description_check
    CHECK (public.is_valid_localized_text_json(localized_description)),
  CONSTRAINT property_policy_template_slots_check
    CHECK (jsonb_typeof(slots) = 'array')
);

CREATE TABLE public.property_section_template (
  key text PRIMARY KEY,
  property_types public."PropertyType"[] NOT NULL,
  localized_name jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_layout_type text NOT NULL DEFAULT 'split',
  default_display_variant text NOT NULL DEFAULT 'default',
  archived boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_section_template_name_check
    CHECK (public.is_valid_localized_text_json(localized_name)),
  CONSTRAINT property_section_template_layout_check
    CHECK (default_layout_type = ANY (ARRAY['split', 'carousel', 'stacked'])),
  CONSTRAINT property_section_template_variant_check
    CHECK (default_display_variant = ANY (ARRAY['default', 'compact', 'hero']))
);

ALTER TABLE public."EstatePropertyPolicy"
  ADD COLUMN "TemplateKey" text REFERENCES public.property_policy_template(key),
  ADD COLUMN "SlotValues" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.propertydetailssection
  ADD COLUMN templatekey text REFERENCES public.property_section_template(key);

CREATE UNIQUE INDEX estate_property_policy_template_instance_uidx
  ON public."EstatePropertyPolicy" ("EstatePropertyId", "TemplateKey", "ListingType")
  WHERE "IsDeleted" = false AND "TemplateKey" IS NOT NULL;

CREATE UNIQUE INDEX propertydetailssection_template_instance_uidx
  ON public.propertydetailssection (propertyid, templatekey, propertytype)
  WHERE isdeleted = false AND templatekey IS NOT NULL;

ALTER TABLE public.property_policy_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_section_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_policy_template_select
  ON public.property_policy_template FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY property_section_template_select
  ON public.property_section_template FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.property_policy_template TO anon, authenticated, service_role;
GRANT SELECT ON public.property_section_template TO anon, authenticated, service_role;
GRANT ALL ON public.property_policy_template TO postgres, service_role;
GRANT ALL ON public.property_section_template TO postgres, service_role;

INSERT INTO public.property_policy_template (
  key, listing_types, exclusion_group, localized_title, localized_description, slots, display_order
) VALUES
(
  'smoking_indoor_forbidden',
  ARRAY['SummerRent', 'EventVenue', 'AnnualRent']::public."ListingType"[],
  NULL,
  jsonb_build_object(
    'es', 'Prohibido fumar en interiores',
    'en', 'No indoor smoking',
    'pt', 'Proibido fumar em ambientes internos'
  ),
  jsonb_build_object(
    'es', 'No está permitido fumar en el interior de la propiedad. Si hay una zona habilitada al aire libre, se indicará en el lugar.',
    'en', 'Indoor smoking is not allowed. If an outdoor smoking area is available, it will be indicated on site.',
    'pt', 'Não é permitido fumar no interior da propriedade. Se houver área externa habilitada, ela será indicada no local.'
  ),
  '[]'::jsonb,
  10
),
(
  'parties_not_allowed',
  ARRAY['SummerRent']::public."ListingType"[],
  NULL,
  jsonb_build_object(
    'es', 'Fiestas no permitidas',
    'en', 'Parties not allowed',
    'pt', 'Festas não permitidas'
  ),
  jsonb_build_object(
    'es', 'No se permiten fiestas ni eventos con invitados adicionales no registrados.',
    'en', 'Parties and events with unregistered extra guests are not allowed.',
    'pt', 'Não são permitidas festas nem eventos com convidados extras não registrados.'
  ),
  '[]'::jsonb,
  20
),
(
  'quiet_hours',
  ARRAY['SummerRent', 'EventVenue']::public."ListingType"[],
  NULL,
  jsonb_build_object(
    'es', 'Horario de silencio',
    'en', 'Quiet hours',
    'pt', 'Horário de silêncio'
  ),
  jsonb_build_object(
    'es', 'Se debe respetar el horario de silencio de {from} a {to}.',
    'en', 'Quiet hours must be observed from {from} to {to}.',
    'pt', 'O horário de silêncio deve ser respeitado das {from} às {to}.'
  ),
  jsonb_build_array(
    jsonb_build_object('name', 'from', 'type', 'time', 'required', true),
    jsonb_build_object('name', 'to', 'type', 'time', 'required', true)
  ),
  30
),
(
  'pets_not_allowed',
  ARRAY['SummerRent', 'AnnualRent', 'EventVenue']::public."ListingType"[],
  'pets',
  jsonb_build_object(
    'es', 'No se admiten mascotas',
    'en', 'Pets not allowed',
    'pt', 'Animais não são permitidos'
  ),
  jsonb_build_object(
    'es', 'No está permitido alojarse con mascotas.',
    'en', 'Pets are not permitted.',
    'pt', 'Não é permitido hospedar-se com animais de estimação.'
  ),
  '[]'::jsonb,
  40
),
(
  'pets_allowed_with_notice',
  ARRAY['SummerRent', 'AnnualRent']::public."ListingType"[],
  'pets',
  jsonb_build_object(
    'es', 'Mascotas con aviso previo',
    'en', 'Pets allowed with prior notice',
    'pt', 'Animais com aviso prévio'
  ),
  jsonb_build_object(
    'es', 'Se admiten mascotas con aviso previo al anfitrión.',
    'en', 'Pets are allowed if the host is notified in advance.',
    'pt', 'Animais de estimação são permitidos mediante aviso prévio ao anfitrião.'
  ),
  '[]'::jsonb,
  50
),
(
  'check_in_out',
  ARRAY['SummerRent']::public."ListingType"[],
  NULL,
  jsonb_build_object(
    'es', 'Check-in y check-out',
    'en', 'Check-in and check-out',
    'pt', 'Check-in e check-out'
  ),
  jsonb_build_object(
    'es', 'Check-in a partir de las {checkInTime}. Check-out hasta las {checkOutTime}.',
    'en', 'Check-in from {checkInTime}. Check-out by {checkOutTime}.',
    'pt', 'Check-in a partir das {checkInTime}. Check-out até às {checkOutTime}.'
  ),
  jsonb_build_array(
    jsonb_build_object('name', 'checkInTime', 'type', 'time', 'required', true),
    jsonb_build_object('name', 'checkOutTime', 'type', 'time', 'required', true)
  ),
  60
),
(
  'own_catering_not_allowed',
  ARRAY['EventVenue']::public."ListingType"[],
  NULL,
  jsonb_build_object(
    'es', 'Sin catering propio',
    'en', 'Outside catering not allowed',
    'pt', 'Catering próprio não permitido'
  ),
  jsonb_build_object(
    'es', 'No se permite ingresar catering propio. El servicio gastronómico se coordina con el predio.',
    'en', 'Outside catering is not allowed. Food service is arranged with the venue.',
    'pt', 'Não é permitido trazer catering próprio. O serviço gastronômico é coordenado com o espaço.'
  ),
  '[]'::jsonb,
  70
),
(
  'own_decoration_not_allowed',
  ARRAY['EventVenue']::public."ListingType"[],
  NULL,
  jsonb_build_object(
    'es', 'Sin decoración propia',
    'en', 'Own decoration not allowed',
    'pt', 'Decoração própria não permitida'
  ),
  jsonb_build_object(
    'es', 'No se permite instalar decoración propia. La ambientación se acuerda con el predio.',
    'en', 'Installing your own decoration is not allowed. Styling is arranged with the venue.',
    'pt', 'Não é permitido instalar decoração própria. A ambientação é combinada com o espaço.'
  ),
  '[]'::jsonb,
  80
);

INSERT INTO public.property_section_template (
  key, property_types, localized_name, default_layout_type, default_display_variant, display_order
) VALUES
(
  'outdoor_spaces',
  ARRAY['SummerRent']::public."PropertyType"[],
  jsonb_build_object('es', 'Espacios exteriores', 'en', 'Outdoor spaces', 'pt', 'Espaços externos'),
  'carousel',
  'default',
  10
),
(
  'home_layout',
  ARRAY['SummerRent']::public."PropertyType"[],
  jsonb_build_object('es', 'Distribución de la vivienda', 'en', 'Home layout', 'pt', 'Distribuição da casa'),
  'split',
  'default',
  20
),
(
  'decoration',
  ARRAY['EventVenue']::public."PropertyType"[],
  jsonb_build_object('es', 'Decoración', 'en', 'Decoration', 'pt', 'Decoração'),
  'carousel',
  'default',
  30
),
(
  'catering',
  ARRAY['EventVenue']::public."PropertyType"[],
  jsonb_build_object('es', 'Catering / comida', 'en', 'Catering / food', 'pt', 'Catering / comida'),
  'split',
  'default',
  40
),
(
  'dj',
  ARRAY['EventVenue']::public."PropertyType"[],
  jsonb_build_object('es', 'DJ', 'en', 'DJ', 'pt', 'DJ'),
  'split',
  'default',
  50
),
(
  'exteriors',
  ARRAY['RealEstate']::public."PropertyType"[],
  jsonb_build_object('es', 'Exteriores', 'en', 'Exteriors', 'pt', 'Exteriores'),
  'split',
  'default',
  60
),
(
  'interior',
  ARRAY['RealEstate']::public."PropertyType"[],
  jsonb_build_object('es', 'Interior', 'en', 'Interior', 'pt', 'Interior'),
  'split',
  'default',
  70
);

CREATE OR REPLACE FUNCTION public.interpolate_localized_text(p_text jsonb, p_slots jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
declare
  result jsonb := coalesce(p_text, '{}'::jsonb);
  lang text;
  val text;
  slot_key text;
  slot_val text;
begin
  if p_slots is null or p_slots = '{}'::jsonb then
    return public.sanitize_localized_text_json(result);
  end if;

  foreach lang in array array['es', 'en', 'pt']
  loop
    val := result->>lang;
    if val is null then
      continue;
    end if;
    for slot_key, slot_val in
      select key, value #>> '{}'
      from jsonb_each(coalesce(p_slots, '{}'::jsonb))
    loop
      val := replace(val, '{' || slot_key || '}', coalesce(slot_val, ''));
    end loop;
    result := jsonb_set(result, array[lang], to_jsonb(val));
  end loop;

  return public.sanitize_localized_text_json(result);
end;
$$;

CREATE OR REPLACE FUNCTION public.resolved_policy_title(
  p_template_key text,
  p_slot_values jsonb,
  p_fallback jsonb
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  select case
    when p_template_key is null then public.sanitize_localized_text_json(p_fallback)
    else public.interpolate_localized_text(
      (select t.localized_title from public.property_policy_template t where t.key = p_template_key),
      p_slot_values
    )
  end;
$$;

CREATE OR REPLACE FUNCTION public.resolved_policy_description(
  p_template_key text,
  p_slot_values jsonb,
  p_fallback jsonb
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  select case
    when p_template_key is null then public.sanitize_localized_text_json(p_fallback)
    else public.interpolate_localized_text(
      (select t.localized_description from public.property_policy_template t where t.key = p_template_key),
      p_slot_values
    )
  end;
$$;

CREATE OR REPLACE FUNCTION public.resolved_section_name(
  p_template_key text,
  p_fallback jsonb
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  select case
    when p_template_key is null then public.sanitize_localized_text_json(p_fallback)
    else public.sanitize_localized_text_json(
      (select t.localized_name from public.property_section_template t where t.key = p_template_key)
    )
  end;
$$;

CREATE OR REPLACE FUNCTION public.is_hhmm_time(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  select coalesce(p_value, '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
$$;

CREATE OR REPLACE FUNCTION public.validate_policy_slot_values(p_template_key text, p_slots jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
declare
  v_def jsonb;
  v_name text;
  v_type text;
  v_required boolean;
  v_value text;
begin
  select t.slots into v_def
  from public.property_policy_template t
  where t.key = p_template_key;

  if v_def is null then
    raise exception 'La plantilla de política % no existe.', p_template_key;
  end if;

  for v_def in select * from jsonb_array_elements(coalesce(v_def, '[]'::jsonb))
  loop
    v_name := v_def->>'name';
    v_type := coalesce(v_def->>'type', 'time');
    v_required := coalesce((v_def->>'required')::boolean, false);
    v_value := nullif(trim(both from coalesce(p_slots->>v_name, '')), '');

    if v_required and v_value is null then
      raise exception 'Falta el valor requerido "%" en la política %.', v_name, p_template_key;
    end if;

    if v_value is not null and v_type = 'time' and not public.is_hhmm_time(v_value) then
      raise exception 'El horario "%" no es válido (use HH:mm).', v_name;
    end if;
  end loop;
end;
$$;

CREATE OR REPLACE FUNCTION public.listing_type_to_section_property_type(p public."ListingType")
RETURNS public."PropertyType"
LANGUAGE sql
IMMUTABLE
AS $$
  select case p
    when 'SummerRent' then 'SummerRent'::public."PropertyType"
    when 'EventVenue' then 'EventVenue'::public."PropertyType"
    else 'RealEstate'::public."PropertyType"
  end;
$$;

CREATE OR REPLACE FUNCTION public.build_property_policies_json(
  p_estate_property_id uuid,
  p_listing_type public."ListingType"
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', epp."Id",
        'listingType', epp."ListingType",
        'templateKey', epp."TemplateKey",
        'title', public.resolved_policy_title(epp."TemplateKey", epp."SlotValues", epp."LocalizedTitle"),
        'description', public.resolved_policy_description(epp."TemplateKey", epp."SlotValues", epp."LocalizedDescription"),
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
      public.resolved_policy_title(epp."TemplateKey", epp."SlotValues", epp."LocalizedTitle") <> '{}'::jsonb
      or public.resolved_policy_description(epp."TemplateKey", epp."SlotValues", epp."LocalizedDescription") <> '{}'::jsonb
    );
$$;

CREATE OR REPLACE FUNCTION public.build_property_content_sections_json(
  p_estate_property_id uuid,
  p_property_type public."PropertyType"
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'propertyType', s.propertytype,
        'templateKey', s.templatekey,
        'localizedName', public.resolved_section_name(s.templatekey, s.localizedname),
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
    and public.resolved_section_name(s.templatekey, s.localizedname) <> '{}'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.replace_estate_property_policies(p_property_id uuid, p_policies jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_policy jsonb;
  v_listing_type public."ListingType";
  v_title jsonb;
  v_description jsonb;
  v_template_key text;
  v_slots jsonb;
  v_order integer := 0;
  v_is_admin boolean := public.is_admin();
  v_dup integer;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  if not public.user_can_manage_estate_property(p_property_id) and not v_is_admin then
    raise exception 'No autorizado para actualizar políticas.';
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

    v_template_key := nullif(trim(both from coalesce(v_policy->>'templateKey', v_policy->>'template_key', '')), '');
    v_slots := coalesce(v_policy->'slotValues', v_policy->'slot_values', '{}'::jsonb);
    if jsonb_typeof(v_slots) <> 'object' then
      v_slots := '{}'::jsonb;
    end if;

    if v_template_key is not null then
      if not exists (select 1 from public.property_policy_template t where t.key = v_template_key) then
        raise exception 'La plantilla de política % no existe.', v_template_key;
      end if;
      if not exists (
        select 1
        from public.property_policy_template t
        where t.key = v_template_key
          and v_listing_type = any (t.listing_types)
      ) then
        raise exception 'La plantilla % no aplica al tipo de publicación %.', v_template_key, v_listing_type;
      end if;
      perform public.validate_policy_slot_values(v_template_key, v_slots);
      v_title := '{}'::jsonb;
      v_description := '{}'::jsonb;
    else
      if not v_is_admin then
        raise exception 'Solo un administrador puede agregar políticas personalizadas.';
      end if;
      v_title := public.sanitize_localized_text_json(coalesce(v_policy->'title', v_policy->'localizedTitle', '{}'::jsonb));
      v_description := public.sanitize_localized_text_json(coalesce(v_policy->'description', v_policy->'localizedDescription', '{}'::jsonb));
      if v_title = '{}'::jsonb and v_description = '{}'::jsonb then
        continue;
      end if;
      v_slots := '{}'::jsonb;
    end if;

    insert into public."EstatePropertyPolicy" (
      "EstatePropertyId",
      "ListingType",
      "LocalizedTitle",
      "LocalizedDescription",
      "TemplateKey",
      "SlotValues",
      "DisplayOrder",
      "IsDeleted",
      "Created",
      "LastModified"
    ) values (
      p_property_id,
      v_listing_type,
      v_title,
      v_description,
      v_template_key,
      v_slots,
      coalesce((v_policy->>'displayOrder')::integer, v_order),
      false,
      now(),
      now()
    );

    v_order := v_order + 1;
  end loop;

  select count(*) into v_dup
  from (
    select epp."ListingType", t.exclusion_group
    from public."EstatePropertyPolicy" epp
    join public.property_policy_template t on t.key = epp."TemplateKey"
    where epp."EstatePropertyId" = p_property_id
      and epp."IsDeleted" = false
      and t.exclusion_group is not null
    group by epp."ListingType", t.exclusion_group
    having count(*) > 1
  ) d;
  if coalesce(v_dup, 0) > 0 then
    raise exception 'Hay políticas incompatibles entre sí (por ejemplo mascotas permitidas y no permitidas).';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.replace_estate_property_content_sections(p_property_id uuid, p_sections jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_section jsonb;
  v_section_id uuid;
  v_property_type public."PropertyType";
  v_layout_type text;
  v_layout_config jsonb;
  v_name jsonb;
  v_description jsonb;
  v_template_key text;
  v_order integer := 0;
  v_image_id uuid;
  v_image_elem jsonb;
  v_image_order integer;
  v_is_admin boolean := public.is_admin();
  v_image_count integer;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  if not public.user_can_manage_estate_property(p_property_id) and not v_is_admin then
    raise exception 'No autorizado para actualizar secciones.';
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
    v_template_key := nullif(trim(both from coalesce(v_section->>'templateKey', v_section->>'template_key', '')), '');
    v_name := public.sanitize_localized_text_json(coalesce(v_section->'localizedName', v_section->'localized_name', '{}'::jsonb));
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

    v_image_count := 0;
    if jsonb_typeof(v_section->'propertyImageIds') = 'array' then
      v_image_count := jsonb_array_length(v_section->'propertyImageIds');
    elsif jsonb_typeof(v_section->'images') = 'array' then
      v_image_count := jsonb_array_length(v_section->'images');
    end if;

    if v_template_key is not null then
      if not exists (select 1 from public.property_section_template t where t.key = v_template_key) then
        raise exception 'La plantilla de sección % no existe.', v_template_key;
      end if;
      if v_property_type is not null and not exists (
        select 1
        from public.property_section_template t
        where t.key = v_template_key
          and v_property_type = any (t.property_types)
      ) then
        raise exception 'La plantilla % no aplica al tipo de propiedad %.', v_template_key, v_property_type;
      end if;
      if v_image_count < 1 then
        raise exception 'Las secciones de plantilla requieren al menos una imagen.';
      end if;
      v_name := '{}'::jsonb;
      v_description := '{}'::jsonb;
    else
      if not v_is_admin then
        raise exception 'Solo un administrador puede agregar secciones personalizadas.';
      end if;
      if v_name = '{}'::jsonb then
        continue;
      end if;
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
      updatedat,
      templatekey
    ) values (
      v_section_id,
      p_property_id,
      coalesce(
        public.resolved_section_name(v_template_key, v_name)->>'es',
        public.resolved_section_name(v_template_key, v_name)->>'en',
        public.resolved_section_name(v_template_key, v_name)->>'pt',
        ''
      ),
      coalesce(v_description->>'es', v_description->>'en', v_description->>'pt', ''),
      v_name,
      v_description,
      v_property_type,
      v_layout_type,
      v_layout_config,
      v_order,
      false,
      now(),
      now(),
      v_template_key
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

CREATE OR REPLACE FUNCTION public.get_estate_property_editor_content(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_policies jsonb;
  v_sections jsonb;
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  if not public.user_can_manage_estate_property(p_property_id) and not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', epp."Id",
        'listingType', epp."ListingType",
        'templateKey', epp."TemplateKey",
        'slotValues', coalesce(epp."SlotValues", '{}'::jsonb),
        'title', public.resolved_policy_title(epp."TemplateKey", epp."SlotValues", epp."LocalizedTitle"),
        'description', public.resolved_policy_description(epp."TemplateKey", epp."SlotValues", epp."LocalizedDescription"),
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
        'templateKey', s.templatekey,
        'localizedName', public.resolved_section_name(s.templatekey, s.localizedname),
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

CREATE OR REPLACE FUNCTION public.get_public_property_content(
  p_property_id uuid,
  p_listing_type public."ListingType" DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_listing_type public."ListingType";
  v_property_type public."PropertyType";
begin
  if p_property_id is null then
    raise exception 'p_property_id is required';
  end if;

  if not public.is_public_estate_property(p_property_id) then
    return jsonb_build_object('policies', '[]'::jsonb, 'contentSections', '[]'::jsonb);
  end if;

  v_listing_type := p_listing_type;
  if v_listing_type is null then
    select l."ListingType"
      into v_listing_type
    from public."Listings" l
    where l."EstatePropertyId" = p_property_id
      and l."IsDeleted" = false
      and l."IsActive" = true
      and l."IsPropertyVisible" = true
    order by l."IsFeatured" desc, l."Created" desc
    limit 1;
  end if;

  if v_listing_type is null then
    return jsonb_build_object('policies', '[]'::jsonb, 'contentSections', '[]'::jsonb);
  end if;

  v_property_type := public.listing_type_to_section_property_type(v_listing_type);

  return jsonb_build_object(
    'policies', public.build_property_policies_json(p_property_id, v_listing_type),
    'contentSections', public.build_property_content_sections_json(p_property_id, v_property_type)
  );
end;
$$;

GRANT EXECUTE ON FUNCTION public.interpolate_localized_text(jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolved_policy_title(text, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolved_policy_description(text, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolved_section_name(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_property_content(uuid, public."ListingType") TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_estate_property_editor_content(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_estate_property_policies(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_estate_property_content_sections(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.duplicate_estate_property(
  p_original_property_id text,
  p_user_id text,
  p_new_title text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_original_property record;
  v_new_property_id uuid;
  v_member_id uuid;
  v_owner_id uuid;
  v_new_title text;
  v_old_section_id uuid;
  v_new_section_id uuid;
  v_existing_property_count integer;
  v_subscription_plan_max_properties integer;
  v_source_listing record;
  v_photo_count integer;
  v_photo_cap integer;
  v_plan_photo_cap integer;
begin
  if p_original_property_id is null or p_user_id is null then
    raise exception 'Property id and user id are required to duplicate.';
  end if;

  if not public.is_property_owner(p_user_id::uuid, p_original_property_id::uuid)
     and not public.is_admin() then
    raise exception 'You do not have permission to duplicate this property.';
  end if;

  select
    ep."StreetName", ep."HouseNumber", ep."Neighborhood", ep."City", ep."State", ep."ZipCode", ep."Country",
    ep."LocationLatitude", ep."LocationLongitude", ep."Title", ep."Type", ep."AreaValue", ep."AreaUnit",
    ep."Bedrooms", ep."Bathrooms", ep."HasGarage", ep."GarageSpaces", ep."OwnerId",
    ep."HasLaundryRoom", ep."HasPool", ep."HasBalcony", ep."IsFurnished", ep."Capacity",
    ep."LocationCategory", ep."ViewType"
  into v_original_property
  from public."EstateProperties" ep
  where ep."Id" = p_original_property_id::uuid
    and ep."IsDeleted" = false;

  if not found then
    raise exception 'Property not found.';
  end if;

  select m."Id"
    into v_member_id
  from public."Members" m
  where m."UserId" = p_user_id::uuid
    and m."IsDeleted" = false
  limit 1;

  if v_member_id is null then
    raise exception 'Member not found for user.';
  end if;

  select count(*) into v_existing_property_count
  from public."EstateProperties" ep
  inner join public."Owners" o on ep."OwnerId" = o."Id" and o."IsDeleted" = false
  where ep."IsDeleted" = false
    and (
      (o."OwnerType" = 'member' and o."MemberId" = v_member_id) or
      (o."OwnerType" = 'company' and o."CompanyId" in (
        select cm."CompanyId"
        from public."CompanyMembers" cm
        where cm."MemberId" = v_member_id and cm."IsDeleted" = false
      ))
    );

  select coalesce(p."ListingLimit", p."MaxProperties")
    into v_subscription_plan_max_properties
  from public."Members" m
  left join lateral (
    select bpa."PlanId"
    from public."BillingPlanAssignments" bpa
    where bpa."SubjectType" = 'member'
      and bpa."MemberOrCompanyId" = v_member_id
      and bpa."IsActive" = true
      and bpa."StartDate" <= now()
      and (bpa."EndDate" is null or bpa."EndDate" >= now())
    order by bpa."StartDate" desc
    limit 1
  ) active_plan on true
  left join public."Plans" p
    on p."Id" = active_plan."PlanId"
    and coalesce(p."IsActiveV2", p."IsActive", true) = true
    and p."IsDeleted" = false
  where m."Id" = v_member_id
    and m."IsDeleted" = false;

  if v_subscription_plan_max_properties is not null
     and v_existing_property_count >= v_subscription_plan_max_properties then
    raise exception 'Property limit exceeded. You have % properties but your plan allows maximum %.',
      v_existing_property_count, v_subscription_plan_max_properties;
  end if;

  select l.*
    into v_source_listing
  from public."Listings" l
  where l."EstatePropertyId" = p_original_property_id::uuid
    and l."IsDeleted" = false
  order by l."IsFeatured" desc, l."Created" desc
  limit 1;

  if v_source_listing."Id" is not null
     and coalesce(v_source_listing."IsActive", false)
     and coalesce(v_source_listing."IsPropertyVisible", false) then
    perform public.assert_published_property_within_plan('member', v_member_id, null);
  end if;

  select count(*)::integer into v_photo_count
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_original_property_id::uuid
    and pi."IsDeleted" = false;

  select p."MaxPhotosPerProperty"
    into v_plan_photo_cap
  from public."BillingPlanAssignments" bpa
  join public."Plans" p
    on p."Id" = bpa."PlanId"
   and coalesce(p."IsActiveV2", p."IsActive", true) = true
   and p."IsDeleted" = false
  where bpa."SubjectType" = 'member'
    and bpa."MemberOrCompanyId" = v_member_id
    and bpa."IsActive" = true
    and bpa."StartDate" <= now()
    and (bpa."EndDate" is null or bpa."EndDate" >= now())
  order by bpa."StartDate" desc
  limit 1;

  v_photo_cap := least(coalesce(v_plan_photo_cap, 30), 30);
  if v_photo_count > v_photo_cap then
    raise exception 'Photo limit exceeded. Source has % photos but your plan allows a maximum of % per property.',
      v_photo_count, v_photo_cap;
  end if;

  v_owner_id := public.get_or_create_owner(v_member_id, null, null);

  v_new_title := coalesce(p_new_title, v_original_property."Title" || ' (Copy)');
  v_new_property_id := gen_random_uuid();

  insert into public."EstateProperties" (
    "Id",
    "StreetName",
    "HouseNumber",
    "Neighborhood",
    "City",
    "State",
    "ZipCode",
    "Country",
    "LocationLatitude",
    "LocationLongitude",
    "Title",
    "Type",
    "AreaValue",
    "AreaUnit",
    "Bedrooms",
    "Bathrooms",
    "HasGarage",
    "GarageSpaces",
    "OwnerId",
    "HasLaundryRoom",
    "HasPool",
    "HasBalcony",
    "IsFurnished",
    "Capacity",
    "LocationCategory",
    "ViewType",
    "IsDeleted",
    "Created",
    "LastModified"
  ) values (
    v_new_property_id,
    v_original_property."StreetName",
    v_original_property."HouseNumber",
    v_original_property."Neighborhood",
    v_original_property."City",
    v_original_property."State",
    v_original_property."ZipCode",
    v_original_property."Country",
    v_original_property."LocationLatitude",
    v_original_property."LocationLongitude",
    v_new_title,
    v_original_property."Type",
    v_original_property."AreaValue",
    v_original_property."AreaUnit",
    v_original_property."Bedrooms",
    v_original_property."Bathrooms",
    v_original_property."HasGarage",
    v_original_property."GarageSpaces",
    v_owner_id,
    v_original_property."HasLaundryRoom",
    v_original_property."HasPool",
    v_original_property."HasBalcony",
    v_original_property."IsFurnished",
    v_original_property."Capacity",
    v_original_property."LocationCategory",
    v_original_property."ViewType",
    false,
    now(),
    now()
  );

  if v_source_listing."Id" is not null then
    insert into public."Listings" (
      "Id",
      "EstatePropertyId",
      "ListingType",
      "Title",
      "Description",
      "AvailableFrom",
      "Capacity",
      "Currency",
      "SalePrice",
      "RentPrice",
      "RentPricePeriod",
      "IsPriceVisible",
      "Status",
      "IsActive",
      "IsPropertyVisible",
      "IsFeatured",
      "BlockedForBooking",
      "BasePrice",
      "MinPrice",
      "MaxPrice",
      "LongStayDiscountEnabled",
      "LongStayMinDays",
      "LongStayDiscountPercentage",
      "IsDeleted",
      "Created",
      "CreatedBy",
      "LastModified",
      "LastModifiedBy"
    )
    values (
      gen_random_uuid(),
      v_new_property_id,
      v_source_listing."ListingType",
      coalesce(v_source_listing."Title", v_new_title),
      v_source_listing."Description",
      v_source_listing."AvailableFrom",
      v_source_listing."Capacity",
      v_source_listing."Currency",
      v_source_listing."SalePrice",
      v_source_listing."RentPrice",
      v_source_listing."RentPricePeriod",
      coalesce(v_source_listing."IsPriceVisible", true),
      v_source_listing."Status",
      coalesce(v_source_listing."IsActive", false),
      coalesce(v_source_listing."IsPropertyVisible", false),
      true,
      coalesce(v_source_listing."BlockedForBooking", false),
      v_source_listing."BasePrice",
      v_source_listing."MinPrice",
      v_source_listing."MaxPrice",
      coalesce(v_source_listing."LongStayDiscountEnabled", false),
      v_source_listing."LongStayMinDays",
      v_source_listing."LongStayDiscountPercentage",
      false,
      now(),
      p_user_id,
      now(),
      p_user_id
    );
  end if;

  insert into public."PropertyImages" (
    "Id", "EstatePropertyId", "Url", "AltText", "IsMain", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy", "DisplayOrder"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pi."Url",
    pi."AltText",
    pi."IsMain",
    false,
    now(),
    p_user_id,
    now(),
    p_user_id,
    pi."DisplayOrder"
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_original_property_id::uuid
    and pi."IsDeleted" = false;

  insert into public."PropertyDocuments" (
    "Id", "EstatePropertyId", "Url", "Name", "FileType", "IsPublic", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pd."Url",
    pd."Name",
    pd."FileType",
    coalesce(pd."IsPublic", true),
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from public."PropertyDocuments" pd
  where pd."EstatePropertyId" = p_original_property_id::uuid
    and pd."IsDeleted" = false;

  insert into public."PropertyVideos" (
    "Id", "EstatePropertyId", "Url", "Title", "Description", "IsDeleted",
    "Created", "CreatedBy", "LastModified", "LastModifiedBy"
  )
  select
    gen_random_uuid(),
    v_new_property_id,
    pv."Url",
    pv."Title",
    pv."Description",
    false,
    now(),
    p_user_id,
    now(),
    p_user_id
  from public."PropertyVideos" pv
  where pv."EstatePropertyId" = p_original_property_id::uuid
    and pv."IsDeleted" = false;

  insert into public."EstatePropertyAmenity" (
    "EstatePropertyId",
    "AmenityId",
    "LocalizedDescriptions",
    "CreatedAtUtc",
    "DeletedAtUtc"
  )
  select
    v_new_property_id,
    epa."AmenityId",
    epa."LocalizedDescriptions",
    now(),
    null
  from public."EstatePropertyAmenity" epa
  where epa."EstatePropertyId" = p_original_property_id::uuid
    and epa."DeletedAtUtc" is null;

  insert into public."EstatePropertyPolicy" (
    "EstatePropertyId",
    "ListingType",
    "LocalizedTitle",
    "LocalizedDescription",
    "TemplateKey",
    "SlotValues",
    "DisplayOrder",
    "IsDeleted",
    "Created",
    "LastModified"
  )
  select
    v_new_property_id,
    epp."ListingType",
    epp."LocalizedTitle",
    epp."LocalizedDescription",
    epp."TemplateKey",
    epp."SlotValues",
    epp."DisplayOrder",
    false,
    now(),
    now()
  from public."EstatePropertyPolicy" epp
  where epp."EstatePropertyId" = p_original_property_id::uuid
    and epp."IsDeleted" = false;

  for v_old_section_id in
    select s.id
    from public.propertydetailssection s
    where s.propertyid = p_original_property_id::uuid
      and s.isdeleted = false
    order by s.displayorder, s.createdat
  loop
    v_new_section_id := gen_random_uuid();

    insert into public.propertydetailssection (
      id, propertyid, name, description, localizedname, localizeddescription,
      propertytype, layouttype, layoutconfig, displayorder, isdeleted, createdat, updatedat,
      templatekey
    )
    select
      v_new_section_id,
      v_new_property_id,
      src.name,
      src.description,
      src.localizedname,
      src.localizeddescription,
      src.propertytype,
      src.layouttype,
      src.layoutconfig,
      src.displayorder,
      false,
      now(),
      now(),
      src.templatekey
    from public.propertydetailssection src
    where src.id = v_old_section_id;

    insert into public.propertysectionimages (
      id, sectionid, propertyimageid, displayorder, createdat, updatedat
    )
    select
      gen_random_uuid(),
      v_new_section_id,
      psi.propertyimageid,
      psi.displayorder,
      now(),
      now()
    from public.propertysectionimages psi
    where psi.sectionid = v_old_section_id;
  end loop;

  return jsonb_build_object(
    'newPropertyId', v_new_property_id,
    'title', v_new_title
  );
end;
$$;
