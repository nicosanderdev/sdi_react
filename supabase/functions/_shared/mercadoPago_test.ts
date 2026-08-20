/**
 * Run: deno test --allow-env supabase/functions/_shared/mercadoPago_test.ts
 */
import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  allowUnsignedMercadoPagoWebhooks,
  assertOAuthRedirectUri,
  buildAuthorizationUrl,
  createPkcePair,
  currencyCodeFromInt,
  decryptSecret,
  encodeMpExternalReference,
  encryptSecret,
  getMercadoPagoAuthUrl,
  getOAuthStartDiagnostics,
  isWebhookTimestampFresh,
  logAndPublicError,
  normalizeMemberPhone,
  parseMpExternalReference,
  randomToken,
  redactSensitive,
  resolveWebhookDataId,
  sha256Hex,
  verifyWebhookSignature,
} from './mercadoPago.ts';

Deno.test('randomToken and sha256Hex are stable and unique', async () => {
  const a = randomToken(16);
  const b = randomToken(16);
  assert(a !== b);
  const hash = await sha256Hex('hello');
  assertEquals(hash.length, 64);
  assertEquals(await sha256Hex('hello'), hash);
});

Deno.test('PKCE verifier/challenge pair uses S256 length constraints', async () => {
  const pair = await createPkcePair();
  assert(pair.verifier.length >= 43);
  assert(pair.challenge.length > 20);
  assert(pair.verifier !== pair.challenge);
});

Deno.test('AES-GCM encrypt/decrypt round trip', async () => {
  Deno.env.set('MERCADO_PAGO_TOKEN_ENCRYPTION_KEY', 'unit-test-encryption-key');
  const secret = 'seller-access-token-xyz';
  const encrypted = await encryptSecret(secret);
  assert(encrypted.includes('ciphertext'));
  assertEquals(await decryptSecret(encrypted), secret);
});

Deno.test('decryptSecret rejects mock placeholder blobs', async () => {
  Deno.env.set('MERCADO_PAGO_TOKEN_ENCRYPTION_KEY', 'unit-test-encryption-key');
  await assertRejects(
    () =>
      decryptSecret(
        JSON.stringify({
          ciphertext: 'MOCK_PLACEHOLDER_ACCESS_TOKEN',
          iv: 'AAAAAAAAAAAA',
          tag: 'AAAAAAAAAAAAAAAAAAAAAA',
          mock: true,
        }),
      ),
    Error,
    'mock placeholders',
  );
});

Deno.test('buildAuthorizationUrl uses Uruguay host, PKCE, and no secrets', () => {
  Deno.env.delete('MERCADO_PAGO_AUTH_URL');
  Deno.env.set('MERCADO_PAGO_CLIENT_ID', 'app-123');
  Deno.env.set('MERCADO_PAGO_REDIRECT_URI', 'https://example.com/callback');
  Deno.env.set('MERCADO_PAGO_CLIENT_SECRET', 'must-not-appear');
  const url = new URL(
    buildAuthorizationUrl({ state: 'state-1', codeChallenge: 'challenge-1' }),
  );
  assertEquals(url.origin + url.pathname, 'https://auth.mercadopago.com.uy/authorization');
  assertEquals(url.searchParams.get('client_id'), 'app-123');
  assertEquals(url.searchParams.get('response_type'), 'code');
  assertEquals(url.searchParams.get('platform_id'), 'mp');
  assertEquals(url.searchParams.get('state'), 'state-1');
  assertEquals(url.searchParams.get('code_challenge'), 'challenge-1');
  assertEquals(url.searchParams.get('code_challenge_method'), 'S256');
  assertEquals(url.searchParams.get('redirect_uri'), 'https://example.com/callback');
  assertEquals(url.searchParams.get('client_secret'), null);
  assertEquals(url.searchParams.get('access_token'), null);
  assertEquals(url.searchParams.get('refresh_token'), null);
  assertEquals(url.href.includes('must-not-appear'), false);
});

