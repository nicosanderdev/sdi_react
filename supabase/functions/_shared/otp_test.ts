/**
 * Run: deno test --allow-env supabase/functions/_shared/otp_test.ts
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  generateOtpCode,
  getVerificationFromEmail,
  isAllowedMemberPhonePrefix,
  makeOtpHash,
  sha256Hex,
} from './otp.ts';
import { normalizeMemberPhone } from './mercadoPago.ts';

Deno.test('generateOtpCode is a 6-digit string', () => {
  const code = generateOtpCode();
  assertEquals(code.length, 6);
  assert(/^\d{6}$/.test(code));
});

Deno.test('makeOtpHash uses salt$hash and matches sha256(salt:code)', async () => {
  const hash = await makeOtpHash('123456');
  const [salt, digest] = hash.split('$');
  assert(salt.length > 0);
  assertEquals(digest, await sha256Hex(`${salt}:123456`));
});

Deno.test('isAllowedMemberPhonePrefix allows UY BR AR only', () => {
  assertEquals(isAllowedMemberPhonePrefix('+598'), true);
  assertEquals(isAllowedMemberPhonePrefix('+55'), true);
  assertEquals(isAllowedMemberPhonePrefix('+54'), true);
  assertEquals(isAllowedMemberPhonePrefix('+34'), false);
  assertEquals(isAllowedMemberPhonePrefix('598'), false);
});

Deno.test('normalizeMemberPhone builds E.164 from allowed prefixes', () => {
  assertEquals(normalizeMemberPhone('099123456', '+598'), '+59899123456');
  assertEquals(normalizeMemberPhone('11987654321', '+55'), '+5511987654321');
  assertEquals(normalizeMemberPhone('91123456789', '+54'), '+5491123456789');
});

Deno.test('getVerificationFromEmail uses VERIFICATION_FROM_EMAIL then booking default', () => {
  Deno.env.delete('VERIFICATION_FROM_EMAIL');
  assertEquals(getVerificationFromEmail(), 'Holiday Trips <bookings@holidaytrips.com>');
  Deno.env.set('VERIFICATION_FROM_EMAIL', 'Verify <verify@example.com>');
  assertEquals(getVerificationFromEmail(), 'Verify <verify@example.com>');
});
