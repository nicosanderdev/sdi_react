import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildManageLinkEmail, manageLinkClientResult } from './manageLinkRequest.ts';

const TOKEN_URL = 'https://staging-casas.encartelera.uy/reservation-lookup?token=abc123';

Deno.test('manage link email shows the code and a token button', () => {
  const email = buildManageLinkEmail({
    reservationCode: 'RSV-AB12CD',
    manageUrl: TOKEN_URL,
    propertyTitle: 'Casa Sol',
  });
  assertEquals(email.subject, 'Manage your booking RSV-AB12CD');
  assertStringIncludes(email.html, 'RSV-AB12CD');
  assertStringIncludes(email.html, `href="${TOKEN_URL}"`);
  assertEquals(email.html.includes('code='), false);
});

Deno.test('public manage-link responses hide match and token', () => {
  assertEquals(manageLinkClientResult({ rateLimited: false, failed: false }), {
    status: 200,
    body: { success: true },
  });
  assertEquals(manageLinkClientResult({ rateLimited: true, failed: false }), {
    status: 429,
    body: { success: false, error: 'Too many requests' },
  });
  assertEquals(manageLinkClientResult({ rateLimited: true, failed: true }), {
    status: 500,
    body: { success: false, error: 'Internal server error' },
  });
});
