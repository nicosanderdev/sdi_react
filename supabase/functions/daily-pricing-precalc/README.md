# daily-pricing-precalc

Nightly batch job for **demand-based pricing** (phase 2).

## v1

Stub only: returns `{ success: true }` without upserting `ListingDailyFactors`.

## Phase 2 (planned)

1. For each active `SummerRent` / `EventVenue` listing, compute `DemandScore` (0–1) from bookings, holds, and optional analytics.
2. Map score to `DemandFactor` using `DEMAND_FACTOR_MIN` / `DEMAND_FACTOR_MAX` from `AppParameters`.
3. Upsert `ListingDailyFactors` for the next N days (default 365).

## Schedule

Configure in Supabase Dashboard → Edge Functions → Cron, e.g. `0 3 * * *` (03:00 UTC daily).

## Invoke manually

```bash
curl -X POST "$SUPABASE_URL/functions/v1/daily-pricing-precalc" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"horizonDays": 365}'
```
