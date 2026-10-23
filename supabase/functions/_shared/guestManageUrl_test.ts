import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildGuestManageTokenUrl,
  buildGuestManageUrl,
  buildGuestPaymentReturnUrl,
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

const PROPERTY_ID = '4cc9ae98-ae40-4aa3-ac5f-df4890be59cc';
const BOOKING_ID = '7d30f591-2b42-449d-89bf-777fb1f5809b';

Deno.test('payment return URL for SummerRent is the casas property page', () => {
  setBases();
  const url = new URL(buildGuestPaymentReturnUrl('SummerRent', PROPERTY_ID, BOOKING_ID) ?? '');
  assertEquals(url.origin + url.pathname, `https://staging-casas.encartelera.uy/property/${PROPERTY_ID}`);
  assertEquals(url.searchParams.get('mpReturn'), '1');
  assertEquals(url.searchParams.get('bookingId'), BOOKING_ID);
  assertEquals(url.searchParams.get('status'), null);
});

Deno.test('payment return URL for EventVenue is the espacios venue page', () => {
  setBases();
  const url = new URL(buildGuestPaymentReturnUrl('EventVenue', PROPERTY_ID, BOOKING_ID) ?? '');
  assertEquals(url.origin + url.pathname, `https://staging-espacios.encartelera.uy/venue/${PROPERTY_ID}`);
  assertEquals(url.searchParams.get('mpReturn'), '1');
  assertEquals(url.searchParams.get('bookingId'), BOOKING_ID);
});

Deno.test('payment return URL is null without a guest site', () => {
  setBases();
  assertEquals(buildGuestPaymentReturnUrl('RealEstate', PROPERTY_ID, BOOKING_ID), null);
  assertEquals(buildGuestPaymentReturnUrl('SummerRent', '  ', BOOKING_ID), null);
  assertEquals(buildGuestPaymentReturnUrl('SummerRent', PROPERTY_ID, null), null);

  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL_MAIN');
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL_ALT');
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL');
  assertEquals(buildGuestPaymentReturnUrl('SummerRent', PROPERTY_ID, BOOKING_ID), null);
  assertEquals(buildGuestPaymentReturnUrl('EventVenue', PROPERTY_ID, BOOKING_ID), null);
});

Deno.test('payment return URL rejects a non-HTTPS origin', () => {
  Deno.env.set('GUEST_BOOKING_MANAGE_BASE_URL_MAIN', 'http://casas.encartelera.uy/reservation-lookup');
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL_ALT');
  Deno.env.delete('GUEST_BOOKING_MANAGE_BASE_URL');
  assertEquals(buildGuestPaymentReturnUrl('SummerRent', PROPERTY_ID, BOOKING_ID), null);
});
