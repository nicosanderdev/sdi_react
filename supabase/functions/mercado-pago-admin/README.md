# mercado-pago-admin

Admin-only edge function for Mercado Pago seller invites and unlink.

## Actions

```json
{ "action": "send_link", "memberId": "<Members.Id>" }
{ "action": "unlink", "memberId": "<Members.Id>" }
```

`send_link` creates a one-time 10-minute opaque site token, stores only its SHA-256 hash, and sends WhatsApp template `link_mercado_pago` with body params `[firstName, fullLink]`.

`unlink` deletes `mercado_pago_accounts` for the member and clears outstanding link request secrets. Mercado Pago has no marketplace revoke API; sellers can also revoke the app in their MP account.

## Mock mode (dry-run)

When WhatsApp mock is on, Meta is **not** called. The template name and body params (including the full connect URL) are printed to the edge function logs / local serve terminal. Response includes `whatsappMode: "dry-run"`.

Enabled when:

- `SUPABASE_URL` is local (`127.0.0.1`, `localhost`, or `kong`), unless `BOOKING_OTP_LIVE_ENABLED=true`
- **or** hosted staging/prod has secret `BOOKING_OTP_MOCK=true` (same flag as booking OTP)

Member still needs a valid phone number; the invite link is only in the logs, not in the HTTP body.

### Staging dry-run

```bash
npx supabase secrets set BOOKING_OTP_MOCK=true --project-ref <staging-ref>
npx supabase functions deploy mercado-pago-admin --project-ref <staging-ref>
```

Admin → send Mercado Pago invite → read the connect URL from **Edge Functions → mercado-pago-admin → Logs** (`bodyParameters`). Link TTL is 10 minutes.

Remove the secret (or set `BOOKING_OTP_MOCK=false`) before relying on live WhatsApp.

## Secrets

- `MERCADO_PAGO_PUBLIC_APP_URL` (or `PUBLIC_APP_URL`)
- `META_WHATSAPP_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `BOOKING_OTP_MOCK` — optional; `true` for log-only invites on hosted projects
