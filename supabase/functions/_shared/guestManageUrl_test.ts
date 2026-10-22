import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildGuestManageTokenUrl,
  buildGuestManageUrl,
  hasGuestManageBase,
} from './guestManageUrl.ts';

const MAIN = 'https://staging-casas.encartelera.uy/reservation-lookup';
const ALT = 'https://staging-espacios.encartelera.uy/reservation-lookup?code=leftover';

function setBases(): void {
  Deno.env.set('GUEST_BOOKING_MANAGE_BASE_URL_MAIN', MAIN);
  Deno.env.set('GUEST_BOOKING_MANAGE_BASE_URL_ALT', ALT);
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL');
}

Deno.test('token manage URL carries the token and drops code params', () => {
  setBases();
  const url = new URL(buildGuestManageTokenUrl('abc123', 'EventVenue') ?? '');
  assertEquals(url.origin + url.pathname, 'https://staging-espacios.encartelera.uy/reservation-lookup');
  assertEquals(url.searchParams.get('token'), 'abc123');
  assertEquals(url.searchParams.get('code'), null);
  assertEquals(url.searchParams.get('listingType'), null);
});

Deno.test('code manage URL stays a view link', () => {
  setBases();
  const url = new URL(buildGuestManageUrl('RSV-AB12CD', 'SummerRent') ?? '');
  assertEquals(url.searchParams.get('code'), 'RSV-AB12CD');
  assertEquals(url.searchParams.get('listingType'), 'SummerRent');
  assertEquals(url.searchParams.get('token'), null);
});

Deno.test('RealEstate has no guest manage base', () => {
  setBases();
  assertEquals(hasGuestManageBase('RealEstate'), false);
  assertEquals(buildGuestManageTokenUrl('abc123', 'RealEstate'), null);
});
