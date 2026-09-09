# send-flexible-invoice-email

Sends a flexible-billing **invoice notification** email to the billing subject (member `Email` or company `BillingEmail`).

Invoked after:

- Admin **Generar Factura** (`PaymentsAdminService.generateReceipt`)
- Daily **receipts-generate** cron (`generate_invoice_for_cycle`)

## Secrets / env

| Variable | Required | Description |
|----------|----------|-------------|
| `SEND_EMAILS_ENABLED` | No | Set to `true` to send via Resend. Default local: `false` (dry-run). |
| `RESEND_API_KEY` | When sending | Resend API key. |
| `INVOICE_FROM_EMAIL` | No | From address. Default: `Holiday Trips <billing@holidaytrips.com>` |
| `INVOICE_EMAIL_CRON_SECRET` | Cron only | Shared secret; `receipts-generate` sends header `x-cron-secret`. Must be non-empty for cron auth. |

## Local dry-run

With `SEND_EMAILS_ENABLED=false`, the function logs the **full** email payload (`to`, `subject`, `html`) to the edge runtime console and returns `{ success: true, mode: 'dry-run' }`.

## Request

- Method: `POST`
- JSON: `{ "invoiceId": "<uuid>" }`
- Auth:
  - **Admin UI**: `Authorization: Bearer <user JWT>` (admin role)
  - **Cron** (`receipts-generate`): service role bearer, or `x-cron-secret` matching `INVOICE_EMAIL_CRON_SECRET` when set

## Deploy

```bash
supabase functions deploy send-flexible-invoice-email
```

`verify_jwt` is `false` in `config.toml`; auth is enforced in the handler.
