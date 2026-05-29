# Handoff: Portal property search (guest client)

**Source repo:** `sdi_react` (SQL + shared search module)  
**Target:** Guest client apps (`sdi_trips` SummerRent, EventVenue) and public map/list UI  
**Migrations (apply manually, in order):**

1. [`supabase/migrations/20260603120000_property_search_schema.sql`](../supabase/migrations/20260603120000_property_search_schema.sql)
2. [`supabase/migrations/20260609120000_portal_search_availability_mode.sql`](../supabase/migrations/20260609120000_portal_search_availability_mode.sql)

**Prerequisite:** `AppParameters` table and `get_app_parameters` (from dynamic pricing migration if not already applied).

---

## Summary

Guest portal search uses a **two-phase** model:

1. **Offline (daily cron):** Postgres computes quality, engagement, reputation, freshness, and exploration scores → `PropertySearchScores`.
2. **Online (per search):** RPC `portal_search_properties` applies **hard filters**, joins precomputed scores, adds **availability** and **distance** boosts.
3. **Client:** Mixes offline + online weights, then **diversity** and **seeded randomness**, then sorts and paginates.

Randomness is **never** stored in the database.

---

## Data model

### `PropertySearchScores`

| Column | Notes |
|--------|--------|
| `EstatePropertyId`, `ListingType` | PK (`SummerRent` \| `EventVenue`) |
| `ListingId` | Featured listing at compute time |
| `Scores` | jsonb components (0–100 scale) |
| `Metrics` | Raw counts for admin/debug |
| `ComputedAt` | Last cron run |

**`Scores` shape:**

```json
{
  "quality_score": 25,
  "engagement_score": 18,
  "reputation_score": 30,
  "freshness_score": 12,
  "exploration_boost": 5,
  "offline_base_score": 90
}
```

### Cron

- Edge function: `daily-property-search-scores` (POST, service role)
- Schedule: e.g. `0 4 * * *` UTC
- SQL: `cron_property_search_scores_batch` → `compute_property_search_scores` per row

---

## AppParameters (`SEARCH_*`)

Read via `get_app_parameters(p_site_scope)` (`SummerRent` / `EventVenue`; site overrides global).

| Name | Used by | Purpose |
|------|---------|---------|
| `SEARCH_SCORE_WEIGHTS` | Cron + client | Offline component weights |
| `SEARCH_ONLINE_WEIGHTS` | Client | `availability`, `distance` |
| `SEARCH_CANDIDATE_POOL_SIZE` | RPC | Max candidates returned |
| `SEARCH_CRON_BATCH_SIZE` | Cron | Batch size |
| `SEARCH_QUALITY_WEIGHTS` | Cron | Image vs description |
| `SEARCH_IMAGE_RULES` | Cron | Count, main, public ratio |
| `SEARCH_DESCRIPTION_RULES` | Cron | Length, repeat ratio |
| `SEARCH_ENGAGEMENT_*` | Cron | Views, messages, bookings, holds |
| `SEARCH_REPUTATION_*` | Cron | Reviews, owner tenure, bookings |
| `SEARCH_FRESHNESS_HALF_LIFE_DAYS` | Cron | Listing age decay |
| `SEARCH_EXPLORATION_*` | Cron | New listing boost |
| `SEARCH_DIVERSITY_RULES` | Client | Owner/city/geo caps |
| `SEARCH_RANDOMNESS` | Client | `enabled`, `strength`, `seedTtlMinutes` |

Admin UI: `/dashboard/admin/config` in `sdi_react` (existing `AppParametersManager`).

---

## RPCs

| RPC | Purpose |
|-----|---------|
| `portal_search_properties(...)` | Filtered candidate pool + scores + online boosts |
| `get_property_search_scores(p_property_ids, p_listing_type)` | Batch scores for map refresh |
| `compute_property_search_scores(p_estate_property_id, p_listing_type)` | Single property (cron/admin) |
| `cron_property_search_scores_batch(p_offset, p_limit)` | Cron batch keys |
| `get_app_parameters(p_site_scope)` | Config map |

### `portal_search_properties` parameters

| Param | Type | Notes |
|-------|------|--------|
| `p_listing_type` | text | Required: `SummerRent` \| `EventVenue` |
| `p_site_scope` | text | Default = listing type |
| `p_sw_lat`, `p_ne_lat`, `p_sw_lng`, `p_ne_lng` | numeric | Map bbox |
| `p_city`, `p_search_text` | text | Location / title search |
| `p_min_price`, `p_max_price` | numeric | On `BasePrice` / `RentPrice` |
| `p_bedrooms_min`, `p_capacity_min` | int | Property filters |
| `p_amenity_ids` | uuid[] | Must have all listed amenities |
| `p_check_in`, `p_check_out` | date | Availability filter + boost |
| `p_center_lat`, `p_center_lng` | numeric | Distance boost |
| `p_availability_mode` | text | `stay` (default) or `any_day_in_range`; see below |
| `p_limit` | int | Default `SEARCH_CANDIDATE_POOL_SIZE` |

#### Availability modes (`p_availability_mode`)

| Mode | Date window | Hard filter | `availability_score` |
|------|-------------|-------------|------------------------|
| `stay` (default) | Requires `check_in < check_out` | Exclude property if **any** booking, pending hold, or unavailable block overlaps the full window | 100 if dates apply and not `blocked_for_booking`, else 0 |
| `any_day_in_range` | Inclusive `check_in` … `check_out` (same day allowed) | Include property if **at least one** day `D` in the window has no overlap on `[D, D+1)` | Fraction of free days in window × 100 |

