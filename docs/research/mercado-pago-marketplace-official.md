# Mercado Pago Marketplace + Checkout Pro — official requirements (Uruguay)

**Research date:** 2026-08-17  
**Scope:** Current official Mercado Pago documentation for a Uruguay (UYU) Marketplace integration that uses OAuth to connect sellers, Checkout Pro for buyer payments, `marketplace_fee` for platform commission, and webhooks/notifications for payment status.

**Sources used:** Official Mercado Pago developer documentation on `www.mercadopago.com.uy` (and the same product family on other Mercado Pago country domains only where the Uruguay page is a copy of the same spec). No blogs, Stack Overflow, GitHub tutorials, or unofficial examples.

**How to read this note:** Every requirement is tagged **Required**, **Optional**, **Recommended**, **Deprecated**, or **Ambiguous**. If a claim is not in official docs, it is not stated as a rule.

---

## 1. Marketplace OAuth

Primary sources:

- [OAuth overview (UY)](https://www.mercadopago.com.uy/developers/en/docs/security/oauth)
- [Get Access Token (UY)](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation)
- [Renew Access Token (UY)](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/renewal)
- [POST /oauth/token API (UY)](https://www.mercadopago.com.uy/developers/en/reference/authentication/oauth/_oauth_token/post)
- [OAuth best practices (UY)](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/best-practices)
- [Application details / Redirect URL (UY)](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/application-details)
- [Credentials (UY)](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/credentials)
- [Split Payments 1:1 create configuration (UY)](https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/create-configuration)

### 1.1 Authorization URL

Official OAuth “Get token” example ([Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation)):

```
https://auth.mercadopago.com/authorization?client_id=APP_ID&response_type=code&platform_id=mp&state=RANDOM_ID&redirect_uri=https://www.mercadopago.com.br/developers/example/redirect-url
```

Query parameters documented on that page:

| Param | Documented meaning | Required? |
|---|---|---|
| `client_id` | Application number (APP_ID). | **Required** (shown in the example and field table). |
| `response_type` | Must be `code` for Authorization code flow. | **Required** (shown in the example). |
| `platform_id` | Example value `mp`. | **Shown in the Get-token URL**; not described in the field table on that page. Split Payments 1:1 also includes `platform_id=mp`. Treat as **documented in the marketplace/OAuth examples**. |
| `redirect_uri` | Must be the URL configured in the application’s Redirect URL field. **Must be a static URL.** | **Required**. |
| `state` | Unique identifier per attempt; must not include sensitive information; used to identify who the received code is from and to ensure the response belongs to a request initiated by the same application. | **Recommended** by OAuth docs and best practices. Split Payments 1:1 example omits it from the authorization URL. |

PKCE (optional extra security) uses a different example URL ([Get Access Token — Configure PKCE](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation)):

```
https://auth.mercadopago.com/authorization?response_type=code&client_id=$APP_ID&redirect_uri=$YOUR_URL&code_challenge=$CODE_CHALLENGE&code_challenge_method=$CODE_METHOD
```

PKCE is **not mandatory**. It is enabled in Application details. Once enabled, Mercado Pago **requires** `code_challenge` and `code_method` in OAuth requests.

**Ambiguous — authorization host:**

- OAuth security docs use `https://auth.mercadopago.com/authorization`.
- Split Payments 1:1 Uruguay docs use `https://auth.mercadopago.com.uy/authorization?client_id=&response_type=code&platform_id=mp&redirect_uri=`.

Both are official. The docs do not state which host is canonical for Uruguay marketplace OAuth.

### 1.2 Token exchange

**Endpoint:** `POST https://api.mercadopago.com/oauth/token`  
([API reference](https://www.mercadopago.com.uy/developers/en/reference/authentication/oauth/_oauth_token/post), [Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation))

**Credentials used:** marketplace application `client_id` and `client_secret` ([Credentials](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/credentials): Client ID / Client Secret are used primarily in OAuth).

**Content-Type in official examples:**

- OAuth Get Access Token curl: `Content-Type: application/json`
- Split Payments 1:1: `content-type: application/x-www-form-urlencoded`
- OAuth best practices: send parameters **in the request body**, not query params; use `accept` and `content-type` headers.

JSON body from the official curl example (`grant_type=authorization_code`):

| Field | Required? | Notes |
|---|---|---|
| `client_id` | **Required in practice** (API marks it optional in the OpenAPI-style schema; the guide says send credentials). | Application ID. |
| `client_secret` | **Required in practice** (same caveat). | Application secret. **Server-side only.** |
| `grant_type` | **Required in practice.** Value `authorization_code`. | |
| `code` | **Required** when `grant_type=authorization_code`. | Authorization code from redirect. Valid **10 minutes**, **single-use**. |
| `redirect_uri` | **Required** when `grant_type=authorization_code`. | Static URL; must match application config. |
| `code_verifier` | **Required only if PKCE is enabled.** | |
| `test_token` | **Optional.** | `"true"` generates sandbox credentials for testing. |

Split Payments 1:1 also shows `state` in the **token-exchange body**. The OAuth API schema does **not** list `state` as a `/oauth/token` field. **Ambiguous** whether `state` belongs only on the authorization URL (OAuth security docs) or also on token exchange (Split Payments example).

OAuth best practices say: do not add params that are not requested; `grant_type` values mentioned there are `authorization_code` or `client_credentials` (that page does **not** mention `refresh_token`, which other official pages do). Treat the API reference + renewal guide as the source for refresh.

### 1.3 Tokens returned

Official response example ([POST /oauth/token](https://www.mercadopago.com.uy/developers/en/reference/authentication/oauth/_oauth_token/post) and [Split Payments 1:1](https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/create-configuration)):

```json
{
  "access_token": "APP_USR-4934588586838432-XXXXXXXX-241983636",
  "token_type": "bearer",
  "expires_in": 15552000,
  "scope": "read write offline_access",
  "user_id": 241983636,
  "refresh_token": "TG-XXXXXXXX-241983636",
  "public_key": "APP_USR-d0a26210-XXXXXXXX-479f0400869e",
  "live_mode": true
}
```

| Field | Meaning per official docs |
|---|---|
| `access_token` | Seller authorization for the application. Format `APP_USR-…` (or `TEST` in sandbox). Validity from `expires_in`. |
| `token_type` | `bearer` is the only type the authorization server supports. |
| `expires_in` | Access token lifetime in seconds. **Default 180 days = 15552000 seconds.** |
| `scope` | Access granted. Allowed values documented as `offline_access`, `write`, `read`. Refresh requires `offline_access`. |
| `user_id` | Mercado Pago ID of the seller. Split Payments 1:1: **equal to `collector_id` used to capture payments.** |
| `refresh_token` | Temporary grant used only against the authorization server, never resource servers. |
| `public_key` | Seller/application public key for frontend use (payment methods, card encryption). |
| `live_mode` | Production vs test. |

### 1.4 Lifetimes and refresh

| Grant / token | Lifetime | Reuse | Source |
|---|---|---|---|
| `authorization_code` | **10 minutes** | **Single-use** | [OAuth overview](https://www.mercadopago.com.uy/developers/en/docs/security/oauth), [Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation) |
| Access token (Authorization code flow) | **180 days / 6 months** | Until expiry | Same pages; API `expires_in` default 15552000 |
| Access token (`client_credentials` flow) | **6 hours** | Until expiry | [Get Access Token — Client credentials](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation) |
| `refresh_token` | See **Ambiguous** below | See **Ambiguous** below | Overview vs API vs renewal |

**Refresh flow** ([Renew Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/renewal)):

```
POST https://api.mercadopago.com/oauth/token
Content-Type: application/json

{
  "client_id": "client_id",
  "client_secret": "client_secret",
  "grant_type": "refresh_token",
  "refresh_token": "TG-XXXXXXXX-241983636"
}
```

Preconditions:

- Application/token `scope` includes `offline_access`.
- Seller previously authorized via Authorization code flow.

Response: a **new** `access_token` and a **new** `refresh_token`. Docs: **every time you refresh `access_token`, `refresh_token` is also refreshed; store it again.**

**Ambiguous — refresh_token reuse vs one-time:**

- [OAuth overview](https://www.mercadopago.com.uy/developers/en/docs/security/oauth): `refresh_token` duration **6 months** and **can be reused**.
- [POST /oauth/token](https://www.mercadopago.com.uy/developers/en/reference/authentication/oauth/_oauth_token/post): `refresh_token` **can only be used once** for the associated `client_id`; after use it becomes invalid.
- [Renew Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/renewal): each refresh returns a **new** `refresh_token` that must be stored.

The API + renewal pages are consistent with rotate-on-use. The overview’s “can be reused” conflicts. **Do not assume the same refresh token can be replayed.**

**Ambiguous — “entire authorization flow must be reconfigured” after 180 days:**

[Renew Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/renewal) says the Access Token received is valid for 180 days, “after which the entire authorization flow must be reconfigured,” **and** that refresh allows continued use without new user interaction. Official text is internally contradictory. Split Payments 1:1 is clearer: credentials are valid **6 months**; if **not renewed before that period they expire and linking must be repeated** ([create configuration](https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/create-configuration)).

### 1.5 Where `client_secret` must be used

Documented uses of `client_secret` (always with `client_id`):

1. **Token exchange** (`grant_type=authorization_code`) — [Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation)
2. **Token refresh** (`grant_type=refresh_token`) — [Renew Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/renewal)
3. **Client credentials** (`grant_type=client_credentials`) for the application’s **own** resources — [Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation)

[Credentials](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/credentials): Client Secret is a private key; keep it on servers; do not allow user/intruder access. [Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation): do not put seller sensitive information in the authentication URL; manage the process **only from your server**.

`client_secret` is **not** documented as an `Authorization` header for preference or payment APIs. Those use `Authorization: Bearer <ACCESS_TOKEN>`.

The `/oauth/token` API example also shows `Authorization: Bearer <ACCESS_TOKEN>` on the token endpoint. The OAuth guides’ curl examples do **not**. **Ambiguous** whether a Bearer token is required on `/oauth/token` in addition to `client_id`/`client_secret` in the body.

### 1.6 Redirect URI matching

Official rules:

- Configure **Redirect URL** in Application details as an **HTTPS** URL ([Application details](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/application-details)).
- `redirect_uri` **must be a static URL** ([Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation), [Application details](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/application-details), [OAuth best practices](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/best-practices)).
- If extra parameters are needed, put them in `state`. If `redirect_uri` does **not exactly match** the application configuration, the call receives an error.
- Token-exchange `invalid_grant` can be caused by `redirect_uri` mismatch ([POST /oauth/token errors](https://www.mercadopago.com.uy/developers/en/reference/authentication/oauth/_oauth_token/post)).

### 1.7 CSRF / `state`

[Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation) and [OAuth best practices](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/best-practices):

- **Recommended:** include `state` in the authorization-code request.
- Unique per attempt; no sensitive information.
- Used so the integrator can confirm the response belongs to a request initiated by the same application.
- Use `state` (not extra `redirect_uri` query params) to carry extra context.

Official docs do **not** use the word “CSRF.” The documented purpose of `state` is request/response correlation and avoiding `redirect_uri` mismatch.

---

## 2. Marketplace + Checkout Pro preference creation

Primary sources:

- [How to integrate checkout in marketplace (UY Checkout Pro)](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/how-tos/integrate-marketplace)
- [Split Payments 1:1 integrate marketplace (UY)](https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace)
- [Create preference API POST /checkout/preferences (UY)](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post)
- [Create and configure a payment preference (UY)](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/create-payment-preference)
- [Configure return URLs (UY)](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/configure-back-urls)

### 2.1 Endpoint

**Required endpoint:** `POST https://api.mercadopago.com/checkout/preferences`  
Header: `Authorization: Bearer <ACCESS_TOKEN>`  
([Create preference](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post))

### 2.2 Which token authorizes preference creation

Marketplace / Split Payments docs are consistent that **each seller’s OAuth `access_token`** must be used for checkout integration:

- [Checkout Pro marketplace](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/how-tos/integrate-marketplace): “necessarily using an access token for each seller, obtained through OAuth” and “use the seller's `public_key` and `access_token` … in the backend or in the header of the request.”
- [Split Payments 1:1](https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace): “insert the seller's `access_token` … in the backend or in the request header.”

**Do not use the marketplace application’s own Access Token** to create a seller preference. Official marketplace docs require the **connected seller** token.

**Ambiguous — which `public_key` on the frontend:**

- Checkout Pro marketplace (UY): seller’s `public_key` **and** `access_token`.
- Split Payments 1:1 (UY): **integrator account** `public_key` on the frontend, **seller** `access_token` on the backend.

Both pages are official Uruguay docs. They disagree.

### 2.3 Required vs optional vs deprecated preference fields

The OpenAPI-style Create Preference schema marks almost every request field **optional**. The Checkout Pro guide’s minimal examples send `items` with `title`, `quantity`, and `unit_price` ([Create payment preference](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/create-payment-preference)). Errors include `invalid_items` / `unit_price invalid`.

Treat as follows **from official text**, not from inferred “must send”:

| Field | Official classification | Notes |
|---|---|---|
| `items` | Schema: optional. Guide examples always include it. | Used to calculate total. `quantity` + `unit_price` determine order cost. |
| `items[].title` | Optional in schema | Displayed at checkout, activities, emails. |
| `items[].quantity` | Optional in schema | Used to calculate total. |
| `items[].unit_price` | Optional in schema | Two decimal places or none. Invalid `unit_price` → error. |
| `items[].currency_id` | Optional | ISO 4217. Uruguay API examples use **`UYU`**. Checkout always processes in **local currency**; if USD is used, amount is converted when the preference is created and is **not** auto-updated if FX changes. |
| `items[].id`, `description`, `picture_url`, `category_id` | Optional | |
| `payer.*` | Optional | Name, surname, email, phone, identification, address, `date_created`. Uruguay example identification type: **`CI`**. |
| `back_urls.success/pending/failure` | Optional | HTTPS **mandatory**. HTTP URLs are discarded and treated as empty; default Mercado Pago pages are used. Do not use localhost / 127.0.0.1. |
| `auto_return` | Optional | `approved` or `all`. Auto-redirect after **approved credit-card** payment. Return-URLs page also says default value is `approved`; redirect takes up to **40 seconds**. |
| `notification_url` | Optional | HTTPS mandatory. Max **248** characters. **Not validated** by Mercado Pago; integrator owns format/availability. Takes **precedence** over Your integrations webhook URL. No localhost. |
| `external_reference` | Optional | Max **64** characters; only numbers, letters, hyphens, underscores. No `[ ] ( ) '' @`. |
| `marketplace` | Optional | Default `NONE`. If the collector has a marketplace, send credentials that identify it. Marketplace is associated with **Application ID**; credentials must match those used to create the preference. Response example: `"marketplace": "MP-MKT-6295877106812064"`. |
| `marketplace_fee` | Optional | See §2.4. **Can only be sent if a valid marketplace is defined**; otherwise the request fails. |
| `metadata` | Optional | Valid JSON saved as additional attributes. |
| `expires`, `expiration_date_from`, `expiration_date_to` | Optional | Date format `yyyy-MM-dd'T'HH:mm:ssz`. |
| `payment_methods.*` | Optional | Exclude methods/types, default method, installments (1–36). `account_money` (and in one request note, wallet) cannot be excluded. |
| `statement_descriptor` | Optional | Up to **13** characters on the payer’s card statement. |
| `additional_info` | Optional | Free string. |
| `binary_mode` | Optional (appears in response; some SDK examples send it) | If true, payments only approved or rejected (no `in_process`). |
| `sandbox_init_point` (response) | **Do not use.** | “For integration testing, use `init_point`.” |
| `sponsor_id` | **Deprecated** on **GET payment** (“no longer used”). Preference errors still mention `invalid_sponsor_id`. | |

Useful **response** fields: `id` (preference id), `init_point` (Checkout URL), `collector_id` (collector / Cust ID), `client_id` (application ID from credentials used to create the preference), `marketplace`, `marketplace_fee`.

### 2.4 `marketplace_fee`

Official statements (must be read together):

1. Preference API: “Marketplace's fee charged by **application owner**. It is a **fixed amount** and its default value is **0 in local currency**. This property can only be sent if a **valid marketplace** has been defined as well, otherwise the request will fail.” ([Create preference](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post))
2. Error `invalid_marketplace_fee`: “marketplace_fee must not be greater than total amount.”
3. Marketplace guides: heading “To determine the marketplace commission **percentage**” but the field is filled with an **amount** per preference (example `10` next to `unit_price` 75.76). ([Checkout Pro marketplace](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/how-tos/integrate-marketplace))
4. Split: “The **Mercado Pago commission is deducted first** and the **Marketplace commission is deducted from the remaining amount**.” Both checkouts “automatically split the amounts between the seller and the marketplace.”

**Type:** **fixed amount**, not a percentage field. The word “percentage” in the guide heading is **not** backed by the API type.

**Currency:** local currency (Uruguay: UYU).

**Rounding:** **not documented.**

**Who receives it:** application owner (marketplace). Seller receives the remainder after Mercado Pago’s fee then marketplace fee.

Checkout API (not Checkout Pro) uses `application_fee` on `POST /v1/payments` instead. Do not confuse the two.

### 2.5 How seller association works (`collector_id`, `marketplace`)

Documented mechanism:

1. Seller authorizes the marketplace app via OAuth.
2. OAuth `user_id` **is** the seller’s Mercado Pago ID / **`collector_id`** ([Split Payments 1:1](https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/create-configuration)).
3. Create the preference with that seller’s **`access_token`**.
4. Preference **response** includes `collector_id` (“Unique ID used to identify the collector. It is the same as the Cust ID.”). `collector_id` is **not** listed as a Create Preference **request** field.
5. GET payment: `collector_id` is “the user who receives the money” (seller/store).

`marketplace` on the preference identifies marketplace origin and must match the Application ID / credentials used to create the preference.

Official docs do **not** document sending a different `collector_id` in the preference body as the way to attach a seller. Association is via **seller OAuth token**.

---

## 3. Payments and notifications / webhooks

Primary sources:

- [Notifications overview (UY)](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications)
- [Webhooks (UY)](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/webhooks)
- [Checkout Pro payment notifications (UY)](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/payment-notifications)
- [IPN (UY)](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/ipn)
- [GET /v1/payments/{id} (UY Checkout Pro)](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-payment/get)
- [Get payment status (Checkout API payments)](https://www.mercadopago.com.uy/developers/en/docs/checkout-api-payments/response-handling/query-results)
- [Create refund (UY)](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-api-payments/create-refund/post)
- [Configure return URLs (UY)](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/configure-back-urls)

### 3.1 Notification topics (Checkout Pro / marketplace relevant)

From [Notifications](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications) and [Webhooks](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/webhooks):

| Topic (Your integrations / docs) | Associated with Checkout Pro? | Meaning |
|---|---|---|
| `payment` | Yes | Creation and update of payments |
| `topic_merchant_order_wh` / `merchant_order` | Yes | Creation, closure, or expiration of commercial orders |
| `topic_chargebacks_wh` / `chargebacks` | Yes | Chargebacks / fund-release related |
| `topic_claims_integration_wh` | Yes | Refunds and claims |
| `mp-connect` | All OAuth products | Linking and unlinking of accounts connected via OAuth |
| `stop_delivery_op_wh` / `delivery_cancellation` | Yes | Fraud alerts |
| `topic_card_id_wh` | Yes | Card updater |

Checkout Pro payment-notifications guide focuses on the **Payments** event: sent when a payment is created or status changes (Pending, Rejected, or Approved).

**Webhooks vs IPN:**

- **Webhooks: recommended.** Instant HTTP POST + secret signature (`x-signature`).
- **IPN: will be discontinued** (no firm date in the pages fetched). IPN does **not** allow validation via `x-Signature` / secret key, even if the header is present. Webhooks now also send `merchant_order` and `chargebacks`.

URLs configured on the **preference/payment** (`notification_url`) **take precedence** over Your integrations URLs.

### 3.2 How to obtain the payment ID

Documented channels:

1. **Webhook body / query:** `data.id` is “ID of the payment, merchant_order, or claim.” Query example: `data.id=123456` and `type=payment`. ([Webhooks](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/webhooks), [Checkout Pro payment notifications](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/payment-notifications))
2. **IPN query:** `topic=payment&id=123456789` ([IPN](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/ipn))
3. **Return URL query params:** `payment_id`, `status`, `external_reference`, `merchant_order_id` (also `collection_id` / `collection_status` appear in the example GET). ([Back URLs](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/configure-back-urls))

The webhook JSON does **not** include full payment status. Example:

```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "date_created": "2015-03-25T10:04:58.396-04:00",
  "user_id": 44444,
  "api_version": "v1",
  "action": "payment.created",
  "data": { "id": "999999999" }
}
```

`user_id` is documented as **seller identifier**.

### 3.3 How to verify a payment

After acknowledging the webhook, **GET** the resource:

`GET https://api.mercadopago.com/v1/payments/{id}`  
`Authorization: Bearer <ACCESS_TOKEN>`

([Webhooks — necessary actions](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/webhooks), [GET payment](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-payment/get))

Merchant orders: `GET https://api.mercadopago.com/merchant_orders/{id}`.  
Chargebacks: `GET https://api.mercadopago.com/v1/chargebacks/{id}`.

Acknowledge with **HTTP 200 or 201** within **22 seconds**. Otherwise Mercado Pago retries (first retries every 15 minutes; Checkout Pro payment-notifications diagram: 0 min, 15 min, 30 min, 6 h, 48 h, then 96 h).

### 3.4 Which token to GET a payment (marketplace)

- GET payment API: “Access Token obtained through the developer panel. Must be sent in all requests.” Error `5`: “Must provide your access_token to proceed.”
- Marketplace/Split Payments: seller OAuth `access_token` is the token for checkout backend calls.
- Webhook `user_id` is the seller.

Official docs **do not explicitly say** “use the seller token vs the marketplace application token to GET `/v1/payments/{id}`.” They also do **not** document that the marketplace application token can read a connected seller’s payments.

**Documented, non-invented position:** use an Access Token in `Authorization: Bearer`; marketplace integration is specified around the **seller OAuth access_token**. Whether the marketplace app token can GET that payment is **not stated**.

### 3.5 Payment statuses

From [GET payment](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-payment/get):

| `status` | Official meaning |
|---|---|
| `pending` | User has not completed the payment process (e.g. offline ticket). |
| `approved` | Successfully approved and credited. |
| `authorized` | Authorized but not yet captured. |
| `in_process` | Currently under review. |
| `in_mediation` | User initiated a dispute. |
| `rejected` | Rejected; user may try again. |
| `cancelled` | Cancelled by a party or expired. |
| `refunded` | Refunded to the user. |
| `charged_back` | Chargeback on the buyer’s credit card. |

`status_detail` is a separate enum (e.g. `accredited`, `partially_refunded`, `expired`, `by_collector`, `by_payer`, many `cc_rejected_*` values). See [Get payment status](https://www.mercadopago.com.uy/developers/en/docs/checkout-api-payments/response-handling/query-results) for the status × status_detail table.

Checkout Pro notifications text highlights Pending / Rejected / Approved as the status-change examples; the payment resource still has the fuller enum above.

### 3.6 Webhook signature / `x-signature`

For **Webhooks configured through Your integrations**, Mercado Pago **always includes** a secret signature in `x-signature`, e.g.:

```
ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
```

Validation ([Webhooks](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/webhooks)):

1. Split `x-signature` on `,` → `ts` and `v1`.
2. Manifest: `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
3. `data.id` from **query params**, lowercased if alphanumeric.
4. If `data.id` or `x-request-id` is missing, **omit that pair** from the manifest before HMAC.
5. HMAC-SHA256 in hex using the application’s webhook **secret** from Your integrations.
6. Compare with `v1`. Optional: check `ts` delay tolerance.
7. Match → HTTP 200; mismatch → examples use HTTP 401.

Secret has **no expiration**; periodic **Reset** is recommended, not mandatory.

**Required vs recommended:** docs present signature validation as the way to confirm authenticity and prevent fraud. They do **not** say Mercado Pago will refuse to send unsigned webhooks, nor that your server must legally reject unsigned ones. They **do** say IPN cannot be validated this way.

QR Code webhooks **cannot** be verified with the secret signature (out of scope for Checkout Pro).

### 3.7 Idempotency

**API (your outbound calls):**

- Refunds: header **`X-Idempotency-Key` is required** (schema: required; error `4292` Header-X-Idempotency-Key-can’t-be-null). Suggested UUID v4. ([Create refund](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-api-payments/create-refund/post))
- [Idempotency news (2023-01-04, Mercado Pago Developers)](https://www.mercadopago.com.br/developers/en/news/2023/01/04/Idempotency-key-usage-will-be-mandatory): `X-Idempotency-Key` made mandatory for Payments and Refunds APIs for **new integrations/implementations starting 09/01/2024 in Sandbox**. Older integrations without new implementations: not mandatory “for now,” but recommended.

**Webhooks (inbound):** official docs specify retries if you do not return 200/201. They do **not** document a dedicated “idempotency key” for webhook handling. Retries imply the same `data.id` / notification may arrive more than once; the docs do not spell an idempotency algorithm.

Create preference examples do **not** show `X-Idempotency-Key`.

### 3.8 Can the webhook payload be trusted without API verification?

Official flow: validate origin (webhooks `x-signature`) → respond 200/201 → **then GET `/v1/payments/{id}`** to obtain **complete** information and update the platform.

The webhook body is a **thin event** (`type`, `action`, `data.id`, `user_id`). It does **not** include `status`, amounts, or `status_detail`.

So:

- Signature validates **that Mercado Pago sent the notification**, not the current payment state.
- Official docs instruct a **GET of the resource** after ack. They do not say the webhook body is a sufficient source of truth for payment status.

---

## 4. Token ownership by operation

| Operation | Credential documented | Notes |
|---|---|---|
| OAuth authorization (browser redirect) | Marketplace **`client_id` (APP_ID)** in the URL. No `client_secret`. | Seller logs in and consents. |
| Token exchange `authorization_code` | Marketplace **`client_id` + `client_secret`** + `code` + `redirect_uri` | Server-side. Optional PKCE `code_verifier`. |
| Token refresh | Marketplace **`client_id` + `client_secret`** + seller **`refresh_token`** | Returns new seller `access_token` and new `refresh_token`. Needs `offline_access`. |
| Client credentials (app’s own resources) | Marketplace **`client_id` + `client_secret`** | Token valid **6 hours**. Does **not** act on behalf of a seller. |
| Preference creation (Checkout Pro marketplace) | **Connected seller `access_token`** (Bearer) | Marketplace/Split Payments docs. |
| Checkout frontend keys | **Ambiguous:** seller `public_key` vs integrator `public_key` | See §2.2. |
| Payment GET | **Access Token** (Bearer). Marketplace context: seller token is the documented checkout credential. | App-token access to seller payments **not specified**. |
| Refunds `POST /v1/payments/{id}/refunds` | **Access Token** (Bearer) + **`X-Idempotency-Key`** | API says “Access Token obtained through the developer panel.” Refund `source[].type` may be `Admin`, `Collector`, `BPP`, **`Marketplace`**. Split Payments 1:1: refunds are **split proportionally** between seller and marketplace; marketplace **cannot** full-refund if the seller lacks funds. **Which token to send for a marketplace refund is not explicitly mapped** beyond “Access Token.” |

Production vs OAuth seller tokens ([Credentials](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/credentials)):

- Application **Public Key / Access Token**: backend payments for **that** application/account.
- **Client ID / Client Secret**: OAuth (and some older plugins).
- Connected-seller **access_token / public_key / refresh_token**: returned by `/oauth/token` after Authorization code.

Send Access Token in the **Authorization header**, not query string ([Credentials — security](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/credentials)).

---

## 5. Uruguay-specific notes

Sources: [Checkout Pro overview (UY)](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview), [Create preference UY examples](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post), [GET payment UY example](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-payment/get), [Payment methods](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-api/payment-methods/get).

| Topic | Official statement |
|---|---|
| Checkout Pro availability | Listed for **UY** (also AR, BR, CL, CO, MX, PE). |
| Currency | Preference and payment examples use **`currency_id`: `UYU`**. Checkout processes **local currency**. |
| Payment methods named on Checkout Pro UY overview | **Credit or debit card, Abitab, Red Pagos, Mercado Pago Account.** |
| `payment_type_id` `ticket` | Includes **Abitab and Red Pagos** (among other countries’ cash methods). |
| Payer identification example (UY) | Type **`CI`**. |
| Address examples | Montevideo / zip `11300`. |
| Live methods for an account | `GET https://api.mercadopago.com/v1/payment_methods` with Access Token. Status: `active` / `deactive` / `temporally_deactive`. |
| Prerequisites | Seller Mercado Pago account; SSL. |
| Split Payments 1:1 | Integrable with Checkout Pro, Checkout API, Checkout Bricks. Create application with **Marketplace** integration model. |

Offline methods (Abitab / Red Pagos): buyer is sent to `back_urls.pending` with payment still pending until paid at a physical point; then status changes via notifications ([Back URLs](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/configure-back-urls)).

---

## 6. Access token expiration if refresh is not implemented

What official docs **do** say:

- Authorization-code **access_token** lasts **180 days / 6 months** (`expires_in` default 15552000).
- Split Payments 1:1: if credentials are **not renewed before 6 months, they expire** and **linking must be repeated** (seller must authorize again).
- Refresh exists specifically so an expired/invalid access token can be replaced **without new user interaction**, provided `offline_access` and a stored `refresh_token`.
- After using refresh, the **new** `refresh_token` must be stored (API: old one becomes invalid).
- `authorization_code` itself is useless after 10 minutes; it cannot replace refresh.

What official docs **do not** enumerate as a runtime error catalog for “forgot to refresh”: no dedicated page listing “preference create returns X if seller token expired.” Closest errors: OAuth `invalid_grant` (expired/revoked refresh or code), preference `invalid_access_token` (“access denied”), payment GET error 5 / 401 invalid token.

**If refresh is not implemented:** after at most ~180 days the seller `access_token` expires; Split Payments 1:1 says the linkage must be done again. Operations that require that seller token (preference creation, and any payment/refund call using that token) will not remain authorized. The marketplace `client_credentials` token (6 hours) is a different credential and is **not** documented as a substitute for the seller token.

---

## 7. Recent / current API changes (as documented)

Reviewed: [News (UY)](https://www.mercadopago.com.uy/developers/en/news), [Changelog (UY)](https://www.mercadopago.com.uy/developers/en/changelog) on 2026-08-17.

**Currently documented (not necessarily dated in changelog):**

| Change | Official wording | Source |
|---|---|---|
| IPN discontinuation | “IPN notifications will be discontinued” / “discontinued soon.” Use Webhooks. IPN cannot be validated with the secret key. Webhooks now send `merchant_order` and `chargebacks`. | [Notifications](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications), [IPN](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/ipn) |
| Webhook `x-signature` | Current Webhooks validation method (HMAC-SHA256). | [Webhooks](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/webhooks) |
| `sandbox_init_point` | “Do not use this parameter. For integration testing, use `init_point`.” | [Create preference](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post) |
| `sponsor_id` | GET payment: “This field is deprecated and no longer used.” | [GET payment](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-payment/get) |
| Checkout API labeled **legacy** in notifications tables | Payment topic still lists Checkout API as legacy; Orders API is the newer Checkout API orders product. | [Notifications](https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications) |
| Idempotency on Payments/Refunds | Mandatory for new integrations from 2024-01-09 in Sandbox (news dated 2023-01-04). Refund API currently requires `X-Idempotency-Key`. | [News](https://www.mercadopago.com.br/developers/en/news/2023/01/04/Idempotency-key-usage-will-be-mandatory), [Create refund](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-api-payments/create-refund/post) |
| PKCE | Optional OAuth hardening; required only if enabled on the application. | [Get Access Token](https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation) |

**Not found** on the Uruguay News/Changelog pages fetched: a 2025–2026 breaking change specifically rewriting Marketplace OAuth query params, `marketplace_fee` type, Checkout Pro preference endpoint, or webhook HMAC format.

July 2026 changelog items (VTEX app, Orders API 429, Claude plugin, CLI) are **not** Marketplace OAuth / Checkout Pro preference / webhook-signature changes.

---

## 8. Explicit ambiguities (do not invent a resolution)

1. Authorization host: `auth.mercadopago.com` vs `auth.mercadopago.com.uy`.
2. Token-exchange encoding: JSON vs `x-www-form-urlencoded`.
3. Whether `state` belongs on `/oauth/token` (Split Payments example) or only on the authorize URL.
4. Whether `/oauth/token` requires `Authorization: Bearer` in addition to body credentials.
5. `refresh_token` reusable for 6 months vs one-time rotate-on-use.
6. Whether after 180 days the seller must re-consent even if refresh was implemented.
7. Frontend `public_key`: seller vs integrator.
8. Whether `marketplace` must be explicitly set to `MP-MKT-{APP_ID}` when using seller OAuth, or is inferred. API: `marketplace_fee` requires a “valid marketplace” to be defined.
9. Rounding rules for `marketplace_fee`.
10. Guide heading “commission **percentage**” vs API **fixed amount**.
11. Which Access Token GET/refund a marketplace payment: seller vs marketplace application. Refund `source.type` includes `Marketplace` but the required Bearer token is not specified per role.
12. OAuth best-practices `grant_type` list omits `refresh_token`.
13. IPN `notification_url` note: “To receive notifications exclusively via Webhooks and not via IPN, add `source_news=ipn`” — official text looks self-contradictory; do not rely on it without testing against current behavior.

---

## 9. Source index

| Topic | URL |
|---|---|
| OAuth overview | https://www.mercadopago.com.uy/developers/en/docs/security/oauth |
| Get Access Token | https://www.mercadopago.com.uy/developers/en/docs/security/oauth/creation |
| Renew Access Token | https://www.mercadopago.com.uy/developers/en/docs/security/oauth/renewal |
| OAuth best practices | https://www.mercadopago.com.uy/developers/en/docs/security/oauth/best-practices |
| POST /oauth/token | https://www.mercadopago.com.uy/developers/en/reference/authentication/oauth/_oauth_token/post |
| Application details / Redirect URL | https://www.mercadopago.com.uy/developers/en/docs/your-integrations/application-details |
| Credentials | https://www.mercadopago.com.uy/developers/en/docs/your-integrations/credentials |
| Split Payments 1:1 create configuration | https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/create-configuration |
| Split Payments 1:1 integrate marketplace | https://www.mercadopago.com.uy/developers/en/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace |
| Checkout Pro marketplace | https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/how-tos/integrate-marketplace |
| Checkout Pro overview (UY methods) | https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview |
| Create payment preference guide | https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/create-payment-preference |
| POST /checkout/preferences | https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post |
| Back URLs | https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/configure-back-urls |
| Notifications overview | https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications |
| Webhooks | https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/webhooks |
| Checkout Pro payment notifications | https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/payment-notifications |
| IPN | https://www.mercadopago.com.uy/developers/en/docs/your-integrations/notifications/ipn |
| GET /v1/payments/{id} | https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-payment/get |
| Payment status × status_detail | https://www.mercadopago.com.uy/developers/en/docs/checkout-api-payments/response-handling/query-results |
| Create refund | https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-api-payments/create-refund/post |
| Payment methods | https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-api/payment-methods/get |
| Idempotency news | https://www.mercadopago.com.br/developers/en/news/2023/01/04/Idempotency-key-usage-will-be-mandatory |
| News (UY) | https://www.mercadopago.com.uy/developers/en/news |
| Changelog (UY) | https://www.mercadopago.com.uy/developers/en/changelog |
