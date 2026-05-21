# booking-send-otp

Sends a booking verification OTP via WhatsApp (Meta Cloud API) with SMS fallback.

## Local mock mode (dry-run)

When `SUPABASE_URL` points at local Supabase (`127.0.0.1`, `localhost`, or `kong`), this function **does not** call Meta or SMS. Instead it:

- stores the OTP hash in `otp_requests` (same as production)
- prints the plaintext OTP to the terminal running `supabase functions serve`
- returns `{ success: true, channel: "local_mock", mode: "dry-run", otpRequestId }`

The OTP is **not** included in the HTTP response.

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

## Production

Hosted Supabase URLs do not match local hosts, so Meta WhatsApp and SMS fallback run as implemented. Ensure secrets are set in the project dashboard (`META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `SMS_FALLBACK_WEBHOOK_URL`).
