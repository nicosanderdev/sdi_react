-- Seeded amenity catalog with localized names/descriptions.
-- Instances store amenity keys via Amenities."Key"; custom copy is admin-only.
-- Slot columns are reserved; v1 has no slot UI.

CREATE TABLE public."AmenityTemplate" (
  "Key" text PRIMARY KEY,
  "LocalizedName" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "LocalizedDescription" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "IconId" text,
  "PropertyTypes" public."PropertyType"[] NOT NULL,
  "Slots" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "Archived" boolean NOT NULL DEFAULT false,
  "DisplayOrder" integer NOT NULL DEFAULT 0,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT amenity_template_name_check
    CHECK (public.is_valid_localized_text_json("LocalizedName")),
  CONSTRAINT amenity_template_description_check
    CHECK (public.is_valid_localized_text_json("LocalizedDescription")),
  CONSTRAINT amenity_template_slots_check
    CHECK (jsonb_typeof("Slots") = 'array')
);

ALTER TABLE public."AmenityTemplate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY amenity_template_select
  ON public."AmenityTemplate" FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public."AmenityTemplate" TO anon, authenticated, service_role;
GRANT ALL ON public."AmenityTemplate" TO postgres, service_role;

INSERT INTO public."AmenityTemplate" (
  "Key", "LocalizedName", "LocalizedDescription", "IconId", "PropertyTypes", "DisplayOrder"
) VALUES
(
  'wifi',
  jsonb_build_object('es', 'Wi-Fi / Internet', 'en', 'Wi-Fi / Internet', 'pt', 'Wi-Fi / Internet'),
  jsonb_build_object(
    'es', 'Hay conexión Wi-Fi disponible para huéspedes.',
    'en', 'Wi-Fi internet is available for guests.',
    'pt', 'Há Wi-Fi disponível para os hóspedes.'
  ),
  'wifi',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  10
),
(
  'air_conditioning',
  jsonb_build_object('es', 'Aire acondicionado', 'en', 'Air conditioning', 'pt', 'Ar-condicionado'),
  jsonb_build_object(
    'es', 'El inmueble cuenta con aire acondicionado.',
    'en', 'The property has air conditioning.',
    'pt', 'O imóvel possui ar-condicionado.'
  ),
  'snowflake',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  20
),
(
  'heating',
  jsonb_build_object('es', 'Calefacción', 'en', 'Heating', 'pt', 'Aquecimento'),
  jsonb_build_object(
    'es', 'El inmueble cuenta con calefacción.',
    'en', 'The property has heating.',
    'pt', 'O imóvel possui aquecimento.'
  ),
  'thermometer',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  30
),
(
  'parking',
  jsonb_build_object('es', 'Estacionamiento', 'en', 'Parking', 'pt', 'Estacionamento'),
  '{}'::jsonb,
  'car',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  40
),
(
  'cctv',
  jsonb_build_object('es', 'Seguridad / CCTV', 'en', 'Security / CCTV', 'pt', 'Segurança / CCTV'),
  jsonb_build_object(
    'es', 'Hay cámaras de seguridad en áreas comunes.',
    'en', 'Security cameras cover common areas.',
    'pt', 'Há câmeras de segurança nas áreas comuns.'
  ),
  'shield',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  50
),
(
  'wheelchair_access',
  jsonb_build_object('es', 'Acceso para silla de ruedas', 'en', 'Wheelchair access', 'pt', 'Acesso para cadeira de rodas'),
  jsonb_build_object(
    'es', 'El acceso es apto para silla de ruedas.',
    'en', 'The property is wheelchair accessible.',
    'pt', 'O acesso é adaptado para cadeira de rodas.'
  ),
  'accessibility',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  60
),
(
  'sea_view',
  jsonb_build_object('es', 'Vista al mar', 'en', 'Sea view', 'pt', 'Vista para o mar'),
  '{}'::jsonb,
  'waves',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  70
),
(
  'mountain_view',
  jsonb_build_object('es', 'Vista a la montaña', 'en', 'Mountain view', 'pt', 'Vista para a montanha'),
  '{}'::jsonb,
  'mountain',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  80
),
(
  'city_view',
  jsonb_build_object('es', 'Vista a la ciudad', 'en', 'City view', 'pt', 'Vista para a cidade'),
  '{}'::jsonb,
  'building',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  90
),
(
  'pool',
  jsonb_build_object('es', 'Piscina', 'en', 'Pool', 'pt', 'Piscina'),
  '{}'::jsonb,
  'pool',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  100
),
(
  'garden',
  jsonb_build_object('es', 'Jardín', 'en', 'Garden', 'pt', 'Jardim'),
  jsonb_build_object(
    'es', 'El inmueble tiene jardín.',
    'en', 'The property has a garden.',
    'pt', 'O imóvel tem jardim.'
  ),
  'leaf',
  ARRAY['RealEstate', 'SummerRent', 'EventVenue']::public."PropertyType"[],
  110
),
(
  'balcony',
  jsonb_build_object('es', 'Balcón', 'en', 'Balcony', 'pt', 'Sacada'),
  '{}'::jsonb,
  'balcony',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  120
),
(
  'terrace',
  jsonb_build_object('es', 'Terraza', 'en', 'Terrace', 'pt', 'Terraço'),
  jsonb_build_object(
    'es', 'Hay una terraza para uso de los huéspedes.',
    'en', 'There is a terrace for guest use.',
    'pt', 'Há um terraço para uso dos hóspedes.'
  ),
  'sun',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  130
),
(
  'grill',
  jsonb_build_object('es', 'Parrillero', 'en', 'Barbecue grill', 'pt', 'Churrasqueira'),
  jsonb_build_object(
    'es', 'Cuenta con parrillero.',
    'en', 'There is a barbecue grill.',
    'pt', 'Há churrasqueira.'
  ),
  'grill',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  140
),
(
  'furnished',
  jsonb_build_object('es', 'Amueblado', 'en', 'Furnished', 'pt', 'Mobiliado'),
  '{}'::jsonb,
  'sofa',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  150
),
(
  'laundry',
  jsonb_build_object('es', 'Lavadero', 'en', 'Laundry room', 'pt', 'Lavanderia'),
  '{}'::jsonb,
  'washing-machine',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  160
),
(
  'fireplace',
  jsonb_build_object('es', 'Chimenea', 'en', 'Fireplace', 'pt', 'Lareira'),
  jsonb_build_object(
    'es', 'El inmueble tiene chimenea.',
    'en', 'The property has a fireplace.',
    'pt', 'O imóvel tem lareira.'
  ),
  'flame',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  170
),
(
  'pets_allowed',
  jsonb_build_object('es', 'Mascotas permitidas', 'en', 'Pets allowed', 'pt', 'Animais permitidos'),
  '{}'::jsonb,
  'pets-allowed',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  180
),
(
  'pet_friendly',
  jsonb_build_object('es', 'Apto para mascotas', 'en', 'Pet friendly', 'pt', 'Aceita animais'),
  '{}'::jsonb,
  'paw',
  ARRAY['RealEstate', 'SummerRent']::public."PropertyType"[],
  190
),
(
  'elevator',
  jsonb_build_object('es', 'Ascensor', 'en', 'Elevator', 'pt', 'Elevador'),
  jsonb_build_object(
    'es', 'El edificio tiene ascensor.',
    'en', 'The building has an elevator.',
    'pt', 'O prédio tem elevador.'
  ),
  'elevator',
  ARRAY['RealEstate']::public."PropertyType"[],
  200
),
(
  'storage',
  jsonb_build_object('es', 'Depósito', 'en', 'Storage', 'pt', 'Depósito'),
  jsonb_build_object(
    'es', 'Incluye depósito / espacio de guardado.',
    'en', 'Storage space is included.',
    'pt', 'Inclui depósito / espaço de armazenamento.'
  ),
  'archive',
  ARRAY['RealEstate']::public."PropertyType"[],
  210
),
(
  'solar_panels',
  jsonb_build_object('es', 'Paneles solares', 'en', 'Solar panels', 'pt', 'Painéis solares'),
  jsonb_build_object(
    'es', 'El inmueble tiene paneles solares.',
    'en', 'The property has solar panels.',
    'pt', 'O imóvel tem painéis solares.'
  ),
  'sun-electric',
  ARRAY['RealEstate']::public."PropertyType"[],
  220
),
(
  'backup_generator',
  jsonb_build_object('es', 'Generador de respaldo', 'en', 'Backup generator', 'pt', 'Gerador de backup'),
  jsonb_build_object(
    'es', 'Hay generador de respaldo.',
    'en', 'A backup generator is available.',
    'pt', 'Há gerador de backup.'
  ),
  'battery',
  ARRAY['RealEstate']::public."PropertyType"[],
  230
),
(
  'smart_home',
  jsonb_build_object('es', 'Sistema de casa inteligente', 'en', 'Smart home system', 'pt', 'Casa inteligente'),
  jsonb_build_object(
    'es', 'Cuenta con sistema de casa inteligente.',
    'en', 'The property has a smart home system.',
    'pt', 'Possui sistema de casa inteligente.'
  ),
  'cpu',
  ARRAY['RealEstate']::public."PropertyType"[],
  240
),
(
  'private_parking',
  jsonb_build_object('es', 'Estacionamiento privado', 'en', 'Private parking', 'pt', 'Estacionamento privativo'),
  '{}'::jsonb,
  'garage',
  ARRAY['RealEstate']::public."PropertyType"[],
  250
),
(
  'gated_community',
  jsonb_build_object('es', 'Comunidad cerrada', 'en', 'Gated community', 'pt', 'Condomínio fechado'),
  jsonb_build_object(
    'es', 'Se encuentra en una comunidad cerrada.',
    'en', 'The property is in a gated community.',
    'pt', 'Fica em um condomínio fechado.'
  ),
  'gate',
  ARRAY['RealEstate']::public."PropertyType"[],
  260
),
(
  'concierge_24h',
  jsonb_build_object('es', 'Conserjería 24h', 'en', '24h concierge', 'pt', 'Portaria 24h'),
  jsonb_build_object(
    'es', 'Hay conserjería las 24 horas.',
    'en', '24-hour concierge is available.',
    'pt', 'Há portaria 24 horas.'
  ),
  'user-shield',
  ARRAY['RealEstate']::public."PropertyType"[],
  270
),
(
  'playground',
  jsonb_build_object('es', 'Parque infantil', 'en', 'Playground', 'pt', 'Playground'),
  jsonb_build_object(
    'es', 'Hay un parque infantil.',
    'en', 'There is a playground.',
    'pt', 'Há um playground.'
  ),
  'baby',
  ARRAY['SummerRent']::public."PropertyType"[],
  280
),
(
  'conference_room',
  jsonb_build_object('es', 'Sala de conferencias', 'en', 'Conference room', 'pt', 'Sala de conferências'),
  jsonb_build_object(
    'es', 'Incluye sala de conferencias.',
    'en', 'A conference room is included.',
    'pt', 'Inclui sala de conferências.'
  ),
  'briefcase',
  ARRAY['EventVenue']::public."PropertyType"[],
  290
),
(
  'reception',
  jsonb_build_object('es', 'Recepción', 'en', 'Reception', 'pt', 'Recepção'),
  jsonb_build_object(
    'es', 'El salón cuenta con recepción.',
    'en', 'The venue has a reception area.',
    'pt', 'O salão possui recepção.'
  ),
  'reception',
  ARRAY['EventVenue']::public."PropertyType"[],
  300
);

