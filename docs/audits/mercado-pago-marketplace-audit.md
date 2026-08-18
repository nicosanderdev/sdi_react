# Mercado Pago Marketplace + Checkout Pro Audit

**Date:** 2026-08-17  
**Scope:** `sdi_react` backend (Supabase Edge Functions, RPCs, SQL) and dashboard seller-connect UI. Guest pay UI is owned by separate guest sites.  
**Sources of truth:** current official Mercado Pago documentation (Uruguay) plus the implementation in this repository. Cited requirements are collected in [`docs/research/mercado-pago-marketplace-official.md`](../research/mercado-pago-marketplace-official.md).  
**Constraint:** no code changes, no real payments, no secrets printed.

---

## 1. Executive Summary

**Verdict: mostly correct with issues — not production-ready until the High items below are fixed and the operator checklist is complete.**

The implementation **does follow the official Marketplace + Checkout Pro model**:

- Sellers connect through OAuth authorization-code (with `platform_id=mp`, `state`, and PKCE).
- `client_secret` and seller tokens stay on the server.
- Checkout Pro preferences are created with **the connected seller’s OAuth access token**, not the marketplace application token.
- Amounts come from the server-side booking quote, not from React.
- `marketplace_fee` is omitted (official default is `0`; this matches the documented zero-fee “bridge” policy).
- Webhooks verify `x-signature` HMAC and then `GET /v1/payments/{id}` before recording approval.
- Seller tokens are AES-GCM encrypted at rest; MP tables have RLS enabled and no client policies.

It is **not** a secure, complete, end-to-end production system yet, because:

1. Approval is audit-only (`Bookings.MercadoPagoApprovedAt`). `Bookings.PaymentStatus` and `Status` are never updated, so the rest of the product still treats the booking as unpaid.
2. Refunds / chargebacks update the attempt row but **never clear** `MercadoPagoApprovedAt`.
3. The webhook often returns HTTP 200 on processing failure (`payment_not_matched`, `mark_failed`), so Mercado Pago will not retry.
4. Preference creation can be authorized with a short reservation code (`RSV-XXXXXX`) instead of the manage token.
5. `external_reference` is `booking:{uuid}:attempt:{uuid}` (~89 chars, includes colons). Official max is **64** characters and only letters, numbers, hyphens, underscores — webhook matching can break if MP rejects or truncates it.
6. Guest “pay now / return / poll” UI is **not in this repo**. This repo is the backend + admin connect UX only.
7. Schema/secrets are operator-applied (`20260717220000_mercado_pago_marketplace.sql` is documented as manual). This audit cannot confirm production has them.

A malicious user **cannot** associate their Mercado Pago account with another seller by forging callback query params: `state` is bound to the hashed invite, and the member_id comes from that invite. They **can** connect *their* MP account to the invited member if they steal the 10-minute WhatsApp link.

---

## 2. Architecture Map

```text
Admin (React)
  UserManagementToolbar → MercadoPagoAdminService
       POST mercado-pago-admin { send_link | unlink }
            ↓ WhatsApp template link_mercado_pago
Seller phone
       GET /conectar-con-mercado-pago?token=…
  MercadoPagoConnectPage
       POST mercado-pago-connect { token }
            ↓ authorizationUrl
  Mercado Pago OAuth (auth.mercadopago.com)
       GET mercado-pago-connect/callback?code&state
            ↓ AES-GCM tokens
  PostgreSQL mercado_pago_accounts (member_id ↔ mp_user_id)

Guest site (out of this repo)
       confirm_booking_from_hold / get_reservation_by_code
       POST mercado-pago-create-preference
            ↓ seller access_token
  POST https://api.mercadopago.com/checkout/preferences
       buyer pays on Checkout Pro
  POST mercado-pago-webhook (x-signature)
       GET https://api.mercadopago.com/v1/payments/{id}
       RPC mark_booking_mercado_pago_approved
            ↓ MercadoPagoApprovedAt only
```

### React

