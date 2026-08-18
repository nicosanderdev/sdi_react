import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldUseWhatsappMock } from './whatsapp.ts';

Deno.test('shouldUseWhatsappMock is true when BOOKING_OTP_MOCK=true on hosted URL', () => {
  Deno.env.set('SUPABASE_URL', 'https://xwouzunpavooxspsisam.supabase.co');
  Deno.env.set('BOOKING_OTP_MOCK', 'true');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  assertEquals(shouldUseWhatsappMock(), true);
});

Deno.test('shouldUseWhatsappMock is false on hosted URL without mock flag', () => {
  Deno.env.set('SUPABASE_URL', 'https://xwouzunpavooxspsisam.supabase.co');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  assertEquals(shouldUseWhatsappMock(), false);
});

Deno.test('shouldUseWhatsappMock is true on local URL by default', () => {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  assertEquals(shouldUseWhatsappMock(), true);
});

Deno.test('shouldUseWhatsappMock is false on local when BOOKING_OTP_LIVE_ENABLED=true', () => {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.set('BOOKING_OTP_LIVE_ENABLED', 'true');
  assertEquals(shouldUseWhatsappMock(), false);
});
