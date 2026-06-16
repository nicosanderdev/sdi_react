-- Portal property search: PropertySearchScores, AppParameters seeds, scoring + search RPCs.
-- Apply manually. Idempotent where possible.

begin;

-- -----------------------------------------------------------------------------
-- PropertySearchScores
-- -----------------------------------------------------------------------------
create table if not exists public."PropertySearchScores" (
  "EstatePropertyId" uuid not null references public."EstateProperties" ("Id") on delete cascade,
  "ListingType" text not null
    check ("ListingType" in ('SummerRent', 'EventVenue')),
  "ListingId" uuid null references public."Listings" ("Id") on delete set null,
  "Scores" jsonb not null default '{}'::jsonb,
  "Metrics" jsonb not null default '{}'::jsonb,
  "ComputedAt" timestamptz not null default now(),
  primary key ("EstatePropertyId", "ListingType")
);

create index if not exists "IX_PropertySearchScores_ListingType"
  on public."PropertySearchScores" ("ListingType");

create index if not exists "IX_PropertySearchScores_ComputedAt"
  on public."PropertySearchScores" ("ComputedAt" desc);

comment on table public."PropertySearchScores" is
  'Daily precomputed search ranking components per property and guest listing type.';

alter table public."PropertySearchScores" enable row level security;

drop policy if exists "PropertySearchScores_select_all" on public."PropertySearchScores";
create policy "PropertySearchScores_select_all"
  on public."PropertySearchScores"
  for select
  to authenticated, anon
  using (true);

drop policy if exists "PropertySearchScores_write_service" on public."PropertySearchScores";
create policy "PropertySearchScores_write_service"
  on public."PropertySearchScores"
  for all
  to service_role
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- Seed SEARCH_* AppParameters (global)
-- -----------------------------------------------------------------------------
insert into public."AppParameters" ("Name", "ParameterType", "Value", "SiteScope", "Description")
values
  ('SEARCH_SCORE_WEIGHTS', 'json', '{"quality": 0.25, "engagement": 0.20, "reputation": 0.30, "freshness": 0.15, "exploration": 0.10}'::jsonb, 'global', 'Weights for offline score components'),
  ('SEARCH_ONLINE_WEIGHTS', 'json', '{"availability": 0.15, "distance": 0.10}'::jsonb, 'global', 'Weights for online boosts (client-side mix)'),
  ('SEARCH_CANDIDATE_POOL_SIZE', 'number', '500'::jsonb, 'global', 'Max candidates returned by portal_search_properties'),
  ('SEARCH_CRON_BATCH_SIZE', 'number', '100'::jsonb, 'global', 'Properties per cron batch'),
  ('SEARCH_QUALITY_WEIGHTS', 'json', '{"image": 0.55, "description": 0.45}'::jsonb, 'global', 'Quality sub-weights'),
  ('SEARCH_IMAGE_RULES', 'json', '{"minCount": 3, "idealCount": 12, "requireMain": true, "minPublicRatio": 0.8}'::jsonb, 'global', 'Image quality rules'),
  ('SEARCH_DESCRIPTION_RULES', 'json', '{"minLength": 120, "idealLength": 600, "maxRepeatRatio": 0.35}'::jsonb, 'global', 'Description quality rules'),
  ('SEARCH_ENGAGEMENT_LOOKBACK_DAYS', 'number', '90'::jsonb, 'global', 'Engagement signal lookback'),
  ('SEARCH_ENGAGEMENT_WEIGHTS', 'json', '{"views": 0.35, "messages": 0.25, "bookings": 0.30, "holds": 0.10}'::jsonb, 'global', 'Engagement signal weights'),
  ('SEARCH_ENGAGEMENT_NORMALIZE', 'json', '{"views": 500, "messages": 50, "bookings": 30, "holds": 40}'::jsonb, 'global', 'Log-normalization caps per signal'),
  ('SEARCH_REPUTATION_WEIGHTS', 'json', '{"avgRating": 0.40, "reviewCount": 0.15, "ownerTenure": 0.15, "completedBookings": 0.15, "bookingCompletionRatio": 0.15}'::jsonb, 'global', 'Reputation sub-weights'),
  ('SEARCH_REPUTATION_NORMALIZE', 'json', '{"ownerTenureDays": 1825, "completedBookings": 50, "reviewCount": 25}'::jsonb, 'global', 'Reputation normalization caps'),
  ('SEARCH_FRESHNESS_HALF_LIFE_DAYS', 'number', '90'::jsonb, 'global', 'Freshness decay half-life in days'),
  ('SEARCH_EXPLORATION_NEW_LISTING_DAYS', 'number', '30'::jsonb, 'global', 'Days listing counts as new for exploration boost'),
  ('SEARCH_EXPLORATION_BOOST_MAX', 'number', '15'::jsonb, 'global', 'Max exploration boost points (0-100 scale)'),
  ('SEARCH_DIVERSITY_RULES', 'json', '{"maxPerOwner": 2, "maxPerCity": 5, "geoGridKm": 2, "maxPerCell": 3}'::jsonb, 'global', 'Client diversity caps'),
  ('SEARCH_RANDOMNESS', 'json', '{"enabled": true, "strength": 0.08, "seedTtlMinutes": 30}'::jsonb, 'global', 'Client randomness settings')
