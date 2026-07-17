# mercado-pago-admin

Admin-only edge function for Mercado Pago seller invites and unlink.

## Actions

```json
{ "action": "send_link", "memberId": "<Members.Id>" }
{ "action": "unlink", "memberId": "<Members.Id>" }
```

`send_link` creates a one-time 10-minute opaque site token, stores only its SHA-256 hash, and sends WhatsApp template `link_mercado_pago` with body params `[firstName, fullLink]`.

`unlink` deletes `mercado_pago_accounts` for the member and clears outstanding link request secrets. Mercado Pago has no marketplace revoke API; sellers can also revoke the app in their MP account.

## Secrets

- `MERCADO_PAGO_PUBLIC_APP_URL` (or `PUBLIC_APP_URL`)
- `META_WHATSAPP_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