Deno.test('MERCADO_PAGO_AUTH_URL overrides the default authorize host', () => {
  Deno.env.set('MERCADO_PAGO_AUTH_URL', 'https://auth.mercadopago.com/authorization');
  Deno.env.set('MERCADO_PAGO_CLIENT_ID', 'app-123');
  Deno.env.set('MERCADO_PAGO_REDIRECT_URI', 'https://example.com/callback');
  try {
    assertEquals(getMercadoPagoAuthUrl(), 'https://auth.mercadopago.com/authorization');
    const url = new URL(
      buildAuthorizationUrl({ state: 'state-1', codeChallenge: 'challenge-1' }),
    );
    assertEquals(url.origin + url.pathname, 'https://auth.mercadopago.com/authorization');
    assertEquals(url.searchParams.get('code_challenge_method'), 'S256');
  } finally {
    Deno.env.delete('MERCADO_PAGO_AUTH_URL');
  }
});

Deno.test('assertOAuthRedirectUri rejects HTTP, localhost, and query params', () => {
  assertThrows(() => assertOAuthRedirectUri('http://example.com/callback'), Error, 'HTTPS');
  assertThrows(() => assertOAuthRedirectUri('https://localhost/callback'), Error, 'localhost');
  assertThrows(() => assertOAuthRedirectUri('https://127.0.0.1/callback'), Error, 'localhost');
  assertThrows(
    () => assertOAuthRedirectUri('https://example.com/callback?foo=1'),
    Error,
    'static URL',
  );
  assertOAuthRedirectUri('https://example.supabase.co/functions/v1/mercado-pago-connect/callback');
});

Deno.test('getOAuthStartDiagnostics returns only safe fields', () => {
  Deno.env.delete('MERCADO_PAGO_AUTH_URL');
  Deno.env.set('MERCADO_PAGO_CLIENT_ID', 'app-123');
  Deno.env.set('MERCADO_PAGO_REDIRECT_URI', 'https://example.com/callback');
  Deno.env.set('MERCADO_PAGO_CLIENT_SECRET', 'must-not-appear');
  const diagnostics = getOAuthStartDiagnostics();
  assertEquals(diagnostics, {
    client_id: 'app-123',
    auth_host: 'https://auth.mercadopago.com.uy/authorization',
    redirect_uri: 'https://example.com/callback',
  });
  assertEquals('client_secret' in diagnostics, false);
});

Deno.test('verifyWebhookSignature accepts valid HMAC manifest', async () => {
  const secret = 'whsec-test';
  Deno.env.set('MERCADO_PAGO_WEBHOOK_SECRET', secret);
  const dataId = '123456';
  const requestId = 'req-1';
  const ts = '1700000000';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const v1 = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const ok = await verifyWebhookSignature({
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId: requestId,
    dataId,
  });
  assertEquals(ok, true);

  const bad = await verifyWebhookSignature({
    xSignature: `ts=${ts},v1=${'0'.repeat(v1.length)}`,
    xRequestId: requestId,
    dataId,
  });
  assertEquals(bad, false);
});

Deno.test('normalizeMemberPhone builds E.164 from prefix + local', () => {
  assertEquals(normalizeMemberPhone('+59899123456', null), '+59899123456');
  assertEquals(normalizeMemberPhone('099123456', '+598'), '+59899123456');
  assertEquals(normalizeMemberPhone('bad', '+598'), null);
});

Deno.test('currencyCodeFromInt maps known enums', () => {
  assertEquals(currencyCodeFromInt(0), 'USD');
  assertEquals(currencyCodeFromInt(1), 'UYU');
  assertEquals(currencyCodeFromInt(2), 'BRL');
});