on conflict ("Name", "SiteScope") do nothing;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.search_param_num(
  p_params jsonb,
  p_key text,
  p_default numeric default 0
)
returns numeric
language sql
immutable
as $$
  select coalesce(
    case jsonb_typeof(p_params -> p_key)
      when 'number' then (p_params ->> p_key)::numeric
      when 'string' then nullif(trim(p_params ->> p_key), '')::numeric
      else null
    end,
    p_default
  );
$$;

create or replace function public.search_normalize_log(
  p_count bigint,
  p_cap numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_cap, 0) <= 0 then 0
    when coalesce(p_count, 0) <= 0 then 0
    else least(
      100,
      greatest(
        0,
        (ln(1 + p_count::numeric) / ln(1 + p_cap)) * 100
      )
    )
  end;
$$;

create or replace function public.search_param_json(
  p_params jsonb,
  p_key text,
  p_default jsonb default '{}'::jsonb
)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    case
      when jsonb_typeof(p_params -> p_key) = 'object' then p_params -> p_key
      else null
    end,
    p_default
  );
$$;

-- -----------------------------------------------------------------------------
-- compute_property_search_scores
-- -----------------------------------------------------------------------------
create or replace function public.compute_property_search_scores(
  p_estate_property_id uuid,
  p_listing_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_type text;
  v_site_scope text;
  v_params jsonb;
  v_listing record;
  v_quality_weights jsonb;
  v_image_rules jsonb;
  v_desc_rules jsonb;
  v_eng_weights jsonb;
  v_eng_norm jsonb;
  v_rep_weights jsonb;
  v_rep_norm jsonb;
  v_score_weights jsonb;
  v_lookback_days int;
  v_half_life numeric;
  v_new_listing_days int;
  v_exploration_max numeric;
  v_image_count int;
  v_public_count int;
  v_has_main boolean;
  v_distinct_urls int;
  v_image_score numeric := 0;
  v_desc_len int;
  v_desc_text text;
  v_word_count int;
  v_unique_words int;
  v_repeat_ratio numeric;
  v_desc_score numeric := 0;
  v_quality_score numeric := 0;
  v_views bigint := 0;
  v_messages bigint := 0;
  v_bookings bigint := 0;
  v_holds bigint := 0;
  v_engagement_score numeric := 0;
  v_avg_rating numeric;
  v_review_count int := 0;
  v_global_avg_rating numeric := 4.0;
  v_rating_score numeric := 0;
  v_review_count_score numeric := 0;
  v_owner_tenure_days numeric := 0;
  v_owner_tenure_score numeric := 0;
  v_completed_bookings int := 0;
  v_cancelled_bookings int := 0;
  v_completion_ratio numeric := 0;
  v_completion_score numeric := 0;
  v_completed_score numeric := 0;
  v_reputation_score numeric := 0;
  v_freshness_score numeric := 0;
  v_exploration_boost numeric := 0;
  v_listing_age_days numeric;
  v_offline_base numeric := 0;
  v_scores jsonb;
  v_metrics jsonb;
  v_since timestamptz;
begin
  if p_estate_property_id is null then
    raise exception 'estate_property_id is required';
  end if;

  v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
  if v_listing_type not in ('SummerRent', 'EventVenue') then
    raise exception 'Listing type % not supported for search scoring', v_listing_type;
  end if;

  v_site_scope := v_listing_type;
  v_params := public.get_app_parameters(v_site_scope);

  select
    l."Id",
    l."Title",
    l."Description",
    l."Created",
    l."LastModified",
    ep."OwnerId",
    ep."Created" as ep_created
  into v_listing
  from public."Listings" l
  join public."EstateProperties" ep on ep."Id" = l."EstatePropertyId"
  where l."EstatePropertyId" = p_estate_property_id
    and l."ListingType"::text = v_listing_type
    and l."IsDeleted" = false
    and l."IsActive" = true
    and l."IsPropertyVisible" = true
    and ep."IsDeleted" = false
  order by l."IsFeatured" desc nulls last, l."Created" desc
  limit 1;

  if v_listing."Id" is null then
    delete from public."PropertySearchScores"
    where "EstatePropertyId" = p_estate_property_id
      and "ListingType" = v_listing_type;
    return jsonb_build_object('skipped', true, 'reason', 'no_active_listing');
  end if;

  v_quality_weights := public.search_param_json(v_params, 'SEARCH_QUALITY_WEIGHTS', '{"image": 0.55, "description": 0.45}'::jsonb);
  v_image_rules := public.search_param_json(v_params, 'SEARCH_IMAGE_RULES');
  v_desc_rules := public.search_param_json(v_params, 'SEARCH_DESCRIPTION_RULES');
  v_eng_weights := public.search_param_json(v_params, 'SEARCH_ENGAGEMENT_WEIGHTS');
  v_eng_norm := public.search_param_json(v_params, 'SEARCH_ENGAGEMENT_NORMALIZE');
  v_rep_weights := public.search_param_json(v_params, 'SEARCH_REPUTATION_WEIGHTS');
  v_rep_norm := public.search_param_json(v_params, 'SEARCH_REPUTATION_NORMALIZE');
  v_score_weights := public.search_param_json(v_params, 'SEARCH_SCORE_WEIGHTS');
  v_lookback_days := coalesce(public.search_param_num(v_params, 'SEARCH_ENGAGEMENT_LOOKBACK_DAYS', 90)::int, 90);
  v_half_life := public.search_param_num(v_params, 'SEARCH_FRESHNESS_HALF_LIFE_DAYS', 90);
  v_new_listing_days := coalesce(public.search_param_num(v_params, 'SEARCH_EXPLORATION_NEW_LISTING_DAYS', 30)::int, 30);
  v_exploration_max := public.search_param_num(v_params, 'SEARCH_EXPLORATION_BOOST_MAX', 15);
  v_since := now() - make_interval(days => v_lookback_days);

  -- Images (PropertyImages has no IsPublic on this schema; all active images count as public)
  select
    count(*)::int,
    count(*)::int,
    bool_or(pi."IsMain" = true),
    count(distinct lower(trim(pi."Url")))
  into v_image_count, v_public_count, v_has_main, v_distinct_urls
  from public."PropertyImages" pi
  where pi."EstatePropertyId" = p_estate_property_id
    and pi."IsDeleted" = false;

  v_image_score := least(100, greatest(0,
    (v_image_count::numeric / nullif(public.search_param_num(v_image_rules, 'idealCount', 12), 0)) * 70
    + case when v_has_main or not coalesce((v_image_rules ->> 'requireMain')::boolean, true) then 15 else 0 end
    + case
        when v_image_count > 0 then
          (v_public_count::numeric / v_image_count)
          * 15
          * case when (v_public_count::numeric / v_image_count) >= public.search_param_num(v_image_rules, 'minPublicRatio', 0.8) then 1 else 0.5 end
        else 0
      end
    - case when v_image_count > 0 and v_distinct_urls < v_image_count then 10 else 0 end
  ));

  if v_image_count < public.search_param_num(v_image_rules, 'minCount', 3)::int then
    v_image_score := v_image_score * 0.6;
  end if;

  -- Description
  v_desc_text := coalesce(trim(v_listing."Description"), '');
  v_desc_len := length(v_desc_text);

  select
    coalesce(array_length(regexp_split_to_array(lower(v_desc_text), '\s+'), 1), 0),
    coalesce((
      select count(distinct w)
      from unnest(regexp_split_to_array(lower(v_desc_text), '\s+')) as w
      where length(w) > 1
    ), 0)
  into v_word_count, v_unique_words;

  v_repeat_ratio := case
    when v_word_count <= 0 then 1
    else 1 - (v_unique_words::numeric / v_word_count)
  end;

  v_desc_score := least(100, greatest(0,
    (v_desc_len::numeric / nullif(public.search_param_num(v_desc_rules, 'idealLength', 600), 0)) * 100
  ));

  if v_desc_len < public.search_param_num(v_desc_rules, 'minLength', 120) then
    v_desc_score := v_desc_score * 0.5;
  end if;

  if v_repeat_ratio > public.search_param_num(v_desc_rules, 'maxRepeatRatio', 0.35) then
    v_desc_score := v_desc_score * (1 - least(0.5, v_repeat_ratio - 0.35));
  end if;

  v_quality_score := round(
    v_image_score * public.search_param_num(v_quality_weights, 'image', 0.55)
    + v_desc_score * public.search_param_num(v_quality_weights, 'description', 0.45),
    2
  );

  -- Engagement
  if to_regclass('public."PropertyVisitLogs"') is not null then
    select count(*) into v_views
    from public."PropertyVisitLogs" pvl
    where pvl."PropertyId" = p_estate_property_id
      and pvl."VisitedOnUtc" >= v_since;
  end if;

  if to_regclass('public."PropertyMessageLogs"') is not null then
    select count(*) into v_messages
    from public."PropertyMessageLogs" pml
    where pml."PropertyId" = p_estate_property_id
      and pml."SentOnUtc" >= v_since;
  end if;

  select count(*) into v_bookings
  from public."Bookings" b
  where b."EstatePropertyId" = p_estate_property_id
    and b."IsDeleted" = false
    and b."Status" <> 2
    and b."Created" >= v_since
    and (
      b."ListingType" is null
      or b."ListingType"::text = v_listing_type
    );

  if to_regclass('public.booking_holds') is not null then
    select count(*) into v_holds
    from public.booking_holds h
    where h.property_id = p_estate_property_id
      and h.check_in >= (current_date - v_lookback_days)
      and (h.listing_type is null or h.listing_type = v_listing_type);
  end if;

  v_engagement_score := round(
    public.search_normalize_log(v_views, public.search_param_num(v_eng_norm, 'views', 500))
      * public.search_param_num(v_eng_weights, 'views', 0.35)
    + public.search_normalize_log(v_messages, public.search_param_num(v_eng_norm, 'messages', 50))
      * public.search_param_num(v_eng_weights, 'messages', 0.25)
    + public.search_normalize_log(v_bookings, public.search_param_num(v_eng_norm, 'bookings', 30))
      * public.search_param_num(v_eng_weights, 'bookings', 0.30)
    + public.search_normalize_log(v_holds, public.search_param_num(v_eng_norm, 'holds', 40))
      * public.search_param_num(v_eng_weights, 'holds', 0.10),
    2
  );

  -- Reputation
  select
    avg(r."Rating")::numeric,
    count(*)::int
  into v_avg_rating, v_review_count
  from public."Reviews" r
  where r."EstatePropertyId" = p_estate_property_id
    and r."ListingType"::text = v_listing_type;

  select coalesce(avg(r."Rating"), 4.0) into v_global_avg_rating
  from public."Reviews" r
  where r."ListingType"::text = v_listing_type;

  v_rating_score := case
    when v_review_count = 0 then v_global_avg_rating * 20
    else ((v_review_count * v_avg_rating + 5 * v_global_avg_rating) / (v_review_count + 5)) * 20
  end;

  v_review_count_score := public.search_normalize_log(
    v_review_count,
    public.search_param_num(v_rep_norm, 'reviewCount', 25)
  );

  select coalesce(
    extract(day from (now() - coalesce(v_listing.ep_created, v_listing."Created"))),
    0
  )
  into v_owner_tenure_days;

  v_owner_tenure_score := public.search_normalize_log(
    v_owner_tenure_days::bigint,
    public.search_param_num(v_rep_norm, 'ownerTenureDays', 1825)
  );

  select
    count(*) filter (where b."Status" = 3),
    count(*) filter (where b."Status" = 2)
  into v_completed_bookings, v_cancelled_bookings
  from public."Bookings" b
  where b."EstatePropertyId" = p_estate_property_id
    and b."IsDeleted" = false
    and b."Created" >= v_since
    and (b."ListingType" is null or b."ListingType"::text = v_listing_type);

  v_completion_ratio := case
    when (v_completed_bookings + v_cancelled_bookings) = 0 then 0.5
    else v_completed_bookings::numeric / (v_completed_bookings + v_cancelled_bookings)
  end;

  v_completion_score := v_completion_ratio * 100;
  v_completed_score := public.search_normalize_log(
    v_completed_bookings,
    public.search_param_num(v_rep_norm, 'completedBookings', 50)
  );

  v_reputation_score := round(
    v_rating_score * public.search_param_num(v_rep_weights, 'avgRating', 0.40)
    + v_review_count_score * public.search_param_num(v_rep_weights, 'reviewCount', 0.15)
    + v_owner_tenure_score * public.search_param_num(v_rep_weights, 'ownerTenure', 0.15)
    + v_completed_score * public.search_param_num(v_rep_weights, 'completedBookings', 0.15)
    + v_completion_score * public.search_param_num(v_rep_weights, 'bookingCompletionRatio', 0.15),
    2
  );

  -- Freshness + exploration
  v_listing_age_days := greatest(0, extract(day from (now() - coalesce(v_listing."LastModified", v_listing."Created"))));

  v_freshness_score := round(
    100 * power(0.5, v_listing_age_days / nullif(v_half_life, 1)),
    2
  );

  if v_listing_age_days <= v_new_listing_days then
    v_exploration_boost := round(
      v_exploration_max * (1 - (v_listing_age_days / v_new_listing_days)),
      2
    );
  end if;

  v_offline_base := round(
    v_quality_score * public.search_param_num(v_score_weights, 'quality', 0.25)
    + v_engagement_score * public.search_param_num(v_score_weights, 'engagement', 0.20)
    + v_reputation_score * public.search_param_num(v_score_weights, 'reputation', 0.30)
    + v_freshness_score * public.search_param_num(v_score_weights, 'freshness', 0.15)
    + v_exploration_boost * public.search_param_num(v_score_weights, 'exploration', 0.10),
    2
  );

  v_scores := jsonb_build_object(
    'quality_score', v_quality_score,
    'engagement_score', v_engagement_score,
    'reputation_score', v_reputation_score,
    'freshness_score', v_freshness_score,
    'exploration_boost', v_exploration_boost,
    'offline_base_score', v_offline_base
  );

  v_metrics := jsonb_build_object(
    'imageCount', v_image_count,
    'publicImageCount', v_public_count,
    'hasMainImage', v_has_main,
    'distinctImageUrls', v_distinct_urls,
    'descriptionLength', v_desc_len,
    'descriptionRepeatRatio', round(v_repeat_ratio, 4),
    'views', v_views,
    'messages', v_messages,
    'bookings', v_bookings,
    'holds', v_holds,
    'avgRating', v_avg_rating,
    'reviewCount', v_review_count,
    'ownerTenureDays', v_owner_tenure_days,
    'completedBookings', v_completed_bookings,
    'cancelledBookings', v_cancelled_bookings,
    'listingAgeDays', v_listing_age_days
  );

  insert into public."PropertySearchScores" (
    "EstatePropertyId",
    "ListingType",
    "ListingId",
    "Scores",
    "Metrics",
    "ComputedAt"
  )
  values (
    p_estate_property_id,
    v_listing_type,
    v_listing."Id",
    v_scores,
    v_metrics,
    now()
  )
  on conflict ("EstatePropertyId", "ListingType") do update
  set
    "ListingId" = excluded."ListingId",
    "Scores" = excluded."Scores",
    "Metrics" = excluded."Metrics",
    "ComputedAt" = excluded."ComputedAt";

  return jsonb_build_object('success', true, 'scores', v_scores, 'metrics', v_metrics);
end;
$$;

grant execute on function public.compute_property_search_scores(uuid, text)
  to service_role, authenticated;

-- -----------------------------------------------------------------------------
-- cron_property_search_scores_batch
-- -----------------------------------------------------------------------------
create or replace function public.cron_property_search_scores_batch(
  p_offset integer default 0,
  p_limit integer default 100
)
returns table (
  estate_property_id uuid,
  listing_type text
)
language sql
stable
security definer
set search_path = public
as $$
  with featured_listings as (
    select distinct on (l."EstatePropertyId", l."ListingType")
      l."EstatePropertyId",
      l."ListingType"::text as listing_type
    from public."Listings" l
    join public."EstateProperties" ep on ep."Id" = l."EstatePropertyId"
    where l."IsDeleted" = false
      and l."IsActive" = true
      and l."IsPropertyVisible" = true
      and ep."IsDeleted" = false
      and l."ListingType"::text in ('SummerRent', 'EventVenue')
    order by l."EstatePropertyId", l."ListingType", l."IsFeatured" desc nulls last, l."Created" desc
  )
  select fl."EstatePropertyId", fl.listing_type
  from featured_listings fl
  order by fl."EstatePropertyId", fl.listing_type
  offset greatest(p_offset, 0)
  limit greatest(p_limit, 1);
$$;

grant execute on function public.cron_property_search_scores_batch(integer, integer)
  to service_role;

-- -----------------------------------------------------------------------------
-- get_property_search_scores
-- -----------------------------------------------------------------------------
create or replace function public.get_property_search_scores(
  p_property_ids uuid[],
  p_listing_type text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing_type text;
begin
  v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'estatePropertyId', pss."EstatePropertyId",
          'listingType', pss."ListingType",
          'listingId', pss."ListingId",
          'scores', pss."Scores",
          'metrics', pss."Metrics",
          'computedAt', pss."ComputedAt"
        )
      )
      from public."PropertySearchScores" pss
      where pss."ListingType" = v_listing_type
        and pss."EstatePropertyId" = any(p_property_ids)
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_property_search_scores(uuid[], text)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- portal_search_properties
-- -----------------------------------------------------------------------------
create or replace function public.portal_search_properties(
  p_listing_type text,
  p_site_scope text default null,
  p_sw_lat numeric default null,
  p_ne_lat numeric default null,
  p_sw_lng numeric default null,
  p_ne_lng numeric default null,
  p_city text default null,
  p_search_text text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_bedrooms_min integer default null,
  p_capacity_min integer default null,
  p_amenity_ids uuid[] default null,
  p_check_in date default null,
  p_check_out date default null,
  p_center_lat numeric default null,
  p_center_lng numeric default null,
  p_limit integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing_type text;
  v_site_scope text;
  v_params jsonb;
  v_pool_size int;
  v_check_in_ts timestamptz;
  v_check_out_ts timestamptz;
  v_has_dates boolean;
  v_result jsonb;
begin
  v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
  v_site_scope := coalesce(nullif(trim(p_site_scope), ''), v_listing_type);
  v_params := public.get_app_parameters(v_site_scope);
  v_pool_size := coalesce(
    p_limit,
    public.search_param_num(v_params, 'SEARCH_CANDIDATE_POOL_SIZE', 500)::int
  );
  v_has_dates := p_check_in is not null and p_check_out is not null
    and p_check_in < p_check_out;

  if v_has_dates then
    v_check_in_ts := p_check_in::timestamptz;
    v_check_out_ts := p_check_out::timestamptz;
  end if;

  with featured_listing as (
    select distinct on (l."EstatePropertyId")
      l."Id" as listing_id,
      l."EstatePropertyId",
      l."ListingType"::text as listing_type,
      l."Title",
      l."Description",
      l."RentPrice",
      l."BasePrice",
      l."Currency",
      l."Capacity" as listing_capacity,
      l."BlockedForBooking"
    from public."Listings" l
    where l."IsDeleted" = false
      and l."IsActive" = true
      and l."IsPropertyVisible" = true
      and l."ListingType"::text = v_listing_type
    order by l."EstatePropertyId", l."IsFeatured" desc nulls last, l."Created" desc
  ),
  base as (
    select
      ep."Id" as estate_property_id,
      fl.listing_id,
      fl.listing_type,
      fl."Title" as title,
      fl."Description" as description,
      coalesce(fl."BasePrice", fl."RentPrice") as display_price,
      fl."Currency" as currency,
      ep."City" as city,
      ep."State" as state,
      ep."Country" as country,
      ep."Neighborhood" as neighborhood,
      ep."Bedrooms" as bedrooms,
      ep."Bathrooms" as bathrooms,
      ep."Capacity" as capacity,
      ep."OwnerId" as owner_id,
      ep."LocationLatitude" as lat,
      ep."LocationLongitude" as lng,
      ep."AreaValue" as area_value,
      ep."AreaUnit" as area_unit,
      fl."BlockedForBooking" as blocked_for_booking,
      coalesce(pss."Scores", '{}'::jsonb) as scores,
      coalesce((pss."Scores" ->> 'offline_base_score')::numeric, 0) as offline_base_score
    from public."EstateProperties" ep
    join featured_listing fl on fl."EstatePropertyId" = ep."Id"
    left join public."PropertySearchScores" pss
      on pss."EstatePropertyId" = ep."Id"
     and pss."ListingType" = v_listing_type
    where ep."IsDeleted" = false
      and (p_sw_lat is null or ep."LocationLatitude" between least(p_sw_lat, p_ne_lat) and greatest(p_sw_lat, p_ne_lat))
      and (p_sw_lng is null or ep."LocationLongitude" between least(p_sw_lng, p_ne_lng) and greatest(p_sw_lng, p_ne_lng))
      and (p_city is null or ep."City" ilike '%' || trim(p_city) || '%')
      and (
        p_search_text is null
        or fl."Title" ilike '%' || trim(p_search_text) || '%'
        or ep."City" ilike '%' || trim(p_search_text) || '%'
        or coalesce(ep."Neighborhood", '') ilike '%' || trim(p_search_text) || '%'
      )
      and (p_bedrooms_min is null or ep."Bedrooms" >= p_bedrooms_min)
      and (p_capacity_min is null or greatest(coalesce(ep."Capacity", 0), coalesce(fl.listing_capacity, 0)) >= p_capacity_min)
      and (
        p_min_price is null
        or coalesce(fl."BasePrice", fl."RentPrice", 0) >= p_min_price
      )
      and (
        p_max_price is null
        or coalesce(fl."BasePrice", fl."RentPrice", 0) <= p_max_price
      )
      and (
        p_amenity_ids is null
        or cardinality(p_amenity_ids) = 0
        or not exists (
          select 1
          from unnest(p_amenity_ids) aid
          where not exists (
            select 1
            from public."EstatePropertyAmenity" epa
            where epa."EstatePropertyId" = ep."Id"
              and epa."AmenityId" = aid
          )
        )
      )
      and (
        not v_has_dates
        or not exists (
          select 1
          from public."Bookings" b
          where b."EstatePropertyId" = ep."Id"
            and b."IsDeleted" = false
            and b."Status" <> 2
            and b."CheckInDate" < v_check_out_ts
            and b."CheckOutDate" > v_check_in_ts
            and (b."ListingType" is null or b."ListingType"::text = v_listing_type)
        )
      )
      and (
        not v_has_dates
        or to_regclass('public.booking_holds') is null
        or not exists (
          select 1
          from public.booking_holds h
          where h.property_id = ep."Id"
            and h.status = 'pending'
            and h.expires_at > now()
            and h.check_in < p_check_out
            and h.check_out > p_check_in
            and (h.listing_type is null or h.listing_type = v_listing_type)
        )
      )
      and (
        not v_has_dates
        or to_regclass('public."AvailabilityBlocks"') is null
        or not exists (
          select 1
          from public."AvailabilityBlocks" ab
          where ab."EstatePropertyId" = ep."Id"
            and ab."IsAvailable" = false
            and ab."StartDate" < v_check_out_ts
            and ab."EndDate" > v_check_in_ts
        )
      )
  ),
  scored as (
    select
      b.*,
      case
        when not v_has_dates then 100
        when b.blocked_for_booking then 0
        else 100
      end as availability_score,
      case
        when p_center_lat is null or p_center_lng is null then 50
        else greatest(
          0,
          100 - least(
            100,
            (
              6371 * acos(
                least(1, greatest(-1,
                  cos(radians(p_center_lat)) * cos(radians(b.lat))
                  * cos(radians(b.lng) - radians(p_center_lng))
                  + sin(radians(p_center_lat)) * sin(radians(b.lat))
                ))
              ) / 50.0
            ) * 100
          )
        )
      end as distance_score
    from base b
  )
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'estatePropertyId', s.estate_property_id,
          'listingId', s.listing_id,
          'listingType', s.listing_type,
          'title', s.title,
          'description', s.description,
          'displayPrice', s.display_price,
          'currency', s.currency,
          'city', s.city,
          'state', s.state,
          'country', s.country,
          'neighborhood', s.neighborhood,
          'bedrooms', s.bedrooms,
          'bathrooms', s.bathrooms,
          'capacity', s.capacity,
          'ownerId', s.owner_id,
          'lat', s.lat,
          'lng', s.lng,
          'areaValue', s.area_value,
          'areaUnit', s.area_unit,
          'blockedForBooking', s.blocked_for_booking,
          'scores', s.scores,
          'offlineBaseScore', s.offline_base_score,
          'onlineBoosts', jsonb_build_object(
            'availability_score', round(s.availability_score::numeric, 2),
            'distance_score', round(s.distance_score::numeric, 2)
          )
        )
        order by s.offline_base_score desc, s.estate_property_id
      ),
      '[]'::jsonb
    ),
    'total', (select count(*) from scored)
  )
  into v_result
  from (
    select * from scored
    order by offline_base_score desc, estate_property_id
    limit v_pool_size
  ) s;

  return coalesce(v_result, jsonb_build_object('items', '[]'::jsonb, 'total', 0));
end;
$$;

grant execute on function public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text,
  numeric, numeric, integer, integer, uuid[], date, date, numeric, numeric, integer
) to anon, authenticated, service_role;

comment on function public.portal_search_properties(
  text, text, numeric, numeric, numeric, numeric, text, text,
  numeric, numeric, integer, integer, uuid[], date, date, numeric, numeric, integer
) is
  'Guest portal search: hard filters, precomputed scores, online availability/distance boosts. Client applies mix/diversity/randomness.';

commit;
