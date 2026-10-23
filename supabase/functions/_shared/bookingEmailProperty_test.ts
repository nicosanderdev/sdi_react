import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  bookingLookupFailure,
  propertyTitleFromAddress,
  resolveGuestPropertyTitle,
} from './bookingEmailProperty.ts';

const address = {
  StreetName: 'Rambla',
  HouseNumber: '12',
  Neighborhood: 'Pocitos',
  City: 'Montevideo',
  State: 'Montevideo',
};

Deno.test('listing title wins over the address', () => {
  assertEquals(resolveGuestPropertyTitle('Casa Sol', address), 'Casa Sol');
});

Deno.test('blank listing title falls back to the address', () => {
  assertEquals(
    resolveGuestPropertyTitle('  ', address),
    '12, Rambla, Pocitos, Montevideo, Montevideo',
  );
  assertEquals(propertyTitleFromAddress(address), '12, Rambla, Pocitos, Montevideo, Montevideo');
});

Deno.test('missing listing and address become Property', () => {
  assertEquals(resolveGuestPropertyTitle(null, null), 'Property');
  assertEquals(
    resolveGuestPropertyTitle(null, {
      StreetName: '  ',
      HouseNumber: null,
      Neighborhood: null,
      City: null,
      State: null,
    }),
    'Property',
  );
});

Deno.test('only a zero-row lookup is Booking not found', () => {
  assertEquals(bookingLookupFailure(null), { status: 404, error: 'Booking not found' });
  assertEquals(bookingLookupFailure({ code: 'PGRST116', message: 'JSON object requested' }), {
    status: 404,
    error: 'Booking not found',
  });
  assertEquals(
    bookingLookupFailure({ code: '42703', message: 'column EstateProperties.Title does not exist' }),
    { status: 500, error: 'column EstateProperties.Title does not exist' },
  );
});