- **Summer Rent:** omit `p_availability_mode` or pass `stay`.
- **EventVenue (flexible event date):** pass `any_day_in_range` with search dates; no SQL auto-default by listing type—client must set the param explicitly.
- Per-day checks use the same half-open overlap rule as guest bookings (`CheckIn < end`, `CheckOut > start`).

Manual verification after migration: [`supabase/snippets/portal_search_availability_mode_test.sql`](../supabase/snippets/portal_search_availability_mode_test.sql).

**Response:**

```json
{
  "items": [
    {
      "estatePropertyId": "...",
      "listingId": "...",
      "title": "...",
      "scores": { "quality_score": 25, "offline_base_score": 90, ... },
      "onlineBoosts": { "availability_score": 100, "distance_score": 72 },
      "lat": -34.9,
      "lng": -56.2,
      "ownerId": "...",
      "city": "..."
    }
  ],
  "total": 42
}
```

RPC orders by `offline_base_score` only (coarse). **Final order is client-side.**

---

## Frontend integration

Copy or import from `sdi_react/src/services/search/`:

- `portalSearchProperties`, `fetchSearchParameters`
- `rankSearchResults`, `paginateRankedResults`
- `getOrCreateSessionSeed`

### Example: list / map search

```ts
import {
  portalSearchProperties,
  fetchSearchParameters,
  rankSearchResults,
  paginateRankedResults,
  getOrCreateSessionSeed,
} from '@/services/search';

const params = await fetchSearchParameters('SummerRent');
const sessionSeed = getOrCreateSessionSeed(params);

const { items } = await portalSearchProperties({
  listingType: 'SummerRent',
  swLat: bounds.south,
  neLat: bounds.north,
  swLng: bounds.west,
  neLng: bounds.east,
  checkIn: '2026-07-01',
  checkOut: '2026-07-08',
  availabilityMode: 'stay',
  centerLat: mapCenter.lat,
  centerLng: mapCenter.lng,
});

const ranked = rankSearchResults(items, { params, sessionSeed });
const page = paginateRankedResults(ranked, 1, 24);
```

### Client ranking pipeline

```
portal_search_properties → mixScores → applyDiversity → applyRandomness → sort → paginate
```

**Final score:**

```
mixOffline(scores, SEARCH_SCORE_WEIGHTS) + mixOnline(onlineBoosts, SEARCH_ONLINE_WEIGHTS)
+ randomnessNoise(propertyId, sessionSeed)
```

Diversity uses greedy selection on sorted candidates (caps per owner, city, geo cell).

### Session seed

Store in `sessionStorage` with TTL from `SEARCH_RANDOMNESS.seedTtlMinutes` so order is stable per session but varies across sessions.

### Map vs list

| Mode | Suggestion |
|------|------------|
| **Map** | `portal_search_properties` with bbox + high `limit`; rank all candidates client-side |
| **List** | Same RPC; `paginateRankedResults` after `rankSearchResults` |
| **Transition** | Existing `getPropertiesInBounds` can stay until RPC is wired; attach scores via `get_property_search_scores` |

---

## Engagement signals (v1)

| Signal | Source |
|--------|--------|
| Views | `PropertyVisitLogs` |
| Messages | `PropertyMessageLogs` |
| Bookings | `Bookings` (non-cancelled, lookback) |
| Holds | `booking_holds` (by `check_in` in window) |

**Not in v1:** favorites, clicks, shares (no tables). Add `PropertyEngagementEvents` in phase 2 and extend cron weights.

**Image quality v1:** count, main image, public ratio, duplicate URLs. Resolution/dark detection = phase 2.

---

## Deploy checklist

1. Apply migration SQL manually in Supabase.
2. Deploy edge function `daily-property-search-scores`; set cron `0 4 * * *` UTC.
3. Run cron once manually (see function README).
4. Verify `PropertySearchScores` rows exist for active listings.
5. Wire guest app to `portal_search_properties` + `src/services/search` ranking.

---

## Test checklist

- [ ] Cron completes; `PropertySearchScores` populated for SummerRent listings
- [ ] `portal_search_properties` respects bbox, price, bedrooms, dates
- [ ] Unavailable dates exclude properties with overlapping bookings/holds/blocks (`stay` mode)
- [ ] `any_day_in_range`: property with booking on one day in a month still appears for that month; excluded for tight `stay` window around that day (see availability snippet)
- [ ] New listings get higher `exploration_boost` (< `SEARCH_EXPLORATION_NEW_LISTING_DAYS`)
- [ ] Same `sessionSeed` → stable order; new seed → order changes within diversity caps
- [ ] No more than `maxPerOwner` properties from same owner in top results
- [ ] Admin tweak `SEARCH_SCORE_WEIGHTS` → visible after next cron (offline) or immediately for online weights
- [ ] Properties without cron row still appear (scores `{}`, `offline_base_score` 0)

---

## Phase 2

- `PropertyEngagementEvents` (favorites, clicks, shares)
- Image width/height on upload + cron quality signals
- Server-side pagination with `p_session_seed` for reproducible pages
- RealEstate / AnnualRent listing types
