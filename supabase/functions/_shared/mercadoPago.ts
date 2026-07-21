/**
 * Mercado Pago marketplace helpers: AES-GCM token encryption, PKCE/state,
 * OAuth exchange/refresh, webhook HMAC verification, and redaction.
 */

const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const MP_API_BASE = 'https://api.mercadopago.com';

export interface EncryptedBlob {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface MpOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number | string;
  refresh_token?: string;
  public_key?: string;
  live_mode?: boolean;
}

export interface MpSellerTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  userId: string;
  publicKey?: string;
  liveMode?: boolean;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(48);
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return { verifier, challenge: toBase64Url(new Uint8Array(digest)) };
}

async function getAesKey(): Promise<CryptoKey> {
  const secret = requireEnv('MERCADO_PAGO_TOKEN_ENCRYPTION_KEY');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const bytes = new Uint8Array(encrypted);
  const tagLength = 16;
  const ciphertext = bytes.slice(0, bytes.length - tagLength);
  const tag = bytes.slice(bytes.length - tagLength);
  const blob: EncryptedBlob = {
    ciphertext: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
    tag: toBase64Url(tag),
  };
  return JSON.stringify(blob);
}

export async function decryptSecret(payload: string): Promise<string> {
  const key = await getAesKey();
  const blob = JSON.parse(payload) as EncryptedBlob & { mock?: boolean };
  if (blob.mock === true || String(blob.ciphertext ?? '').startsWith('MOCK_')) {
    throw new Error(
      'Seller Mercado Pago credentials are mock placeholders. Reconnect the seller via OAuth (admin invite link).',
    );
  }
  const ciphertext = fromBase64Url(blob.ciphertext);
  const iv = fromBase64Url(blob.iv);
  const tag = fromBase64Url(blob.tag);
  if (iv.length !== 12 && iv.length !== 16) {
    throw new Error(
      `Invalid encrypted token IV length (${iv.length}); expected 12 or 16. Reconnect the seller via OAuth.`,
    );
  }
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    combined,
  );
  return new TextDecoder().decode(decrypted);
}

export function buildAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
  redirectUri?: string;
}): string {
  const clientId = requireEnv('MERCADO_PAGO_CLIENT_ID');
  const redirectUri = params.redirectUri ?? requireEnv('MERCADO_PAGO_REDIRECT_URI');
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state: params.state,
    redirect_uri: redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${MP_AUTH_URL}?${query.toString()}`;
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
  testToken?: boolean;
}): Promise<MpSellerTokens> {
  const body: Record<string, string> = {
    client_id: requireEnv('MERCADO_PAGO_CLIENT_ID'),
    client_secret: requireEnv('MERCADO_PAGO_CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri ?? requireEnv('MERCADO_PAGO_REDIRECT_URI'),
    code_verifier: params.codeVerifier,
  };
  if (params.testToken) {
    body.test_token = 'true';
  }

  const response = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as MpOAuthTokenResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.message || payload.error || `OAuth token exchange failed (${response.status})`);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (payload.expires_in || 15552000) * 1000,
    scope: payload.scope,
    userId: String(payload.user_id),
    publicKey: payload.public_key,
    liveMode: payload.live_mode,
  };
}

export async function refreshSellerAccessToken(refreshToken: string): Promise<MpSellerTokens> {
  const response = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: requireEnv('MERCADO_PAGO_CLIENT_ID'),
      client_secret: requireEnv('MERCADO_PAGO_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as MpOAuthTokenResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.message || payload.error || `OAuth refresh failed (${response.status})`);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (payload.expires_in || 15552000) * 1000,
    scope: payload.scope,
    userId: String(payload.user_id ?? ''),
    publicKey: payload.public_key,
    liveMode: payload.live_mode,
  };
}

export async function mpApiRequest<T>(
  path: string,
  options: {
    accessToken: string;
    method?: string;
    body?: unknown;
    idempotencyKey?: string;
  },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${MP_API_BASE}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { message?: string }).message ||
      (payload as { error?: string }).error ||
      `Mercado Pago API error (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

/**
 * Official webhook signature verification.
 * Manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
 */
export async function verifyWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret?: string;
}): Promise<boolean> {
  const secret = params.secret ?? Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
  if (!secret || !params.xSignature) return false;

  const parts = Object.fromEntries(
    params.xSignature.split(',').map((part) => {
      const [k, v] = part.split('=');
      return [k?.trim(), v?.trim()];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let manifest = '';
  if (params.dataId) {
    const normalizedId = /^[a-zA-Z0-9]+$/.test(params.dataId)
      ? params.dataId.toLowerCase()
      : params.dataId;
    manifest += `id:${normalizedId};`;
  }
  if (params.xRequestId) {
    manifest += `request-id:${params.xRequestId};`;
  }
  manifest += `ts:${ts};`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const expected = toHex(new Uint8Array(signature));

  if (expected.length !== v1.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return mismatch === 0;
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (
        key.includes('token') ||
        key.includes('secret') ||
        key.includes('authorization') ||
        key.includes('password') ||
        key.includes('verifier')
      ) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitive(v);
      }
    }
    return out;
  }
  return value;
}

export function normalizeMemberPhone(phone: string | null | undefined, prefix: string | null | undefined): string | null {
  const rawPhone = (phone ?? '').trim();
  if (!rawPhone) return null;
  if (rawPhone.startsWith('+')) {
    return /^\+[1-9]\d{6,14}$/.test(rawPhone) ? rawPhone : null;
  }
  const digits = rawPhone.replace(/\D/g, '');
  const prefixDigits = (prefix ?? '').replace(/\D/g, '');
  const combined = prefixDigits ? `+${prefixDigits}${digits.replace(/^0+/, '')}` : `+${digits}`;
  return /^\+[1-9]\d{6,14}$/.test(combined) ? combined : null;
}

export function getPublicAppBaseUrl(): string {
  return (
    Deno.env.get('MERCADO_PAGO_PUBLIC_APP_URL') ||
    Deno.env.get('PUBLIC_APP_URL') ||
    'https://encartelera.uy'
  ).replace(/\/+$/, '');
}

export function buildConnectLink(rawToken: string): string {
  return `${getPublicAppBaseUrl()}/conectar-con-mercado-pago?token=${encodeURIComponent(rawToken)}`;
}

export function buildConnectResultUrl(status: string, reason?: string): string {
  const url = new URL(`${getPublicAppBaseUrl()}/conectar-con-mercado-pago/resultado`);
  url.searchParams.set('status', status);
  if (reason) url.searchParams.set('reason', reason);
  return url.toString();
}

export function currencyCodeFromInt(currency: number | null | undefined): string {
  switch (currency ?? 0) {
    case 1:
      return 'UYU';
    case 2:
      return 'BRL';
    case 3:
      return 'EUR';
    case 4:
      return 'GBP';
    default:
      return 'USD';
  }
}
