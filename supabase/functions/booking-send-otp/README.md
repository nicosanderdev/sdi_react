# booking-send-otp

Sends a booking verification OTP via WhatsApp (Meta Cloud API template `informacion_reserva`) with SMS fallback on WhatsApp failure.

Guest sites should offer a **Resend code** action that calls this function again with the same `holdId` and `phone` (rate-limited: 3 requests per phone per 10 minutes).

## WhatsApp template

Production OTP WhatsApp delivery uses the approved Meta template:

- **Name:** `informacion_reserva`
- **Language:** `es`
- **Body variable:** the 6-digit OTP code (`{{1}}`)

SMS fallback sends the same Spanish plain-text copy (templates are WhatsApp-only). No extra secrets are required beyond the existing Meta credentials.

## Mock mode (dry-run)

Mock mode **does not** call Meta or SMS. Instead it:

- stores the OTP hash in `otp_requests` (same as production)
- prints the plaintext OTP to the edge function logs / local serve terminal
- returns `{ success: true, channel: "local_mock", mode: "dry-run", otpRequestId }`

The OTP is **not** included in the HTTP response.

Enabled when:

- `SUPABASE_URL` is local (`127.0.0.1`, `localhost`, or `kong`), unless `BOOKING_OTP_LIVE_ENABLED=true`
- **or** hosted staging/prod has secret `BOOKING_OTP_MOCK=true` (use this to test guest sites without WhatsApp)

To force live provider calls on a local URL (optional), set `BOOKING_OTP_LIVE_ENABLED=true` in your functions env file.

## Verify the code locally

Use the existing `booking-verify-otp` function with the code from the serve terminal:

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/booking-verify-otp' \
  --header 'Content-Type: application/json' \
  --header 'apikey: <local-service-role-or-anon-key>' \
  --header 'Authorization: Bearer <local-service-role-or-anon-key>' \
  --data '{"holdId":"<hold-uuid>","phone":"+59899826714","code":"123456"}'
```

## Send OTP (local)

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/booking-send-otp' \
  --header 'Content-Type: application/json' \
  --header 'apikey: <local-service-role-or-anon-key>' \
  --header 'Authorization: Bearer <local-service-role-or-anon-key>' \
  --data '{"holdId":"<hold-uuid>","phone":"+59899826714"}'
```

Copy `code` from the functions serve console, then call verify as above.

## Run locally

```bash
npx supabase functions serve --env-file supabase/functions/.env
```

## Production / staging

By default, hosted projects call Meta WhatsApp and SMS fallback. Ensure secrets are set in the project dashboard:

- `META_WHATSAPP_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `SMS_FALLBACK_WEBHOOK_URL` — POST `{ phone, message }`

For staging dry-run (log OTP in function logs, no WhatsApp):

```bash
npx supabase secrets set BOOKING_OTP_MOCK=true --project-ref <staging-ref>
npx supabase functions deploy booking-send-otp booking-verify-otp mercado-pago-admin --project-ref <staging-ref>
```

The same `BOOKING_OTP_MOCK` secret also dry-runs Mercado Pago seller invites (`mercado-pago-admin`): connect URL is logged, WhatsApp is not sent.

Read the code from **Edge Functions → booking-send-otp → Logs**. Remove the secret (or set `BOOKING_OTP_MOCK=false`) before relying on live WhatsApp.

See also `docs/handoffs/guest-booking-messaging.md`.
