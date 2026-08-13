/**
 * Run: deno test --allow-env supabase/functions/_shared/mercadoPago_test.ts
 */
import {
  assert,
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildAuthorizationUrl,
  createPkcePair,
  currencyCodeFromInt,
  decryptSecret,
  encryptSecret,
  normalizeMemberPhone,
  randomToken,
  redactSensitive,
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

Deno.test('buildAuthorizationUrl includes required OAuth params', () => {
  Deno.env.set('MERCADO_PAGO_CLIENT_ID', 'app-123');
  Deno.env.set('MERCADO_PAGO_REDIRECT_URI', 'https://example.com/callback');
  const url = new URL(
    buildAuthorizationUrl({ state: 'state-1', codeChallenge: 'challenge-1' }),
  );
  assertEquals(url.origin + url.pathname, 'https://auth.mercadopago.com/authorization');
  assertEquals(url.searchParams.get('client_id'), 'app-123');
  assertEquals(url.searchParams.get('response_type'), 'code');
  assertEquals(url.searchParams.get('platform_id'), 'mp');
  assertEquals(url.searchParams.get('state'), 'state-1');
  assertEquals(url.searchParams.get('code_challenge'), 'challenge-1');
  assertEquals(url.searchParams.get('code_challenge_method'), 'S256');
  assertEquals(url.searchParams.get('redirect_uri'), 'https://example.com/callback');
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
