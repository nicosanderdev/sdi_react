# daily-property-search-scores

Nightly batch job for **portal property search ranking** (offline score precompute).

## Behavior

1. Reads `SEARCH_CRON_BATCH_SIZE` from `get_app_parameters('global')` (default 100).
2. Loops `cron_property_search_scores_batch(offset, limit)` until no rows.
3. For each `(estate_property_id, listing_type)` calls `compute_property_search_scores`.
4. Upserts `PropertySearchScores` with quality, engagement, reputation, freshness, and exploration components.

## Prerequisites

Apply migration manually:

- [`supabase/migrations/20260603120000_property_search_schema.sql`](../../migrations/20260603120000_property_search_schema.sql)

## Schedule

Supabase Dashboard → Edge Functions → Cron, e.g. `0 4 * * *` (04:00 UTC daily). Scheduled invocations use the **service role** bearer (allowed by the handler).

## Auth

| Caller | Authorization |
|--------|----------------|
| Supabase cron / curl | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` |
| Admin UI (`sdi_react`) | Logged-in admin JWT via `supabase.functions.invoke` (handler checks `Members.Role = admin`) |

## Admin UI

On **Gestión de propiedades** (`/dashboard/admin/properties`), admins can click **Ejecutar scoring** to run the full batch without curl. Requires:

- This function deployed to the project matching `VITE_SUPABASE_URL`
- Migration `20260603120000_property_search_schema.sql` applied
- Local: `supabase start` (edge functions at `/functions/v1/...`)

Implementation: `PropertyAdminService.runSearchScoringBatch()` → `daily-property-search-scores`.

## Invoke manually (service role)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/daily-property-search-scores" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "maxBatches": 2}'
```

## Response

```json
{
  "success": true,
  "processed": 120,
  "succeeded": 118,
  "skipped": 2,
  "errors": [],
  "errorCount": 0,
  "durationMs": 45000
}
```
