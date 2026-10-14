import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sendWhatsappTemplateViaMeta, shouldUseWhatsappMock } from './whatsapp.ts';

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

Deno.test('WhatsApp template recipient is digits only, without a leading plus', async () => {
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  Deno.env.set('META_WHATSAPP_TOKEN', 'test-token');
  Deno.env.set('META_WHATSAPP_PHONE_NUMBER_ID', '123456');

  const originalFetch = globalThis.fetch;
  let sentTo = '';
  globalThis.fetch = async (_input, init) => {
    sentTo = String(JSON.parse(String(init?.body)).to);
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await sendWhatsappTemplateViaMeta('+59899826714', {
      name: 'informacion_reserva_1',
      languageCode: 'es',
      bodyParameters: ['123456'],
    });
    assertEquals(result.ok, true);
    assertEquals(sentTo, '59899826714');
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('META_WHATSAPP_TOKEN');
    Deno.env.delete('META_WHATSAPP_PHONE_NUMBER_ID');
  }
});

Deno.test('WhatsApp template failure includes Meta message and details', async () => {
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
  Deno.env.delete('BOOKING_OTP_MOCK');
  Deno.env.delete('BOOKING_OTP_LIVE_ENABLED');
  Deno.env.set('META_WHATSAPP_TOKEN', 'test-token');
  Deno.env.set('META_WHATSAPP_PHONE_NUMBER_ID', '123456');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      message: '(#132000) Number of parameters does not match',
      error_data: { details: 'body: number of localizable_params (1) does not match the expected number of params (3)' },
    },
  }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  try {
    const result = await sendWhatsappTemplateViaMeta('+59899826714', {
      name: 'informacion_reserva_1',
      languageCode: 'es',
      bodyParameters: ['123456'],
    });
    assertEquals(result.ok, false);
    assertEquals(
      result.error,
      '(#132000) Number of parameters does not match (body: number of localizable_params (1) does not match the expected number of params (3))',
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete('META_WHATSAPP_TOKEN');
    Deno.env.delete('META_WHATSAPP_PHONE_NUMBER_ID');
  }
});