ALTER TABLE public."Amenities"
  ADD COLUMN IF NOT EXISTS "Key" text;

UPDATE public."Amenities" a
SET "Key" = x.key
FROM (
  VALUES
    ('wifi', 'wifi'),
    ('snowflake', 'air_conditioning'),
    ('thermometer', 'heating'),
    ('car', 'parking'),
    ('shield', 'cctv'),
    ('accessibility', 'wheelchair_access'),
    ('waves', 'sea_view'),
    ('mountain', 'mountain_view'),
    ('building', 'city_view'),
    ('pool', 'pool'),
    ('leaf', 'garden'),
    ('balcony', 'balcony'),
    ('sun', 'terrace'),
    ('grill', 'grill'),
    ('sofa', 'furnished'),
    ('washing-machine', 'laundry'),
    ('flame', 'fireplace'),
    ('pets-allowed', 'pets_allowed'),
    ('paw', 'pet_friendly'),
    ('elevator', 'elevator'),
    ('archive', 'storage'),
    ('sun-electric', 'solar_panels'),
    ('battery', 'backup_generator'),
    ('cpu', 'smart_home'),
    ('garage', 'private_parking'),
    ('gate', 'gated_community'),
    ('user-shield', 'concierge_24h'),
    ('baby', 'playground'),
    ('briefcase', 'conference_room'),
    ('reception', 'reception')
) AS x(icon, key)
WHERE a."IconId" = x.icon
  AND a."Key" IS NULL;