Deno.test('redactSensitive hides token-like keys', () => {
  const redacted = redactSensitive({
    access_token: 'secret',
    nested: { refresh_token: 'also-secret', ok: 1 },
  }) as Record<string, unknown>;
  assertEquals(redacted.access_token, '[REDACTED]');
  assertEquals((redacted.nested as Record<string, unknown>).refresh_token, '[REDACTED]');
  assertEquals((redacted.nested as Record<string, unknown>).ok, 1);
});

Deno.test('encryptSecret requires encryption key', async () => {
  Deno.env.delete('MERCADO_PAGO_TOKEN_ENCRYPTION_KEY');
  await assertRejects(() => encryptSecret('x'), Error, 'Missing required env');
});

const ATTEMPT_ID = '6f1c3b2a-8e4d-4a91-9c07-1b2e3f4a5b6c';
const BOOKING_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

Deno.test('encodeMpExternalReference is 32 hex chars from attempt UUID', () => {
  const ref = encodeMpExternalReference(ATTEMPT_ID);
  assertEquals(ref.length, 32);
  assertEquals(ref, '6f1c3b2a8e4d4a919c071b2e3f4a5b6c');
  assertEquals(parseMpExternalReference(ref), {
    bookingId: null,
    attemptId: ATTEMPT_ID,
  });
});

Deno.test('parseMpExternalReference accepts legacy booking:uuid:attempt:uuid', () => {
  const legacy = `booking:${BOOKING_ID}:attempt:${ATTEMPT_ID}`;
  assertEquals(parseMpExternalReference(legacy), {
    bookingId: BOOKING_ID,
    attemptId: ATTEMPT_ID,
  });
});

Deno.test('parseMpExternalReference rejects empty and invalid refs', () => {
  assertEquals(parseMpExternalReference(null), { bookingId: null, attemptId: null });
  assertEquals(parseMpExternalReference('not-a-ref'), { bookingId: null, attemptId: null });
});

Deno.test('resolveWebhookDataId prefers query data.id over JSON body', () => {
  const url = new URL('https://example.com/webhook?data.id=query-id');
  const fromQuery = resolveWebhookDataId(url, { data: { id: 'body-id' } });
  assertEquals(fromQuery, 'query-id');
  const fromBody = resolveWebhookDataId(
    new URL('https://example.com/webhook'),
    { data: { id: 'body-id' } },
  );
  assertEquals(fromBody, 'body-id');
});

Deno.test('allowUnsignedMercadoPagoWebhooks is local-only', () => {
  Deno.env.set('MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS', 'true');
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  assertEquals(allowUnsignedMercadoPagoWebhooks(), true);

  Deno.env.set('SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co');
  assertEquals(allowUnsignedMercadoPagoWebhooks(), false);

  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.set('MERCADO_PAGO_ALLOW_UNSIGNED_WEBHOOKS', 'false');
  assertEquals(allowUnsignedMercadoPagoWebhooks(), false);
});

Deno.test('isWebhookTimestampFresh accepts unix seconds within 10 minutes', () => {
  const now = 1_700_000_000_000;
  assertEquals(isWebhookTimestampFresh('1700000000', now), true);
  assertEquals(isWebhookTimestampFresh('1699990000', now), false);
});

Deno.test('verifyWebhookSignature rejects stale ts when maxAgeMs is set', async () => {
  const secret = 'whsec-test';
  const dataId = '123456';
  const requestId = 'req-1';
  const ts = '1700000000';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const v1 = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const stale = await verifyWebhookSignature({
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId: requestId,
    dataId,
    secret,
    nowMs: 1_800_000_000_000,
    maxAgeMs: 10 * 60 * 1000,
  });
  assertEquals(stale, false);
});

Deno.test('logAndPublicError never returns the underlying message', () => {
  const payload = logAndPublicError(new Error('Missing required env: MERCADO_PAGO_CLIENT_SECRET'));
  assertEquals(payload.success, false);
  assertEquals(payload.error, 'Internal server error');
});
