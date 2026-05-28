# Handoff: Dynamic pricing (guest client)

**Source repo:** `sdi_react` (admin + SQL + shared pricing module)  
**Target:** Guest client apps (`sdi_trips` SummerRent, EventVenue alt)  
**Migrations (apply in order, manually):**

1. [`supabase/migrations/20260602120000_dynamic_pricing_schema.sql`](../supabase/migrations/20260602120000_dynamic_pricing_schema.sql)
2. [`supabase/migrations/20260602120100_dynamic_pricing_validation.sql`](../supabase/migrations/20260602120100_dynamic_pricing_validation.sql)

---

## Summary

Listings of type **SummerRent** and **EventVenue** use **dynamic nightly pricing**:

```
nightly = basePrice × season × specialDay × demand × anticipation
→ clamp(min, max) → commercial round
total = sum(nightly per night) × longStayDiscount (if applicable)
```

- **Display** (map, explore, list, detail): computed on the **frontend** using `src/services/pricing/*` (copy or share package).
- **Authority** on booking: `validate_booking_selection` inside `create_booking_hold` recomputes totals; pass `p_client_total` to detect tampering.

**Demand factor:** v1 defaults to `1.0` until the `daily-pricing-precalc` cron (phase 2) populates `ListingDailyFactors`.

---

## Listing fields (from public property payload)

Ensure property fetch joins **featured `Listings`** row and exposes:

| Field | Use |
|-------|-----|
| `basePrice` | Base nightly rate |
| `minPrice` / `maxPrice` | Clamp after factors |
| `longStayDiscountEnabled`, `longStayMinDays`, `longStayDiscountPercentage` | Stay discount on subtotal |
| `listingId` | `get_listing_daily_factors` |
| `listingType` | `SummerRent` \| `EventVenue` |

Legacy `rentPrice` may mirror `basePrice`; do not show raw `rentPrice` as the final guest price.

---

## Search context

```ts
interface SearchContext {
  siteListingType: 'SummerRent' | 'EventVenue';
  checkIn?: string;   // ISO date YYYY-MM-DD
  checkOut?: string;
  guests?: number;
  searchDate?: string; // for anticipation; default today
}
```

| Mode | UX | Pricing |
|------|-----|---------|
| **With dates** | Map/filter search, detail with range | Full pipeline per night in range |
| **Explore** | No dates in filter | `displayLabel: 'from'` — `computeFromPrice` (base × low season, clamped) |

**Site scope:** call `get_app_parameters` with `p_site_scope: 'SummerRent'` or `'EventVenue'` (site overrides global).

---

## Frontend integration

1. Copy or import from `sdi_react/src/services/pricing/`:
   - `fetchAppParameters`, `fetchListingDailyFactors`
   - `calculateDisplayPrice`
2. On list/map load (with dates): batch-fetch daily factors per visible `listingId` for `[checkIn, checkOut)`.
3. Map each card: `breakdown.nightlyAverage` or `breakdown.total` + label (`Desde` / `por noche` / `total`).
4. Property detail: same breakdown; show date-dependent total when range selected.

Example:

```ts
import {
  calculateDisplayPrice,
  fetchAppParameters,
  fetchListingDailyFactors,
} from '@/services/pricing';

const params = await fetchAppParameters('SummerRent');
const factors = listing.listingId && checkIn && checkOut
  ? await fetchListingDailyFactors(listing.listingId, checkIn, checkOut)
  : [];

const breakdown = calculateDisplayPrice(
  {
    listingId: listing.listingId,
    basePrice: listing.basePrice!,
    minPrice: listing.minPrice,
    maxPrice: listing.maxPrice,
    longStayDiscountEnabled: listing.longStayDiscountEnabled,
    longStayMinDays: listing.longStayMinDays,
    longStayDiscountPercentage: listing.longStayDiscountPercentage,
  },
  params,
  { siteListingType: 'SummerRent', checkIn, checkOut },
  factors
);
```

---

## Booking hold (price control)

```ts
import type { CreateBookingHoldParams } from '.../guestReviewContract';

const { data, error } = await supabase.rpc('create_booking_hold', {
  p_property_id: propertyId,
  p_check_in: checkIn,
  p_check_out: checkOut,
  p_guests: guests,
  p_listing_type: 'SummerRent',
  p_client_total: uiTotal, // required for dynamic listings
} satisfies CreateBookingHoldParams);
```

On failure:

```json
{
  "success": false,
  "error": "Price quote mismatch",
  "error_code": "PRICE_QUOTE_MISMATCH",
  "validation": { "pricing": { "nightly_price": 120, "nights": 3, "total_price": 360 } }
}
```

Refresh UI from `validation.pricing` or re-run local `calculateDisplayPrice`.

Types: [`src/types/guestReviewContract.ts`](../../src/types/guestReviewContract.ts).

---

## RPCs

| RPC | Purpose |
|-----|---------|
| `get_app_parameters(p_site_scope)` | Merged parameter map |
| `get_listing_daily_factors(p_listing_id, p_from, p_to)` | Precomputed demand (v1 often empty → demand 1.0) |
| `validate_booking_selection(...)` | Direct validation (optional; normally via hold) |
| `create_booking_hold(..., p_client_total)` | Hold + server pricing |

---

## Long-stay discount

Applied **once on subtotal** after summing rounded nightly amounts (matches server SQL).

---

## Phase 2: demand cron

- Edge function: `daily-pricing-precalc` (stub in v1)
- Table: `ListingDailyFactors` (`DemandFactor`, `DemandScore`)
- Tune via admin parameters: `DEMAND_FACTOR_MIN`, `DEMAND_FACTOR_MAX`, `DEMAND_WEIGHTS`

---

## Test checklist

- [ ] Explore list shows “Desde X” without dates
- [ ] Map/search with dates updates nightly/total when range changes
- [ ] SummerRent vs EventVenue pick up different `AppParameters` overrides
- [ ] Hold with wrong `p_client_total` → `PRICE_QUOTE_MISMATCH`
- [ ] Hold with correct total → `validation.pricing.total_price` matches UI
- [ ] Long-stay discount reduces total when nights ≥ `longStayMinDays`
- [ ] Special date in `SPECIAL_DATES` increases price on affected nights