INSERT INTO public."Amenities" ("Id", "Name", "IconId", "IsDeleted", "PropertyType", "Key")
SELECT
  gen_random_uuid(),
  coalesce(t."LocalizedName"->>'es', t."Key"),
  t."IconId",
  false,
  pt,
  t."Key"
FROM public."AmenityTemplate" t
CROSS JOIN LATERAL unnest(t."PropertyTypes") AS pt
WHERE NOT EXISTS (
  SELECT 1
  FROM public."Amenities" a
  WHERE a."Key" = t."Key"
    AND a."PropertyType" = pt
    AND a."IsDeleted" = false
);

UPDATE public."Amenities" a
SET "IsDeleted" = true
WHERE a."Key" IS NOT NULL
  AND a."IsDeleted" = false
  AND EXISTS (
    SELECT 1
    FROM public."Amenities" b
    WHERE b."Key" = a."Key"
      AND b."PropertyType" = a."PropertyType"
      AND b."IsDeleted" = false
      AND b."Id" < a."Id"
  );

ALTER TABLE public."Amenities"
  ADD CONSTRAINT amenities_key_fk
  FOREIGN KEY ("Key") REFERENCES public."AmenityTemplate"("Key");

CREATE UNIQUE INDEX IF NOT EXISTS amenities_key_property_type_uidx
  ON public."Amenities" ("Key", "PropertyType")
  WHERE "Key" IS NOT NULL AND "IsDeleted" = false;

