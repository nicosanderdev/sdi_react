import type { ListingType, PropertyType } from './PropertyData';

/** Types offered for new property creation (RealEstate soft-deprecated). */
export const CREATABLE_PROPERTY_TYPES: readonly PropertyType[] = ['SummerRent', 'EventVenue'];

export const CREATE_BLOCKED_NO_TYPES_MESSAGE =
  'Tu plan actual no incluye un tipo de propiedad disponible para alta.';

export const DUPLICATE_REAL_ESTATE_BLOCKED_MESSAGE =
  'No se pueden duplicar propiedades de venta o alquiler anual.';

/**
 * Plan `PropertyType` → types selectable on create.
 * Unrestricted / missing → Summer + Event; RealEstate → none until the plan is updated.
 */
export function resolveCreatablePropertyTypes(
  planPropertyType?: PropertyType | null
): PropertyType[] {
  if (planPropertyType === 'SummerRent' || planPropertyType === 'EventVenue') {
    return [planPropertyType];
  }
  if (planPropertyType === 'RealEstate') {
    return [];
  }
  return [...CREATABLE_PROPERTY_TYPES];
}

type SubscriptionTypeSource = {
  propertyTypes?: PropertyType[];
  propertyType?: PropertyType;
  plan?: { propertyType?: PropertyType };
} | null | undefined;

/** Resolve create options from subscription; missing data falls back to Summer + Event. */
export function resolveCreatablePropertyTypesFromSubscription(
  subscription: SubscriptionTypeSource
): PropertyType[] {
  if (!subscription) {
    return [...CREATABLE_PROPERTY_TYPES];
  }

  const listed = subscription.propertyTypes?.filter(Boolean) as PropertyType[] | undefined;
  if (listed && listed.length > 0) {
    const creatable = listed.filter(t => t === 'SummerRent' || t === 'EventVenue');
    if (creatable.length > 0) return creatable;
    if (listed.every(t => t === 'RealEstate')) return [];
    return [...CREATABLE_PROPERTY_TYPES];
  }

  const single = subscription.propertyType ?? subscription.plan?.propertyType;
  return resolveCreatablePropertyTypes(single);
}

export function defaultCreatablePropertyType(types: PropertyType[]): PropertyType | undefined {
  if (types.length === 0) return undefined;
  if (types.length === 1) return types[0];
  if (types.includes('SummerRent')) return 'SummerRent';
  return types[0];
}

export function isCreatablePropertyType(type: PropertyType | null | undefined): boolean {
  return type === 'SummerRent' || type === 'EventVenue';
}

/** True when duplicating would create another venta / alquiler anual property. */
export function listingTypesBlockRealEstateDuplication(
  activeListingTypes?: ListingType[] | null,
  listingType?: ListingType | null
): boolean {
  const types =
    activeListingTypes && activeListingTypes.length > 0
      ? activeListingTypes
      : listingType
        ? [listingType]
        : [];
  return types.some(t => t === 'RealEstate' || t === 'AnnualRent');
}

/** Admin list summary labels from `get_admin_properties_list.property_types_summary`. */
export function adminTypeSummaryBlocksRealEstateDuplication(
  summary: string | null | undefined
): boolean {
  if (!summary?.trim()) return false;
  const labels = summary.split(',').map(s => s.trim().toLowerCase());
  return labels.some(l => l === 'en venta' || l === 'en alquiler');
}
