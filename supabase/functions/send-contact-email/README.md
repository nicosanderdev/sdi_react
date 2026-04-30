# send-contact-email

Supabase Edge Function that sends contact form messages via Resend.

## Required secrets

Set these in Supabase project secrets before deploying:

- `CONTACT_RECIPIENT_EMAIL`: Destination mailbox for contact requests.
- `CONTACT_FROM_EMAIL` (optional): From address for outgoing email. If omitted, fallback is used.
- `SEND_EMAILS_ENABLED` (optional): Set to `true` to send through Resend. Default local-safe value should be `false`.
- `RESEND_API_KEY`: Required only when `SEND_EMAILS_ENABLED=true`.

## Local dry-run mode

By default, local development should use `SEND_EMAILS_ENABLED=false`.

In dry-run mode, this function:
- validates payload and configuration
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
  - `message` (string, required)

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
