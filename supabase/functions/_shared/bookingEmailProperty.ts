import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface BookingPropertyAddress {
  StreetName: string | null;
  HouseNumber: string | null;
  Neighborhood: string | null;
  City: string | null;
  State: string | null;
}

interface ListingTitleRow {
  Title?: string | null;
}

interface LookupError {
  code?: string;
  message?: string;
}

export interface BookingLookupFailure {
  status: number;
  error: string;
}

/** Address label used when the listing has no title. */
export function propertyTitleFromAddress(
  property: BookingPropertyAddress | null | undefined,
): string | null {
  if (!property) return null;
  const parts = [
    property.HouseNumber,
    property.StreetName,
    property.Neighborhood,
    property.City,
    property.State,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : null;
}

export function resolveGuestPropertyTitle(
  listingTitle: string | null | undefined,
  property: BookingPropertyAddress | null | undefined,
): string {
  const fromListing = listingTitle?.trim();
  if (fromListing) return fromListing;
  return propertyTitleFromAddress(property) ?? 'Property';
}

/**
 * Zero-row lookups from `.single()` are PostgREST PGRST116.
 * Any other error is a failed query, not a missing booking.
 */
export function bookingLookupFailure(error: LookupError | null): BookingLookupFailure {
  if (!error || error.code === 'PGRST116') {
    return { status: 404, error: 'Booking not found' };
  }
  return { status: 500, error: error.message || 'Failed to load booking' };
}

/**
 * Guest-facing name lives on Listings, not EstateProperties.
 * Prefer the booking's listing type, then active, then newest.
 */
export async function loadListingTitle(
  supabase: SupabaseClient,
  estatePropertyId: string,
  listingType: string | null,
): Promise<string | null> {
  let query = supabase
    .from('Listings')
    .select('Title')
    .eq('EstatePropertyId', estatePropertyId)
    .eq('IsDeleted', false);

  if (listingType) {
    query = query.eq('ListingType', listingType);
  }

  const { data, error } = await query
    .order('IsActive', { ascending: false, nullsFirst: false })
    .order('Created', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching listing title:', error);
    return null;
  }

  const title = (data as ListingTitleRow | null)?.Title?.trim() ?? '';
  return title || null;
}
