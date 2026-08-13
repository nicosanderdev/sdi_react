# mercado-pago-connect

Public OAuth start + Mercado Pago callback for seller account linking.

## Endpoints

- `POST /functions/v1/mercado-pago-connect` body `{ "token": "<opaque 10-minute site token>" }` → `{ authorizationUrl }`
- `GET /functions/v1/mercado-pago-connect/callback?code=&state=` → redirects to `/conectar-con-mercado-pago/resultado`

Register `MERCADO_PAGO_REDIRECT_URI` exactly as the callback URL in the Mercado Pago application settings.
