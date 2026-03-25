import path from 'path';

/** Small PNG for `setInputFiles` (1×1), relative to repo root. */
export const PROPERTY_IMAGE_FIXTURE = path.join(process.cwd(), 'e2e', 'fixtures', 'images', 'test-property.png');

export interface AddressFixture {
  streetName: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export function defaultAddress(): AddressFixture {
  return {
    streetName: 'Avenida 18 de Julio',
    houseNumber: '1234',
    neighborhood: 'Centro',
    city: 'Montevideo',
    state: 'Montevideo',
    zipCode: '11000',
    country: 'Uruguay',
  };
}

export function uniquePropertyTitle(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type AdminPropertyListingType = 'SummerRent' | 'EventVenue';

export interface AdminPropertyTypeCase {
  /** Visible label in admin tipo dropdown (getPropertyTypeLabel). */
  propertyTypeLabel: string;
  listingType: AdminPropertyListingType;
  titlePrefix: string;
}

export const ADMIN_PROPERTY_TYPE_CASES: AdminPropertyTypeCase[] = [
  {
    propertyTypeLabel: 'Alquiler de temporada',
    listingType: 'SummerRent',
    titlePrefix: 'E2E Temporada',
  },
  {
    propertyTypeLabel: 'Eventos',
    listingType: 'EventVenue',
    titlePrefix: 'E2E Eventos',
  },
];
