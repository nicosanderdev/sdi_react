# send-contact-email

Supabase Edge Function that sends contact form messages via Resend.

## Required secrets

Set these in Supabase project secrets before deploying:

- `CONTACT_RECIPIENT_EMAIL`: Destination mailbox for contact requests.
- `CONTACT_FROM_EMAIL` (optional): From address for outgoing email. If omitted, fallback is used.
- `SEND_EMAILS_ENABLED` (optional): Set to `true` to send through Resend. Default local-safe value should be `false`.
- `RESEND_API_KEY`: Required only when `SEND_EMAILS_ENABLED=true`.

## Rate limits

After payload validation and before dry-run or Resend, the function calls `check_and_increment_contact_email_rate_limit` (service role). Limits are a 10-minute fixed window:

- sender email: 3 requests
- client IP: 10 requests
- global: 60 requests (all guest sites combined)

Client IP is taken from the first hop of `x-forwarded-for` only. The JSON body cannot supply an IP.

If the RPC fails, the function returns `500` and does not send (fail closed). Over-limit requests return `429` with `{ "error": "Too many requests" }` — the tripped bucket is logged server-side only.

`message` is capped at 4000 characters.

Requires migration `20260827180000_contact_email_rate_limits.sql`.

## Local dry-run mode

By default, local development should use `SEND_EMAILS_ENABLED=false`.

In dry-run mode, this function:
- validates payload and configuration
- applies the rate limits above
- logs outbound email metadata to the function console
- returns success without calling the Resend API

To intentionally send real emails, set:
- `SEND_EMAILS_ENABLED=true`
- `RESEND_API_KEY=<your_resend_key>`

## Request contract

- Method: `POST`
- JSON body:
  - `name` (string, required)
  - `email` (string, required, valid format)
  - `message` (string, required, max 4000 characters)

## Manual local test (optional)

```bash
supabase functions serve send-contact-email --env-file ./supabase/.env.local
```

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-contact-email' \
  --header 'Content-Type: application/json' \
  --data '{"name":"Jane Doe","email":"jane@example.com","message":"Hello"}'
```

## Manual deploy (optional)

```bash
supabase functions deploy send-contact-email
```

This repository does not auto-deploy functions.
