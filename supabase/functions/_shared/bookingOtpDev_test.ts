import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldUseBookingOtpMock } from './bookingOtpDev.ts';

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
