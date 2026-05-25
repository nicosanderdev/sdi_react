# Handoff: Reviews scoped by listing type

**Source repo:** `sdi_react`  
**Target:** Client/trips app (guest booking, reservation lookup, review submit, property detail pages)  
**Migration:** [`supabase/migrations/20260527120000_reviews_listing_type.sql`](../supabase/migrations/20260527120000_reviews_listing_type.sql)

Apply this migration **after** all guest migrations through `20260526130000_fix_issue_booking_manage_token_pgcrypto.sql`.

---

## Summary

A single property can have multiple listings (`RealEstate`, `SummerRent`, `EventVenue`). Reviews and guest reservation lookup are now scoped to the **site listing type** so Summer Rent does not show Real Estate reviews (and vice versa).

Guest flows accept only three listing types (not `AnnualRent`):

| Value | Typical site |
|-------|----------------|
| `RealEstate` | Real estate portal |
| `SummerRent` | Summer rent portal |
| `EventVenue` | Event venue portal |

---

## Database changes (you apply manually)

### New / updated columns

| Table | Column | Notes |
|-------|--------|--------|
| `Reviews` | `ListingType` | Set on guest review submit; filter reads by property + type |
| `Bookings` | `ListingType` | Snapshot from hold at `confirm_booking_from_hold` |
| `booking_holds` | `listing_type` (text) | **Your app must set** when creating a hold |

### New helpers (optional direct use)

- `validate_guest_site_listing_type(text)` → `ListingType` or raises
- `booking_matches_guest_site_listing_type(...)` → boolean

### Breaking RPC changes

| RPC | Before | After |
|-----|--------|--------|
| `get_reservation_by_code` | `(reservation_code text)` | `(reservation_code text, p_listing_type text)` |
| `create_guest_review_by_reservation_code` | 4 parameters | 5 parameters — add `p_listing_type` |

The single-argument `get_reservation_by_code` is **dropped**. Update every caller.

---

## 1. Hold creation (required)

Pass `p_listing_type` when calling `create_booking_hold` so the hold is scoped to the site the user is booking on:

```ts
import type { CreateBookingHoldResponse, GuestSiteListingType } from '.../guestReviewContract';

const siteListingType: GuestSiteListingType = 'SummerRent'; // from app config per deployment

const { data, error } = await supabase.rpc('create_booking_hold', {
  p_property_id: propertyId,
  p_check_in: checkIn,
  p_check_out: checkOut,
  p_visible_check_out: visibleCheckOut,
  p_guests: guests,
  p_estimated_guests: estimatedGuests,
  p_listing_type: siteListingType,
  p_idempotency_key: idempotencyKey,
});

if (error) throw error;

const result = data as CreateBookingHoldResponse;

if (!result.success) {
  showError(result.error ?? 'Could not create hold');
  return;
}

// result.hold.id, result.hold.expires_at, result.hold.listing_type
```

Allowed values: `RealEstate`, `SummerRent`, `EventVenue` (exact casing).

**Migration:** [`20260530120000_create_booking_hold_listing_type.sql`](../supabase/migrations/20260530120000_create_booking_hold_listing_type.sql) — apply after `20260529120000_guest_booking_overlap.sql`.

If `listing_type` is missing at confirm time, `Bookings.ListingType` stays null and lookup/review only succeed when a matching **confirmed** hold row exists with the same dates and `listing_type`.

---

## 2. Reservation lookup

Pass the site’s listing type on every lookup:

```ts
import type { GuestSiteListingType } from '...'; // or inline union

const siteListingType: GuestSiteListingType = 'SummerRent';

const { data, error } = await supabase.rpc('get_reservation_by_code', {
  reservation_code: code.toUpperCase().trim(),
  p_listing_type: siteListingType,
});

if (error) throw error;

const result = data as GetReservationByCodeResponse;

if (!result.success) {
  // Wrong code, wrong site, expired, etc. — same message for wrong site (fail closed)
  showError(result.error ?? 'Reservation not found');
  return;
}

const { reservation } = result;
// reservation.listingType === siteListingType
// reservation.canSubmitGuestReview — gate review form
// reservation.hasExistingReview
```

### Response shape (`success: true`)