| Piece | Path |
| --- | --- |
| Admin send/resend invite, unlink | `src/components/admin/users/UserManagementToolbar.tsx` |
| Unlink confirm modal | `src/components/admin/users/UnlinkMercadoPagoConfirmModal.tsx` |
| Status badge | `src/components/admin/users/UserManagementTable.tsx` |
| Admin API client | `src/services/MercadoPagoAdminService.ts` |
| Public connect start | `src/pages/public/MercadoPagoConnectPage.tsx` |
| Public connect result | `src/pages/public/MercadoPagoConnectResultPage.tsx` |
| Routes | `/conectar-con-mercado-pago`, `/conectar-con-mercado-pago/resultado` in `src/App.tsx` |
| Guest TypeScript contract | `src/types/guestReviewContract.ts` |
| Unrelated dashboard payments | `src/services/PaymentService.tsx` → **dLocal**, not Mercado Pago |

### Edge Functions (`verify_jwt = false` in `supabase/config.toml`; auth is in-handler)

| Function | Role |
| --- | --- |
| `mercado-pago-admin` | Admin JWT + `Role=admin`. Create hashed invite, send WhatsApp, unlink local credentials |
| `mercado-pago-connect` | Public. `POST` start OAuth; `GET /callback` exchange code |
| `mercado-pago-create-preference` | Public. Prove booking via manage token **or** reservation code + listing type |
| `mercado-pago-webhook` | Public. HMAC + payment GET + audit RPC |
| `_shared/mercadoPago.ts` | OAuth, PKCE, AES-GCM, refresh, HMAC, redaction |

### RPC functions

| RPC | Execute grant | SECURITY DEFINER | Returns tokens? |
| --- | --- | --- | --- |
| `get_member_mercado_pago_status` | `authenticated`, `service_role` | yes | no (status string only) |
| `resolve_mercado_pago_seller_for_property` | `service_role` only | yes | no (public_key, mp_user_id, member_id) |
| `get_booking_mercado_pago_payment_info` | `service_role` only | yes | no (includes `seller_member_id`) |
| `mark_booking_mercado_pago_approved` | `service_role` only | yes | no |
| `get_booking_payment_status_by_manage_token` | `anon`, `authenticated`, `service_role` | yes | no, but forwards `seller_member_id` |
| `confirm_booking_from_hold` / `get_reservation_by_code` / `get_booking_by_manage_token` | existing guest grants | yes | eligibility flags only |
| `get_admin_users_list` / `get_admin_user_detail` | `authenticated` (admin check inside) | yes | status only |

### Database tables

`mercado_pago_accounts`, `mercado_pago_link_requests`, `mercado_pago_payment_attempts`, `mercado_pago_webhook_events`, plus `Bookings.MercadoPagoApprovedAt` and `booking_holds.quoted_total` / `quoted_currency`.

Internal seller association: `Members.Id` → `mercado_pago_accounts.member_id`. Property owner: `EstateProperties` → `Owners` (`member` uses `Owners.MemberId`; `company` uses `Companies.BillingContactUserId` + active `CompanyMembers`). Booking ↔ payment: `mercado_pago_payment_attempts.booking_id` + `external_reference` = `booking:{uuid}:attempt:{uuid}`.

### Mercado Pago API usage

| Operation | Method | Endpoint | Authorization |
| --- | --- | --- | --- |
| Seller authorize | GET | `https://auth.mercadopago.com/authorization` | none (public client_id) |
| Code exchange | POST | `https://api.mercadopago.com/oauth/token` | `client_id` + `client_secret` in body |
| Refresh | POST | `https://api.mercadopago.com/oauth/token` | same |
| Create preference | POST | `https://api.mercadopago.com/checkout/preferences` | `Bearer` **seller** access_token |
| Get payment | GET | `https://api.mercadopago.com/v1/payments/{id}` | platform token if set, else seller token |

---

## 3. OAuth Audit

