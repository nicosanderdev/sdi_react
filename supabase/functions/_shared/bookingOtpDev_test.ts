import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldLogBookingManageToken, shouldUseBookingOtpMock } from './bookingOtpDev.ts';

Deno.test('shouldUseBookingOtpMock is true when BOOKING_OTP_MOCK=true on hosted URL', () => {
  Deno.env.set('SUPABASE_URL', 'https://xwouzunpavooxspsisam.supabase.co');
  Deno.env.set('BOOKING_OTP_MOCK', 'true');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  assertEquals(shouldUseBookingOtpMock(), true);
});

Deno.test('shouldUseBookingOtpMock is false on hosted URL without mock flag', () => {
  Deno.env.set('SUPABASE_URL', 'https://xwouzunpavooxspsisam.supabase.co');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  assertEquals(shouldUseBookingOtpMock(), false);
});

Deno.test('shouldUseBookingOtpMock is true on local URL by default', () => {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  assertEquals(shouldUseBookingOtpMock(), true);
});

Deno.test('shouldUseBookingOtpMock is false on local when BOOKING_OTP_LIVE_ENABLED=true', () => {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.set('BOOKING_OTP_LIVE_ENABLED', 'true');
  assertEquals(shouldUseBookingOtpMock(), false);
});

Deno.test('shouldLogBookingManageToken is true on local even when OTP live is enabled', () => {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.set('BOOKING_OTP_LIVE_ENABLED', 'true');
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL_MAIN');
  assertEquals(shouldLogBookingManageToken(), true);
});

Deno.test('shouldLogBookingManageToken is true on hosted when manage URL is staging', () => {
  Deno.env.set('SUPABASE_URL', 'https://xwouzunpavooxspsisam.supabase.co');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.set(
    'GUEST_BOOKING_MANAGE_BASE_URL_MAIN',
    'https://staging-casas.encartelera.uy/reservation-lookup',
  );
  assertEquals(shouldLogBookingManageToken(), true);
});

Deno.test('shouldLogBookingManageToken is false on hosted production manage URLs', () => {
  Deno.env.set('SUPABASE_URL', 'https://xwouzunpavooxspsisam.supabase.co');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.set(
    'GUEST_BOOKING_MANAGE_BASE_URL_MAIN',
    'https://casas.encartelera.uy/reservation-lookup',
  );
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL_ALT');
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL');
  assertEquals(shouldLogBookingManageToken(), false);
});