```ts
reservation: {
  bookingId: string;
  guestId: string | null;
  reservationCode: string;
  propertyId: string;
  propertyTitle: string;
  listingType: 'RealEstate' | 'SummerRent' | 'EventVenue';
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'unknown';
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  canCancel: boolean;
  isExpired: boolean;
  isDeleted: boolean;
  hasExistingReview: boolean;
  canSubmitGuestReview: boolean;
}
```

### Listing-type gate behavior

- If `Bookings.ListingType` is set → must equal `p_listing_type`.
- Else → requires confirmed `booking_holds` row with same `property_id`, `check_in`, `check_out`, and `listing_type`.
- Else → `success: false`, `error: 'Reservation not found'` (do not reveal that the code exists on another site).

---

## 3. Submit guest review

After checkout, when `canSubmitGuestReview` is true:

```ts
const { data, error } = await supabase.rpc('create_guest_review_by_reservation_code', {
  p_reservation_code: reservationCode,
  p_guest_email: email.trim(),
  p_rating: rating, // 1–5
  p_comment: comment.trim(),
  p_listing_type: siteListingType,
});

const result = data as CreateGuestReviewResponse;

if (!result.success) {
  showError(result.error);
  return;
}

// result.reviewId, result.listingType
```

Same listing-type gate as lookup. Inserts `Reviews.ListingType`.

---

## 4. Property details — list reviews (your app)

Filter reviews for the current site only:

```ts
const { data: reviews } = await supabase
  .from('Reviews')
  .select('Id, Rating, Comment, Created, GuestId')
  .eq('EstatePropertyId', propertyId)
  .eq('ListingType', siteListingType)
  .order('Created', { ascending: false });
```

Legacy rows with `ListingType IS NULL` are excluded until backfilled.

If you use a custom RPC for property reviews, add a `p_listing_type` filter using the same three values.

---

## 5. `confirm_booking_from_hold` response

When the hold has `listing_type`, the booking row stores it and the RPC may return:

```json
{
  "success": true,
  "booking_id": "...",
  "guest_id": "...",
  "reservation_code": "RSV-XXXXXX",
  "listing_type": "SummerRent",
  "manage_token": "...",
  "manage_expires_at": "..."
}
```

Invalid hold `listing_type` → `success: false`, `error: 'Invalid listing type on booking hold'`.

---

## 6. Member reviews (`create_review`)

Not defined in `sdi_react` migrations. If production has `create_review` for logged-in members, extend it to set `Reviews.ListingType` from the member’s booking context (same three site types or your full enum policy).

---

## 7. Follow-up: calendar / double booking across sites

Listing type on reviews **does not** block two bookings on the same property and dates across different sites. Implement separately in hold/validation logic:

- Reject new holds when **any** active booking overlaps `EstatePropertyId` + date range, regardless of `listing_type`.

---

## 8. Testing checklist

- [ ] Hold with `listing_type: 'SummerRent'` → confirm → lookup/review with `SummerRent` works.
- [ ] Same code with `p_listing_type: 'RealEstate'` → not found.
- [ ] Review insert has `ListingType`; property page query returns only that type.
- [ ] Second review submit → `Review already exists`.
- [ ] Invalid `p_listing_type` → `Invalid listing type`.
- [ ] Legacy booking (no `Bookings.ListingType`, no matching hold) → not found until backfilled.

---

## 9. TypeScript contract (sdi_react)

Shared types live in [`src/types/guestReviewContract.ts`](../../src/types/guestReviewContract.ts). Copy or import into the client app as needed.

---

## 10. Migration apply order

1. `20260524120000_guest_reservation_code_lookup.sql`
2. `20260524130000_guest_review_by_reservation_code.sql`
3. `20260525120000_guests_table_polymorphic_guest_id.sql`
4. `20260526120000_fix_confirm_booking_gen_random_bytes.sql`
5. `20260526130000_fix_issue_booking_manage_token_pgcrypto.sql`
6. `20260527120000_reviews_listing_type.sql`
7. `20260528120000_guest_review_48h_window.sql`
8. `20260529120000_guest_booking_overlap.sql`
9. **`20260530120000_create_booking_hold_listing_type.sql`** ← fixes `create_booking_hold` PGRST202 when client sends `p_listing_type`
