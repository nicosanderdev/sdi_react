# Guest booking messaging handoff

Consumer apps: guest / trips sites (not the sdi_react dashboard UI).  
Backend ownership: this repo (`supabase/functions` + RPCs).

TypeScript contracts: [`src/types/guestReviewContract.ts`](../../src/types/guestReviewContract.ts).

## Channel rules

| Use case | Primary | Fallback |
|----------|---------|----------|
| Guest OTP (hold verification) | WhatsApp template `informacion_reserva` (Meta Cloud API) | None (return error on WhatsApp failure) |
| Booking confirmed / cancelled | Email (Resend) | None (skip notice if no email) |

OTP resend: guest UI should call `booking-send-otp` again (same `holdId` + `phone`). Rate limit: 3 requests per phone per 10 minutes.

Lifecycle emails fire when a booking transitions to **Confirmed** or **Cancelled** in the dashboard or after Mercado Pago auto-confirm (not when `confirm_booking_from_hold` creates a Pending booking). Custom WhatsApp text for confirm/cancel is disconnected (Meta requires an approved template).

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
  "channel": "whatsapp" | "local_mock",
  "otpRequestId": "<uuid>",
  "mode": "dry-run"
}
```

`mode` / `local_mock` appear only in local dry-run. The plaintext OTP is never returned in the HTTP body; locally it is printed in the `supabase functions serve` terminal.

### Confirm hold success

See `ConfirmBookingFromHoldSuccess` in `guestReviewContract.ts` (`booking_id`, `reservation_code`, `manage_token`, etc.). Booking starts as **Pending** (`Status = 0`).

On **local** and **staging**, the plaintext manage token is also logged (it is hashed at rest, so this is the only server-side copy):

- Edge Functions → `log-booking-manage-token` (same Logs dashboard as OTP; not Postgres)
- SQL: `select * from booking_manage_token_dev_logs order by created_at desc limit 20;`

Enable always-on staging SQL logging (SQL editor, once):

```sql
ALTER DATABASE postgres SET app.log_booking_dev_secrets = 'true';
```

Do not run that on production. Deploy `log-booking-manage-token` with the other guest functions.

## Post-confirm / cancel notifications (dashboard)

Triggered from this dashboard when status changes, and from the Mercado Pago webhook after auto-confirm:

- Confirmed → `send-booking-confirmation` (email only)
- Cancelled → `send-booking-cancellation` (email only)

If the guest has no email, the notice is skipped (confirm/cancel still succeeds). `booking-send-confirmation` (WhatsApp text) remains in the repo unused until Meta approves a template.

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
| `RESEND_API_KEY` | Email delivery |
| `SEND_EMAILS_ENABLED` | `true` to send live email; otherwise dry-run log |
| `GUEST_BOOKING_MANAGE_BASE_URL_MAIN` | Manage links for `SummerRent` (casas site) |
| `GUEST_BOOKING_MANAGE_BASE_URL_ALT` | Manage links for `EventVenue` (espacios site) |
| `GUEST_BOOKING_MANAGE_BASE_URL` | Deprecated legacy fallback if MAIN/ALT unset |
| `BOOKING_OTP_LIVE_ENABLED` | Optional: `true` to force live WhatsApp on local Supabase |
| `BOOKING_OTP_MOCK` | Optional: `true` on hosted projects to log OTP to function logs instead of WhatsApp |

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

See also [`supabase/functions/booking-send-otp/README.md`](../../supabase/functions/booking-send-otp/README.md).

## Staging / production testing

1. Set secrets in the Supabase project dashboard (table above).
2. Deploy functions:

   ```bash
   npx supabase functions deploy booking-send-otp booking-verify-otp \
     send-booking-confirmation send-booking-cancellation
   ```

3. **Staging without WhatsApp:** set `BOOKING_OTP_MOCK=true`, redeploy `booking-send-otp`, create a fresh hold from the guest site, call send OTP, then copy `code` from the `booking-send-otp` function logs and verify. Turn the secret off when testing live Meta delivery.
4. Use Meta test / verified recipient numbers and a Resend test inbox.

Note: guest sites are cross-origin; both OTP functions must answer `OPTIONS` with CORS headers (same pattern as other guest-facing functions).

## Listing types

Guest manage sites today: `SummerRent` (casas) and `EventVenue` (espacios). `RealEstate` remains in `GuestSiteListingType` for RPC compatibility but has no guest manage site yet, so outbound email manage links omit the manage URL. Pass `listingType` on manage URLs and hold creation when a site exists.
