# Guest booking messaging handoff

Consumer apps: guest / trips sites (not the sdi_react dashboard UI).  
Backend ownership: this repo (`supabase/functions` + RPCs).

TypeScript contracts: [`src/types/guestReviewContract.ts`](../../src/types/guestReviewContract.ts).

## Channel rules

| Use case | Primary | Fallback |
|----------|---------|----------|
| Guest OTP (hold verification) | WhatsApp template `informacion_reserva` (Meta Cloud API) | SMS webhook on WhatsApp failure |
| Booking confirmed / cancelled | Email (Resend) | WhatsApp if guest has no email |

OTP resend: guest UI should call `booking-send-otp` again (same `holdId` + `phone`). Rate limit: 3 requests per phone per 10 minutes.

Lifecycle emails/WhatsApp fire when a booking transitions to **Confirmed** or **Cancelled** in the dashboard (not when `confirm_booking_from_hold` creates a Pending booking).

## Guest OTP reservation flow

```
create_booking_hold RPC
  → POST /functions/v1/booking-send-otp  { holdId, phone }
  → POST /functions/v1/booking-verify-otp  { holdId, phone, code }
  → confirm_booking_from_hold RPC  { firstName, lastName, email, phone, ... }
```

Phone must be E.164 (`+` and country code, e.g. `+59899123456`).

## Contracts

| Step | Endpoint / RPC | Auth | Body / params |
|------|----------------|------|---------------|
| Hold | `create_booking_hold` | anon + RLS | See `CreateBookingHoldParams` |
| Send OTP | `booking-send-otp` | no JWT (`verify_jwt = false`) | `{ holdId, phone, ip? }` |
| Verify OTP | `booking-verify-otp` | no JWT | `{ holdId, phone, code }` |
| Confirm hold | `confirm_booking_from_hold` | anon | guest payload JSON |
| Resend OTP | `booking-send-otp` | no JWT | same as send |

### OTP send response (success)

```json
{
  "success": true,
  "channel": "whatsapp" | "sms_fallback" | "local_mock",
  "otpRequestId": "<uuid>",
  "mode": "dry-run"
}
```

`mode` / `local_mock` appear only in local dry-run. The plaintext OTP is never returned in the HTTP body; locally it is printed in the `supabase functions serve` terminal.

### Confirm hold success

See `ConfirmBookingFromHoldSuccess` in `guestReviewContract.ts` (`booking_id`, `reservation_code`, `manage_token`, etc.). Booking starts as **Pending** (`Status = 0`).

## Post-confirm / cancel notifications (dashboard)

Triggered from this dashboard when status changes:

- Confirmed → `send-booking-confirmation` (email) or `booking-send-confirmation` (WhatsApp if no email)
- Cancelled → `send-booking-cancellation` (email) or `booking-send-confirmation` with `eventType: "cancelled"` (WhatsApp if no email)

Guest sites do **not** need to call these today.

## Env vars

### Guest site (frontend)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key for RPC + edge function calls |
| `VITE_GUEST_BOOKING_MANAGE_BASE_URL` | Base URL for manage links (`?code=&listingType=`) |

### Supabase edge secrets (server only)

| Variable | Purpose |
|----------|---------|
| `META_WHATSAPP_TOKEN` | WhatsApp Cloud API token |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID |
| `SMS_FALLBACK_WEBHOOK_URL` | POST `{ phone, message }` for OTP SMS fallback |
| `RESEND_API_KEY` | Email delivery |
| `SEND_EMAILS_ENABLED` | `true` to send live email; otherwise dry-run log |
| `GUEST_BOOKING_MANAGE_BASE_URL_MAIN` | Manage links for `SummerRent` (casas site) |
| `GUEST_BOOKING_MANAGE_BASE_URL_ALT` | Manage links for `EventVenue` (espacios site) |
| `GUEST_BOOKING_MANAGE_BASE_URL` | Deprecated legacy fallback if MAIN/ALT unset |
| `BOOKING_OTP_LIVE_ENABLED` | Optional: `true` to force live WhatsApp/SMS on local Supabase |

Manage URLs are resolved server-side from the booking’s `ListingType`:

| `ListingType` | Base secret |
|---------------|-------------|
| `SummerRent` | `GUEST_BOOKING_MANAGE_BASE_URL_MAIN` |
| `EventVenue` | `GUEST_BOOKING_MANAGE_BASE_URL_ALT` |
| `RealEstate` | No guest site yet — manage link omitted |
| null / unknown | MAIN, then legacy |

Staging examples:

```
GUEST_BOOKING_MANAGE_BASE_URL_MAIN=https://staging-casas.encartelera.uy/reservation-lookup
GUEST_BOOKING_MANAGE_BASE_URL_ALT=https://staging-espacios.encartelera.uy/reservation-lookup
```

## Local testing

1. Start local Supabase and functions:

   ```bash
   npx supabase start
   npm run supabase:functions
   ```

2. Seed a hold (optional helper):

   ```bash
   # In Supabase SQL editor or psql against local DB
   \i tasks/seed-booking-hold-otp.sql
   ```

3. Send OTP (dry-run logs code to the functions terminal):

   ```bash
   curl -i -X POST 'http://127.0.0.1:54321/functions/v1/booking-send-otp' \
     -H 'Content-Type: application/json' \
     -H 'apikey: <local-anon-or-service-role-key>' \
     -H 'Authorization: Bearer <local-anon-or-service-role-key>' \
     -d '{"holdId":"<hold-uuid>","phone":"+59899826714"}'
   ```

4. Verify with the code from the terminal via `booking-verify-otp`.

5. Confirmation email dry-run: confirm a booking in the dashboard with `SEND_EMAILS_ENABLED` unset/false; check the functions terminal for `Dry-run booking confirmation email`.

6. WhatsApp confirmation dry-run: guest with phone but no email → confirm booking → terminal shows `WHATSAPP (local mock)`.

See also [`supabase/functions/booking-send-otp/README.md`](../../supabase/functions/booking-send-otp/README.md).

## Staging / production testing

1. Set secrets in the Supabase project dashboard (table above).
2. Deploy functions:

   ```bash
   npx supabase functions deploy booking-send-otp booking-verify-otp \
     booking-send-confirmation send-booking-confirmation send-booking-cancellation
   ```

3. Use Meta test / verified recipient numbers and a Resend test inbox.
4. To force OTP SMS fallback: temporarily use invalid Meta credentials or a phone Meta rejects, with `SMS_FALLBACK_WEBHOOK_URL` pointing at your staging SMS adapter (or a request bin).

## Listing types

Guest manage sites today: `SummerRent` (casas) and `EventVenue` (espacios). `RealEstate` remains in `GuestSiteListingType` for RPC compatibility but has no guest manage site yet, so outbound email/WhatsApp links omit the manage URL. Pass `listingType` on manage URLs and hold creation when a site exists.