| Step | Current implementation | Expected (official) | Status |
| --- | --- | --- | --- |
| Authorization URL | `https://auth.mercadopago.com/authorization` with `client_id`, `response_type=code`, `platform_id=mp`, `state`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256` | Same URL and params. PKCE recommended; must be enabled on the MP application if used. `redirect_uri` must be a **static** match | **PASS** (ops: PKCE toggle + exact redirect URI) |
| Frontend credentials | React only posts the opaque invite token and receives `authorizationUrl`. No secret, no seller token | Never put `client_secret` / tokens in the auth URL or browser | **PASS** |
| CSRF / state | Random `state`, stored as SHA-256 on the invite row; callback looks up by hash | Unique non-sensitive `state` so the code belongs to the same request | **PASS** |
| Callback | `GET mercado-pago-connect/callback` Edge Function | Server-side only | **PASS** |
| Code exchange | `POST /oauth/token` with `grant_type=authorization_code`, `client_secret`, `code_verifier`, optional `test_token` | Same. Authorization code valid 10 minutes | **PASS** |
| Token persistence | AES-GCM JSON blob in `access_token_encrypted` / `refresh_token_encrypted`. Key = SHA-256(`MERCADO_PAGO_TOKEN_ENCRYPTION_KEY`) | Official: store seller credentials safely, server-side | **PASS** (see encryption caveats) |
| Seller association | Invite token → `member_id`. Unique `(member_id)` and unique `(mp_user_id)` | Must bind the MP `user_id` to the intended internal seller | **PASS** |
| Refresh token | Stored encrypted; refreshed in create-preference and webhook when near expiry; new refresh token persisted | Access token 180 days; refresh requires `offline_access`; **new refresh_token must be stored** | **PASS** (ops: confirm `offline_access` on the MP app) |
| Reconnect | Blocked while connected; admin unlink then new invite | Not specified; local unlink cannot revoke on MP (no marketplace revoke API — documented in code) | **PASS** for local unlink; seller must also revoke in MP settings |
| Result page | Trusts `?status=success` for UX only; does not write DB | Display only | **PASS** security / **WARN** UX spoofing |

A stolen WhatsApp invite (10 minutes, one-time) lets the thief connect **their** MP account to the invited member. That is inherent to the invite-link model, not a callback IDOR.

---

## 4. Checkout Pro Audit

Implemented in `supabase/functions/mercado-pago-create-preference/index.ts`.

| Field | Implementation | Official | Assessment |
| --- | --- | --- | --- |
| Endpoint | `POST /checkout/preferences` | Required | **Correct** |
| Authorization | Seller OAuth access_token, refreshed if expiring within 5 minutes | Marketplace Checkout Pro **must** use each seller’s OAuth token | **Correct** |
| `items[].title` | `Reserva {reservation_code}` | Required in practice | **Correct** |
| `items[].quantity` | `1` | Required | **Correct** |
| `items[].unit_price` | `Bookings.TotalAmount` from RPC | Required; must not come from the client | **Correct** |
| `items[].currency_id` | Server `currency_code_from_int` (`1` → `UYU`, default `USD`) | Optional in API schema; UYU example exists on the Uruguay preference API | **Correct** for Uruguay when the listing currency is UYU |
| `external_reference` | `booking:{bookingId}:attempt:{attemptId}` (~89 chars, colons) | Optional. Max **64** chars; only letters, numbers, hyphens, underscores | **Non-compliant** — length and charset |
| `notification_url` | `MERCADO_PAGO_NOTIFICATION_URL` or `{SUPABASE_URL}/functions/v1/mercado-pago-webhook` | Optional; HTTPS; max 248 chars; no localhost; takes precedence over app webhook URL | **Correct in production HTTPS**; local HTTP/localhost is rejected by MP |
| `back_urls` | Guest origin `/pago-mercado-pago/resultado?status=…&bookingId=…` | Optional; **HTTPS mandatory**; HTTP discarded; **no localhost / 127.0.0.1** | **Correct if guest bases are HTTPS**; local URLs will be ignored |
| `auto_return` | `approved` | Optional | **Correct** |
| `metadata` | booking_id, attempt_id, seller_member_id | Optional | **Correct** |
| `marketplace_fee` | Omitted | Optional **fixed amount**, default `0`. Can only be sent if a valid `marketplace` is also defined. Guide heading “percentage” is not the API type | **Correct** for zero-fee policy |
| `marketplace` | Omitted | Optional; response examples look like `MP-MKT-{APP_ID}`. Whether it is inferred from the seller OAuth token is **ambiguous** | **OK while fee is omitted**; must set it if you later send `marketplace_fee` |
| `sandbox_init_point` | Returned to the guest contract; handoff says use it for test accounts | Preference API: **do not use**; test with `init_point` | **Incorrect vs current official preference API** |
| `payer` | Omitted | Optional | **Correct** (not required) |
| `X-Idempotency-Key` | **Random** per call | **Not shown** on Create Preference examples (required for refunds / some Payments APIs) | **Not an official preference requirement**; still a retry hazard |
| Client amount | Not accepted | Must not trust frontend money | **Correct** |

Hold quote: `create_booking_hold` stores server `pricing.total_price`. `p_client_total` is only a mismatch check (`PRICE_QUOTE_MISMATCH`). Confirm copies `quoted_total` into `Bookings.TotalAmount`. Preference creation does not take an amount from React.

---

## 5. Token Audit

| Credential | Where stored | Who uses it | Exposed to React? |
| --- | --- | --- | --- |
| `MERCADO_PAGO_CLIENT_ID` | Edge secret | Auth URL + token exchange | Only indirectly inside MP’s authorization URL (expected; client_id is public) |
| `MERCADO_PAGO_CLIENT_SECRET` | Edge secret | Token exchange + refresh | **No** |
| Seller `access_token` | AES-GCM in `mercado_pago_accounts` | Preference POST, payment GET, refresh | **No** (table revoked from `anon`/`authenticated`) |
| Seller `refresh_token` | AES-GCM, same table | Refresh grant | **No** |
| `MERCADO_PAGO_TOKEN_ENCRYPTION_KEY` | Edge secret | Encrypt/decrypt | **No** |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Edge secret | HMAC verify | **No** |
| `MERCADO_PAGO_ACCESS_TOKEN` | Optional Edge secret | Webhook `GET /v1/payments/{id}` first | **No** |
| Seller `public_key` | Plaintext column | Returned by `resolve_mercado_pago_seller_for_property` (service_role only). **Not used** in Checkout Pro redirect (Checkout Pro uses `init_point`, not Bricks/`public_key`) | **No** to React |

Local `supabase/functions/.env` contains real-looking client id/secret/encryption key. That file is **gitignored**. Do not commit it. This report does not reprint those values.

`MERCADO_PAGO_ACCESS_TOKEN` is the **marketplace application** token (or whatever the operator stored). Official marketplace payment GET can use the seller token; a platform token is a convenience. If that env is a **single seller** token, webhooks for other sellers will fall through to the token-spray path.

---

## 6. Database / RPC Audit

### `mercado_pago_accounts`

- PK `id`; unique `member_id`; unique `mp_user_id`
- FK `member_id` → `Members.Id`
- Sensitive: `access_token_encrypted`, `refresh_token_encrypted`
- Status: row exists ⇒ connected
- RLS on; **no** policies for `anon`/`authenticated`; `REVOKE ALL` from those roles

### `mercado_pago_link_requests`

- Stores `token_hash` only (raw token lives in WhatsApp / logs in dry-run)
- `oauth_state_hash`, `pkce_verifier_encrypted` cleared after use
- 10-minute TTL

### `mercado_pago_payment_attempts`

- FK `booking_id`, `member_id`
- Stores preference id, init points, payment id, expected amount/currency, provider status
- Unique preference id / payment id (partial unique indexes)
- Status check includes pending / approved / rejected / cancelled / refunded / charged_back / expired

### `mercado_pago_webhook_events`

- Dedupes on `provider_event_id` (typically `x-request-id`)
- Payload stored after `redactSensitive`

### RPC security

- Token save/load is **not** done via RPC; Edge Functions use the service role.
- `mark_booking_mercado_pago_approved` is service_role only, locks attempt + booking, checks amount (±0.01) and currency, is idempotent on `MercadoPagoApprovedAt`.
- `get_member_mercado_pago_status(p_member_id)` is callable by **any authenticated user** with any UUID. It does not return tokens, but it leaks whether that member is connected or invited.
- `get_booking_payment_status_by_manage_token` is correctly gated by the manage token, but it returns the full payment-info JSON including `seller_member_id`.

A client cannot `select` another seller’s access_token through PostgREST: tables are revoked and have no RLS policies that allow it.

---

## 7. Webhook Audit

| Topic | Handling |
| --- | --- |
| `payment` / `topic_payment` | HMAC → `GET /v1/payments/{id}` → map to attempt via payment id / `external_reference` |
| `merchant_order` | Uses **`payload.payments` from the JSON body** (not signed) instead of official `GET /merchant_orders/{id}` |
| `mp-connect` unlink/revoke | Deletes `mercado_pago_accounts` by `mp_user_id` |
| `chargebacks` / `topic_chargebacks_wh` | **Not handled** (official Checkout Pro topic) |
| `topic_claims_integration_wh` | **Not handled** |
| Other | Ack `ignored` |

**Verification:** HMAC SHA-256 over `id:{dataId};request-id:{x-request-id};ts:{ts};` matches current official manifest, including lowercase alphanumeric ids. Official docs also say `data.id` should come from **URL query params**; this code uses the JSON body. They are usually the same; if they diverge, signatures fail.

**Trust model:** payment notifications do **not** trust the body for money state; they GET the payment. That matches official guidance. Official docs **do not** state that a marketplace application token can GET a connected seller’s payment; seller OAuth token is the documented checkout credential. `MERCADO_PAGO_ACCESS_TOKEN` first is undocumented.

**Statuses:** `approved` → RPC; `pending`/`in_process` → attempt `pending`; `rejected` / `cancelled` / `refunded` / `charged_back` → attempt status only. `authorized` and `in_mediation` fall through to `pending`. **Approved flag is never cleared.** Uruguay offline methods (Abitab, Red Pagos) stay `pending` until paid at a physical point — that path is expected.

**Ack SLA:** official: HTTP **200 or 201 within 22 seconds**, then GET the resource. This handler GETs **before** responding. Slow GETs can miss the SLA (MP retries). Returning 200 on processing failure still stops retries.

**Idempotency:** event table by `x-request-id`; approval RPC coalesces `MercadoPagoApprovedAt`. Official webhook docs do not define an inbound idempotency key; retries of the same `data.id` are expected.

**Unsigned bypass:** `MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS=true` skips HMAC. There is no production guard.

**Timestamp window:** official docs say you *can* compare `ts` to now. Not implemented. Replay of a captured signed request is possible.

---

## 8. Security Findings

| ID | Sev | Problem | Evidence | Why it matters | Fix |
| --- | --- | --- | --- | --- | --- |
| S1 | **HIGH** | Unsigned webhook kill-switch has no environment guard | `mercado-pago-webhook/index.ts` `MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS` | Anyone can POST fake payment ids if this is true in hosted projects | Refuse the flag unless URL is local; never set on staging/prod |
| S2 | **HIGH** | Failed payment application still HTTP 200 | webhook `return json({ success: outcome.ok, … })` default 200 | MP will not retry; bookings stay unapproved after real money | Return 5xx when signature is valid but GET/apply failed |
| S3 | **HIGH** | `payment_not_matched` / `attempt_not_found` acked as `ok: true` | `handlePaymentNotification` | Same: lost notifications | 5xx or a retryable 4xx only for true duplicates |
| S4 | **HIGH** | Seller-token spray | `fetchPayment` walks last 25 pending attempts’ tokens | Wrong-token attempts, extra MP API traffic, fragile matching if platform token is unset | Resolve seller from `external_reference` / `collector_id` first; require platform token or look up attempt before GET |
| S5 | **HIGH** | Reservation code authorizes preference creation | `resolveBookingId` + `get_reservation_by_code` | Codes are short lookup values; anyone who knows `RSV-XXXXXX` + listing type can open Checkout Pro for that booking | Require manage token (or a payment-specific nonce) for create-preference |
| S6 | **HIGH** | `merchant_order` trusts unsigned body `payments[]` | HMAC does not cover JSON fields | A replayed signed merchant_order can carry a swapped payments array | `GET /merchant_orders/{data.id}` with a seller/platform token |
| S7 | **MEDIUM** | No `ts` freshness check | `verifyWebhookSignature` | Official optional replay mitigation | Reject if `ts` is older than N minutes |
| S8 | **MEDIUM** | HMAC `data.id` from body, not query string | Official webhook docs | Signature mismatch or wrong id if MP only signs the query param | Prefer `url.searchParams.get('data.id')` |
| S9 | **MEDIUM** | Any authenticated user can call `get_member_mercado_pago_status(any uuid)` | GRANT + no `auth.uid()` check | Leaks invite/connected status | Revoke from `authenticated` or check admin / self |
| S10 | **MEDIUM** | Edge Functions return `error.message` to clients | connect / create-preference / webhook catch | Can leak env names or MP API errors | Generic client error; log internally |
| S11 | **MEDIUM** | CORS `Access-Control-Allow-Origin: *` on all MP functions | `_shared/cors.ts` | Broad browser access (still need the invite/manage token) | Restrict to app origins |
| S12 | **MEDIUM** | Dry-run WhatsApp logs the full connect URL | `mercado-pago-admin` README / WhatsApp helper | Invite token in logs | Acceptable for staging; redact in production log drains |
| S13 | **LOW** | `get_booking_payment_status_by_manage_token` returns `seller_member_id` | payment-info JSON | Internal UUID leak | Strip before returning to anon |
| S14 | **LOW** | Result page trusts `status` query param | `MercadoPagoConnectResultPage` | Fake success screen; no DB write | Optional: poll a public “am I connected?” endpoint with the invite |
| S15 | **INFO** | AES-GCM with env-derived key, no rotation | `getAesKey()` | Service role + env key can decrypt; acceptable if secrets stay in Supabase | Document rotation / reconnect-all procedure |
| S16 | **INFO** | Webhook tries `MERCADO_PAGO_ACCESS_TOKEN` (app token) before seller token | `fetchPayment` | Official docs do **not** say the marketplace app token can GET a seller payment | Prefer the seller token resolved from `user_id` / `external_reference` |

**Not found:** client_secret or seller tokens in React; hardcoded production secrets in tracked source; PostgREST access to encrypted tokens; frontend-set `marketplace_fee` or price on preference create.

---

## 9. Functional Findings

| ID | Sev | Problem | Why it matters |
| --- | --- | --- | --- |
| F1 | **HIGH** | Webhook sets `MercadoPagoApprovedAt` only; never `Bookings.PaymentStatus` or `Status` | Reviews and host-side “paid” logic still require `PaymentStatus = 1`. Ops dashboards stay unpaid |
| F2 | **HIGH** | Refund / chargeback does not clear `MercadoPagoApprovedAt`; `can_pay_online` stays false | Guest UI will show paid after a refund |
| F3 | **HIGH** | Preference `X-Idempotency-Key` is random; reuse only works if a prior row already has `init_point` | Timeout after insert but before MP responds creates duplicate Checkout Pro preferences. Official Create Preference examples do **not** require this header |
| F4 | **HIGH** | `external_reference` is ~89 chars and contains colons | Official max 64 chars; charset is letters, numbers, hyphen, underscore. Matching webhooks to attempts can fail if MP strips or rejects the value |
| F5 | **MEDIUM** | HTTP / localhost `back_urls` and `notification_url` | Official: HTTPS mandatory; HTTP discarded; **no localhost / 127.0.0.1** |
| F6 | **MEDIUM** | Guest contract / handoff tells sites to use `sandboxInitPoint` for tests | Preference API: **do not use** `sandbox_init_point`; test with `init_point` |
| F7 | **MEDIUM** | Reused preference response omits `disclaimerKey` | Guest contract is incomplete on reuse |
| F8 | **MEDIUM** | Inventory is held at booking confirm, before payment | By product design (pay later); not a bug, but not “paid = reserved”. Uruguay Abitab/Red Pagos also stay pending until paid offline |
| F9 | **MEDIUM** | Guest pay / return / poll UI is not in this repository | End-to-end Uruguay checkout is incomplete inside `sdi_react` |
| F10 | **MEDIUM** | Chargeback / claim webhook topics are ignored | Official Checkout Pro topics exist; only attempt-row mapping from `payment.status` covers chargebacks if a payment notification arrives |
| F11 | **LOW** | No seller self-serve reconnect; admin must unlink first | Extra ops friction |
| F12 | **LOW** | `public_key` stored but unused | Harmless for Checkout Pro (`init_point`). Official pages disagree whether frontend should use seller vs integrator `public_key` |
| F13 | **INFO** | Dashboard `PaymentService` is dLocal, not Mercado Pago | Do not treat dashboard checkout pages as this integration |

---

## 10. Missing Pieces

Required by official Marketplace + Checkout Pro, or by a safe production operation of this product:

1. Confirm SQL migration applied on the target project.
2. Confirm Edge secrets and MP application settings (redirect URI exact match, PKCE enabled if sending challenge, webhook URL + secret, `offline_access`).
3. Guest-site pay-now UI, disclaimer, redirect to `init_point`, return page that **polls** `get_booking_payment_status_by_manage_token` and ignores `status=` query params as money state (handoff already states this).
4. HTTPS guest `back_urls` and webhook URL; production redirect URI must be HTTPS and exact-match.
5. Reliable webhook retry (do not 200 on processing failure). Stay under the official **22 second** ack window or ack then process asynchronously.
6. Payment-status mapping into `Bookings.PaymentStatus` **or** a conscious product change so all consumers read `MercadoPagoApprovedAt`.
7. Refund / chargeback reversal of the approved flag (and of `PaymentStatus` if you start writing it). Handle `chargebacks` / claims topics or rely only on payment-status GET.
8. `external_reference` within 64 chars and allowed charset so webhook matching survives MP validation.
9. Production ban on unsigned webhooks.
10. Guest sites: use `init_point` even in test (official: do not use `sandbox_init_point`).
11. Optional later: non-zero `marketplace_fee` as a **server-side fixed amount**, and set `marketplace` if the fee is sent.

Not missing vs official docs: PKCE (recommended, implemented), refresh (implemented), seller-token preference create (implemented), HMAC + GET payment (implemented), UYU via `currency_id` (implemented when listing currency is 1).

---

## 11. Incorrect Pieces

These exist but do not follow official or safe practice:

1. `external_reference` length (~89) and colons vs official max 64 / `[A-Za-z0-9_-]`.
2. Returning / recommending `sandbox_init_point` (preference API: do not use; test with `init_point`).
3. `merchant_order` handler using unsigned body payments instead of `GET /merchant_orders/{id}`.
4. HTTP 200 for unsuccessful payment application (stops the official retry schedule).
5. HMAC `data.id` sourced only from JSON, not the query string named in the official manifest.
6. Localhost / HTTP `back_urls` and notification URLs (officially discarded).
7. Chargeback/claim topics not subscribed in code (payment `charged_back` is mapped if a payment notification arrives).
8. Informal marketplace docs say “commission percentage”; the preference API is a **fixed amount**. The code correctly omits the field rather than sending a percentage.

Random `X-Idempotency-Key` on preference create is a **retry hazard**, not an official Create Preference requirement.

Older vs current API: this is **not** an obsolete IPN-only integration. It uses current OAuth, current preference API, and current `x-signature` webhooks. IPN is officially being discontinued; this code does not use IPN.

---

## 12. Recommended Changes (priority)

### 1. Critical fixes

- None in tracked source (no client-side secrets, no plaintext token RPC). Treat **S1** as critical the moment unsigned webhooks are enabled on a hosted project.

### 2. Required Marketplace fixes

- Keep seller-token preference creation (already correct).
- When you charge a fee: compute a **fixed** `marketplace_fee` server-side in the booking currency; also send a valid `marketplace` identifier. Never accept the fee from React.
- Shorten `external_reference` to ≤64 chars of `[A-Za-z0-9_-]` (keep the mapping in `mercado_pago_payment_attempts`).

### 3. Required OAuth fixes

- Operator: enable PKCE on the MP application if not already; register the exact **HTTPS** `MERCADO_PAGO_REDIRECT_URI`; confirm `offline_access`.
- Store the **new** `refresh_token` on every refresh (already done). Do not assume the old refresh token can be replayed — API and renewal pages say rotate-on-use; the OAuth overview’s “can be reused” conflicts.

### 4. Required payment / webhook fixes

- Return 5xx when payment GET or `mark_booking_mercado_pago_approved` fails (or ack 200 quickly and process asynchronously, then reconcile).
- Fetch merchant orders from `GET /merchant_orders/{id}`.
- Resolve the seller from `external_reference` / stored attempt / webhook `user_id` before trying tokens.
- Require manage token for create-preference (or an equivalent unguessable secret).
- Guest sites: redirect to `init_point`, not `sandbox_init_point`.
- Define refund/chargeback behavior for `MercadoPagoApprovedAt` / `PaymentStatus`.

### 5. Security improvements

- Guard unsigned webhooks to localhost only.
- Check webhook `ts` skew.
- Use query `data.id` for HMAC.
- Restrict `get_member_mercado_pago_status`.
- Stop returning raw exception messages.
- Tighten CORS.

### 6. Optional improvements

- Key rotation runbook for `MERCADO_PAGO_TOKEN_ENCRYPTION_KEY`.
- Seller self-serve reconnect.
- Include `disclaimerKey` on reused preferences.
- Drop unused `public_key` from guest-facing contracts.

---

## Operator / test notes (no payments executed)

Hardening landed after this audit (2026-08-17): `20260817200000_mercado_pago_payment_status.sql` (apply after `20260717220000`), compact `external_reference`, manage-token-only create-preference, webhook 5xx on miss/fail, merchant_order GET, refund/chargeback clear `PaymentStatus`, unsigned webhooks local-only, generic 500s. Guest pay UI remains out of this repo. Details: `docs/handoffs/guest-mercado-pago-payments.md`.

Local/staging path: apply **both** SQL migrations, set secrets, deploy the four functions, connect a **test** seller via the admin invite, create a booking, call create-preference with **manage token**, redirect **`init_point`** (not sandbox), pay with MP test buyers, simulate a **signed** webhook. Confirm `PaymentStatus = 1` and booking `Status` unchanged. Test payments do not send live webhooks. `MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS=true` works only when `SUPABASE_URL` is localhost/127.0.0.1/kong — hosted projects always require HMAC. CORS on these public functions is `*` so guest-site origins can call them.

---

## End-to-end arrow check

| Arrow | Implemented? |
| --- | --- |
| Internal seller → React Connect | Admin sends WhatsApp; seller opens public page | Yes |
| React → MP OAuth | Redirect to `authorizationUrl` from Edge Function | Yes |
| MP → Edge callback | `mercado-pago-connect/callback` | Yes |
| Code exchange | Server `POST /oauth/token` | Yes |
| Tokens → PostgreSQL | Encrypted upsert on `member_id` | Yes |
| Buyer booking → React | Guest sites (out of repo) | **Missing here** |
| React → create-preference | Guest sites must call the function | **Missing here** |
| Retrieve seller credentials | Service-role select + decrypt + refresh | Yes |
| `POST /checkout/preferences` | Seller bearer token | Yes |
| `marketplace_fee` | Omitted (= 0) | Yes (policy) |
| Checkout Pro | `init_point` returned | Yes |
| Notification → webhook | Function exists | Yes |
| Verify payment | `GET /v1/payments/{id}` | Yes, with spray/ack flaws |
| DB updated | `MercadoPagoApprovedAt` only | Partial |

**Bottom line:** the Marketplace OAuth + seller-token Checkout Pro core is implemented in line with current official docs. Do not treat it as production-ready for Uruguay until webhook retry/ack, `external_reference` charset/length, refund handling, payment-status consistency, preference auth, operator HTTPS config, and guest-site UI are in place.

Official ambiguities that this audit does **not** invent a resolution for (see the research note): auth host `.com` vs `.com.uy`; whether the marketplace app token can GET seller payments; seller vs integrator `public_key` on the frontend; whether `marketplace` must be set when fee is 0; refresh-token reuse vs rotate-on-use.
