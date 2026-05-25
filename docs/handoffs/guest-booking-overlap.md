# Handoff: Guest cross-property booking overlap

**Source repo:** `sdi_react`  
**Target:** Client/trips app (guest booking flow)  
**Migration:** [`supabase/migrations/20260529120000_guest_booking_overlap.sql`](../supabase/migrations/20260529120000_guest_booking_overlap.sql)

Apply this migration **after** `20260528120000_guest_review_48h_window.sql`.

---

## Summary

A guest may not hold **two overlapping stays** across **different properties** at the same time. Overlap uses **half-open** date ranges `[check_in, check_out)`:

| Existing A ends | New B starts | Allowed? |
|-----------------|--------------|----------|
| Same day as B check-in | — | **Yes** (checkout day free for next check-in) |
| After B check-in | — | **No** |
| Before B check-in (gap) | — | **Yes** |

**Cancelled** bookings (`Status = 2`) do not block. **Listing type** and **property** are ignored for this rule (cross-property guest constraint only).

Property-level double booking (same estate) remains a separate concern — see [reviews-listing-type.md §7](./reviews-listing-type.md).

---

## Database changes (you apply manually)

### New functions

| Function | Purpose |
|----------|---------|
| `guest_has_overlapping_booking(guest_id, check_in, check_out, exclude_booking_id?)` | Boolean helper |
| `validate_guest_booking_overlap(email, check_in, check_out)` | Pre-check RPC for hold / date step |
| `confirm_booking_from_hold` | **Updated** — blocks confirm when overlap detected |

### Error contract

When blocked:

```json
{
  "success": false,
  "error_code": "GUEST_BOOKING_OVERLAP",
  "error": "You already have a reservation that overlaps these dates."
}
```

Pre-check when overlap exists (`success` is still `true`):

```json
{
  "success": true,
  "hasOverlap": true,
  "error_code": "GUEST_BOOKING_OVERLAP",
  "error": "You already have a reservation that overlaps these dates."
}
```

---

## 1. Pre-check (recommended)

Call after the guest enters **email** and **dates** (before or right after creating `booking_holds`), so they see feedback before OTP:

```ts
import type { ValidateGuestBookingOverlapResponse } from '.../guestReviewContract';
import { isGuestBookingOverlapError } from '.../guestReviewContract';

const { data, error } = await supabase.rpc('validate_guest_booking_overlap', {
  p_email: email.trim(),
  p_check_in: checkIn, // ISO / timestamptz string matching hold
  p_check_out: checkOut,
});

if (error) throw error;

const result = data as ValidateGuestBookingOverlapResponse;

if (!result.success) {
  showError(result.error ?? 'Could not validate dates');
  return;
}

if (result.hasOverlap) {
  showOverlapMessage(result.error);
  disableContinue();
  return;
}

// proceed to hold insert / OTP
```

First-time guests (email not in `Guests` yet) return `{ success: true, hasOverlap: false }`.

---

## 2. Confirm step (required)

On `confirm_booking_from_hold`, handle the same error code:

```ts
import type { ConfirmBookingFromHoldResponse } from '.../guestReviewContract';

const { data, error } = await supabase.rpc('confirm_booking_from_hold', {
  p_hold_id: holdId,
  p_guest_payload: guestPayload,
});

if (error) throw error;

const result = data as ConfirmBookingFromHoldResponse;

if (!result.success) {
  if (result.error_code === 'GUEST_BOOKING_OVERLAP') {
    showOverlapMessage(result.error);
    return;
  }
  showError(result.error ?? 'Could not confirm booking');
  return;
}

// success: result.reservation_code, manage_token, etc.
```

Use the same UI copy for pre-check and confirm.

---

## 3. Suggested user-facing copy

**English (API default):**  
`You already have a reservation that overlaps these dates.`

**Spanish (example for ES trips app):**  
`Ya tenés una reserva que se superpone con estas fechas. Cancelá o modificá la otra reserva antes de continuar.`

Short helper line (optional):  
`Solo podés tener una estadía activa a la vez. Si tu salida es el mismo día que el ingreso de otra reserva, está permitido.`

---

## 4. TypeScript contract

Shared types: [`src/types/guestReviewContract.ts`](../../src/types/guestReviewContract.ts)

- `GuestBookingErrorCode`
- `ValidateGuestBookingOverlapParams` / `ValidateGuestBookingOverlapResponse`
- `ConfirmBookingFromHoldResponse`
- `isGuestBookingOverlapError()` helper

Copy or import into the client app.

---

## 5. Testing checklist

- [ ] Guest with booking Mar 1–5; new hold Mar 5–10 on **another property** → pre-check and confirm **allowed**.
- [ ] Guest with Mar 1–6; new Mar 5–10 → **blocked** (pre-check `hasOverlap: true`, confirm `error_code`).
- [ ] Guest with Mar 1–5; new Mar 6–10 → **allowed**.
- [ ] Overlapping booking **cancelled** → **allowed**.
- [ ] New guest email (no `Guests` row) → pre-check `hasOverlap: false`.
- [ ] Confirm still blocked if overlap appears between pre-check and confirm (e.g. another tab completed a booking).

---

## 6. Migration apply order

1. Through `20260528120000_guest_review_48h_window.sql`
2. **`20260529120000_guest_booking_overlap.sql`** ← this handoff

---

## 7. Out of scope

- Owner/dashboard `BookingService.createBooking` (no guest overlap check).
- Overlapping **pending holds** for the same email (optional follow-up).
- Same person booking with a **different email** (existing guest identity limitation).