ALTER TABLE public."EstatePropertyAmenity"
  ADD COLUMN IF NOT EXISTS "SlotValues" jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public."EstatePropertyAmenity"
SET "LocalizedDescriptions" = '{}'::jsonb
WHERE coalesce("LocalizedDescriptions", '{}'::jsonb) <> '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.resolved_amenity_localized_name(p_key text, p_fallback_name text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_key IS NULL THEN
      CASE
        WHEN nullif(trim(both from coalesce(p_fallback_name, '')), '') IS NULL THEN '{}'::jsonb
        ELSE jsonb_build_object('es', p_fallback_name)
      END
    ELSE coalesce(
      (
        SELECT public.sanitize_localized_text_json(t."LocalizedName")
        FROM public."AmenityTemplate" t
        WHERE t."Key" = p_key
      ),
      '{}'::jsonb
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.resolved_amenity_localized_description(
  p_key text,
  p_slot_values jsonb,
  p_custom jsonb
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.sanitize_amenity_localized_descriptions(p_custom) <> '{}'::jsonb THEN
      public.sanitize_amenity_localized_descriptions(p_custom)
    WHEN p_key IS NULL THEN '{}'::jsonb
    ELSE public.interpolate_localized_text(
      (
        SELECT t."LocalizedDescription"
        FROM public."AmenityTemplate" t
        WHERE t."Key" = p_key
      ),
      coalesce(p_slot_values, '{}'::jsonb)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.estate_property_amenity_property_types(p_property_id uuid)
RETURNS SETOF public."PropertyType"
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT x.pt
  FROM (
    SELECT public.listing_type_to_section_property_type(l."ListingType") AS pt
    FROM public."Listings" l
    WHERE l."EstatePropertyId" = p_property_id
      AND l."IsDeleted" = false
    UNION
    SELECT 'RealEstate'::public."PropertyType"
    WHERE EXISTS (
      SELECT 1 FROM public."RealEstateExtension" r WHERE r."EstatePropertyId" = p_property_id
    )
    UNION
    SELECT 'SummerRent'::public."PropertyType"
    WHERE EXISTS (
      SELECT 1 FROM public."SummerRentExtension" s WHERE s."EstatePropertyId" = p_property_id
    )
    UNION
    SELECT 'EventVenue'::public."PropertyType"
    WHERE EXISTS (
      SELECT 1 FROM public."EventVenueExtension" e WHERE e."EstatePropertyId" = p_property_id
    )
  ) x
  WHERE x.pt IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.build_property_amenities_json(p_estate_property_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_agg(item ORDER BY display_order, name)
      FROM (
        SELECT DISTINCT ON (a."Key")
          jsonb_strip_nulls(
            jsonb_build_object(
              'id', a."Id",
              'key', a."Key",
              'name', coalesce(public.resolved_amenity_localized_name(a."Key", a."Name")->>'es', a."Name"),
              'iconId', coalesce(t."IconId", a."IconId"),
              'localizedName', public.resolved_amenity_localized_name(a."Key", a."Name"),
              'descriptions',
                CASE
                  WHEN public.resolved_amenity_localized_description(
                    a."Key", epa."SlotValues", epa."LocalizedDescriptions"
                  ) = '{}'::jsonb THEN NULL
                  ELSE public.resolved_amenity_localized_description(
                    a."Key", epa."SlotValues", epa."LocalizedDescriptions"
                  )
                END
            )
          ) AS item,
          coalesce(t."DisplayOrder", 0) AS display_order,
          a."Name" AS name
        FROM public."EstatePropertyAmenity" epa
        JOIN public."Amenities" a
          ON a."Id" = epa."AmenityId"
         AND a."IsDeleted" = false
        LEFT JOIN public."AmenityTemplate" t
          ON t."Key" = a."Key"
        WHERE epa."EstatePropertyId" = p_estate_property_id
          AND coalesce(epa."DeletedAtUtc", 'infinity'::timestamptz) > now()
        ORDER BY
          a."Key",
          CASE
            WHEN public.sanitize_amenity_localized_descriptions(epa."LocalizedDescriptions") <> '{}'::jsonb THEN 0
            ELSE 1
          END,
          coalesce(t."DisplayOrder", 0)
      ) ranked
    ),
    '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.replace_estate_property_amenities(p_property_id uuid, p_links jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := public.is_admin();
  v_link jsonb;
  v_key text;
  v_descriptions jsonb;
  v_slots jsonb;
  v_amenity_id uuid;
  v_keep_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'p_property_id is required';
  END IF;

  IF NOT public.user_can_manage_estate_property(p_property_id) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado para actualizar servicios.';
  END IF;

  IF p_links IS NULL
     OR jsonb_typeof(p_links) <> 'array'
     OR jsonb_array_length(p_links) = 0 THEN
    DELETE FROM public."EstatePropertyAmenity"
    WHERE "EstatePropertyId" = p_property_id;
    RETURN;
  END IF;

  FOR v_link IN SELECT * FROM jsonb_array_elements(p_links)
  LOOP
    v_key := nullif(trim(both FROM coalesce(v_link->>'key', v_link->>'templateKey', '')), '');
    IF v_key IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public."AmenityTemplate" t WHERE t."Key" = v_key AND t."Archived" = false) THEN
      RAISE EXCEPTION 'La plantilla de servicio % no existe.', v_key;
    END IF;

    v_descriptions := public.sanitize_amenity_localized_descriptions(
      coalesce(v_link->'descriptions', '{}'::jsonb)
    );
    IF v_descriptions <> '{}'::jsonb AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo un administrador puede agregar descripciones personalizadas de servicios.';
    END IF;

    v_slots := coalesce(v_link->'slotValues', v_link->'slot_values', '{}'::jsonb);
    IF jsonb_typeof(v_slots) <> 'object' THEN
      v_slots := '{}'::jsonb;
    END IF;

    FOR v_amenity_id IN
      SELECT a."Id"
      FROM public."Amenities" a
      JOIN public."AmenityTemplate" t ON t."Key" = a."Key"
      WHERE a."Key" = v_key
        AND a."IsDeleted" = false
        AND a."PropertyType" IN (SELECT public.estate_property_amenity_property_types(p_property_id))
        AND a."PropertyType" = ANY (t."PropertyTypes")
    LOOP
      INSERT INTO public."EstatePropertyAmenity" (
        "EstatePropertyId",
        "AmenityId",
        "LocalizedDescriptions",
        "SlotValues",
        "CreatedAtUtc",
        "DeletedAtUtc"
      ) VALUES (
        p_property_id,
        v_amenity_id,
        v_descriptions,
        v_slots,
        now(),
        NULL
      )
      ON CONFLICT ("EstatePropertyId", "AmenityId") DO UPDATE
      SET
        "LocalizedDescriptions" = EXCLUDED."LocalizedDescriptions",
        "SlotValues" = EXCLUDED."SlotValues",
        "DeletedAtUtc" = NULL;

      v_keep_ids := array_append(v_keep_ids, v_amenity_id);
    END LOOP;
  END LOOP;

  DELETE FROM public."EstatePropertyAmenity"
  WHERE "EstatePropertyId" = p_property_id
    AND NOT ("AmenityId" = ANY (v_keep_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_estate_property_editor_content(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_policies jsonb;
  v_sections jsonb;
  v_amenity_editor jsonb;
BEGIN
  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'p_property_id is required';
  END IF;

  IF NOT public.user_can_manage_estate_property(p_property_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT coalesce(
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
      ORDER BY epp."DisplayOrder", epp."Created"
    ),
    '[]'::jsonb
  )
  INTO v_policies
  FROM public."EstatePropertyPolicy" epp
  WHERE epp."EstatePropertyId" = p_property_id
    AND epp."IsDeleted" = false;

  SELECT coalesce(
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
            SELECT jsonb_agg(psi.propertyimageid ORDER BY psi.displayorder)
            FROM public.propertysectionimages psi
            WHERE psi.sectionid = s.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY s.displayorder, s.createdat
    ),
    '[]'::jsonb
  )
  INTO v_sections
  FROM public.propertydetailssection s
  WHERE s.propertyid = p_property_id
    AND s.isdeleted = false;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', ranked.key,
        'descriptions', ranked.descriptions
      )
      ORDER BY ranked.display_order, ranked.key
    ),
    '[]'::jsonb
  )
  INTO v_amenity_editor
  FROM (
    SELECT DISTINCT ON (a."Key")
      a."Key" AS key,
      public.sanitize_amenity_localized_descriptions(epa."LocalizedDescriptions") AS descriptions,
      coalesce(t."DisplayOrder", 0) AS display_order
    FROM public."EstatePropertyAmenity" epa
    JOIN public."Amenities" a
      ON a."Id" = epa."AmenityId"
     AND a."IsDeleted" = false
    LEFT JOIN public."AmenityTemplate" t
      ON t."Key" = a."Key"
    WHERE epa."EstatePropertyId" = p_property_id
      AND coalesce(epa."DeletedAtUtc", 'infinity'::timestamptz) > now()
      AND a."Key" IS NOT NULL
    ORDER BY
      a."Key",
      CASE
        WHEN public.sanitize_amenity_localized_descriptions(epa."LocalizedDescriptions") <> '{}'::jsonb THEN 0
        ELSE 1
      END
  ) ranked;

  RETURN jsonb_build_object(
    'policies', v_policies,
    'contentSections', v_sections,
    'amenityEditor', coalesce(v_amenity_editor, '[]'::jsonb),
    'amenities', public.build_property_amenities_json(p_property_id)
  );
END;
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
DECLARE
  v_listing_type public."ListingType";
  v_property_type public."PropertyType";
BEGIN
  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'p_property_id is required';
  END IF;

  IF NOT public.is_public_estate_property(p_property_id) THEN
    RETURN jsonb_build_object(
      'policies', '[]'::jsonb,
      'contentSections', '[]'::jsonb,
      'amenities', '[]'::jsonb
    );
  END IF;

  v_listing_type := p_listing_type;
  IF v_listing_type IS NULL THEN
    SELECT l."ListingType"
      INTO v_listing_type
    FROM public."Listings" l
    WHERE l."EstatePropertyId" = p_property_id
      AND l."IsDeleted" = false
      AND l."IsActive" = true
      AND l."IsPropertyVisible" = true
    ORDER BY l."IsFeatured" DESC, l."Created" DESC
    LIMIT 1;
  END IF;

  IF v_listing_type IS NULL THEN
    RETURN jsonb_build_object(
      'policies', '[]'::jsonb,
      'contentSections', '[]'::jsonb,
      'amenities', '[]'::jsonb
    );
  END IF;

  v_property_type := public.listing_type_to_section_property_type(v_listing_type);

  RETURN jsonb_build_object(
    'policies', public.build_property_policies_json(p_property_id, v_listing_type),
    'contentSections', public.build_property_content_sections_json(p_property_id, v_property_type),
    'amenities', public.build_property_amenities_json(p_property_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolved_amenity_localized_name(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolved_amenity_localized_description(text, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.estate_property_amenity_property_types(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.build_property_amenities_json(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_estate_property_amenities(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_estate_property_editor_content(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_property_content(uuid, public."ListingType") TO anon, authenticated, service_role;
