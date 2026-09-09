# mercado-pago-connect

Public OAuth start + Mercado Pago callback for seller account linking.

Sellers do **not** paste an Access Token. An admin sends a 10-minute WhatsApp invite; the seller authorizes the **Marketplace** application; this function stores encrypted seller tokens.

## Endpoints

- `POST /functions/v1/mercado-pago-connect` body `{ "token": "<opaque 10-minute site token>" }` → `{ authorizationUrl }`
- `GET /functions/v1/mercado-pago-connect/callback?code=&state=` → redirects to `/conectar-con-mercado-pago/resultado`

## Authorize URL

Default host (Uruguay Split Payments 1:1):

`https://auth.mercadopago.com.uy/authorization`

Optional override: `MERCADO_PAGO_AUTH_URL` (no trailing slash).

Query params always include `client_id`, `response_type=code`, `platform_id=mp`, `state`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`.

## Mercado Pago dashboard (required)

Do **not** create the app from the Checkout Pro “self-developed store” flow. That is a store Checkout Pro app, not Marketplace OAuth.

1. [Your integrations](https://www.mercadopago.com.uy/developers/panel/app) → **Create application**.
2. **Online payments** → product **Checkout Pro** → integration model **Marketplace**.
   If the existing app was created without Marketplace, recreate it (the model usually cannot be switched).
3. **Redirect URL** must match `MERCADO_PAGO_REDIRECT_URI` **exactly** (HTTPS, static, no query string):

   `https://<project>.supabase.co/functions/v1/mercado-pago-connect/callback`

4. Enable **PKCE** on the application. This function always sends a S256 challenge; Mercado Pago rejects the authorize request if PKCE is off.
5. Confirm OAuth can issue `offline_access` (needed to refresh seller tokens).
6. Put **Client ID** / **Client Secret** in Edge secrets. Do **not** use the marketplace production Access Token as a seller credential.
7. Configure the webhook URL + secret for `mercado-pago-webhook` (see guest payments handoff).

A Mercado Pago error page that never returns to `/callback` almost always means one of: wrong app type, host, PKCE off, or `redirect_uri` mismatch.

OAuth start logs `client_id`, authorize host, and `redirect_uri` only. It never logs `client_secret`, seller tokens, or the PKCE verifier.
