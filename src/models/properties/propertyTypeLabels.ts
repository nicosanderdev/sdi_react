import type { ListingType, PropertyType } from './PropertyData';

export function getPropertyTypeLabelEs(pt: PropertyType | null | undefined): string {
  if (!pt) return 'Selecciona el tipo de propiedad';
  if (pt === 'RealEstate') return 'Venta / alquiler anual';
  if (pt === 'SummerRent') return 'Alquiler de temporada';
  if (pt === 'EventVenue') return 'Eventos';
  return String(pt);
}

/** Short labels for tabs and compact UI (edit wizard). */
export function getPropertyTypeShortLabelEs(pt: PropertyType | null | undefined): string {
  if (!pt) return '';
  if (pt === 'RealEstate') return 'Inmobiliaria';
  if (pt === 'SummerRent') return 'Alquiler temporal';
  if (pt === 'EventVenue') return 'Eventos';
  return String(pt);
}

/** Maps a listing row type to the `Amenities.PropertyType` filter (and extension form bucket). */
export function listingTypeToAmenityPropertyType(lt: ListingType): PropertyType {
  if (lt === 'AnnualRent' || lt === 'RealEstate') return 'RealEstate';
  if (lt === 'SummerRent') return 'SummerRent';
  return 'EventVenue';
}

/** Distinct extension buckets for amenities / tabs, stable order. */
export function distinctAmenityPropertyTypesForListings(listingTypes: ListingType[]): PropertyType[] {
  const order: PropertyType[] = ['RealEstate', 'SummerRent', 'EventVenue'];
  const seen = new Set(listingTypes.map(listingTypeToAmenityPropertyType));
  return order.filter(k => seen.has(k));
}

export function getListingTypeLabelEs(lt: ListingType): string {
  switch (lt) {
    case 'RealEstate':
      return 'Inmobiliaria';
    case 'AnnualRent':
      return 'Alquiler anual';
    case 'SummerRent':
      return 'Alquiler temporal';
    case 'EventVenue':
      return 'Eventos';
    default:
      return String(lt);
  }
}

/** Spanish labels for each distinct listing type on the property (header / summary). */
export function getActiveModalitiesLabelsEs(listingTypes: ListingType[]): string[] {
  return [...new Set(listingTypes)].map(getListingTypeLabelEs);
}

/** Featured listing drives `propertyType` on the form when only one modality matters. */
export function listingTypeToFormPropertyType(lt: ListingType | undefined): PropertyType {
  if (lt === 'SummerRent') return 'SummerRent';
  if (lt === 'EventVenue') return 'EventVenue';
  return 'RealEstate';
}
