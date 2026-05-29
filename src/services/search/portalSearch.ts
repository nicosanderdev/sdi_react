import { supabase } from '../../config/supabase';
import type { PortalSearchFilters, PortalSearchResponse, PortalSearchResultItem } from './types';

function mapRpcItem(raw: Record<string, unknown>): PortalSearchResultItem {
  return {
    estatePropertyId: String(raw.estatePropertyId ?? ''),
    listingId: String(raw.listingId ?? ''),
    listingType: String(raw.listingType ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description != null ? String(raw.description) : undefined,
    displayPrice: raw.displayPrice != null ? Number(raw.displayPrice) : undefined,
    currency: raw.currency != null ? String(raw.currency) : undefined,
    city: raw.city != null ? String(raw.city) : undefined,
    state: raw.state != null ? String(raw.state) : undefined,
    country: raw.country != null ? String(raw.country) : undefined,
    neighborhood: raw.neighborhood != null ? String(raw.neighborhood) : undefined,
    bedrooms: raw.bedrooms != null ? Number(raw.bedrooms) : undefined,
    bathrooms: raw.bathrooms != null ? Number(raw.bathrooms) : undefined,
    capacity: raw.capacity != null ? Number(raw.capacity) : undefined,
    ownerId: raw.ownerId != null ? String(raw.ownerId) : undefined,
    lat: raw.lat != null ? Number(raw.lat) : undefined,
    lng: raw.lng != null ? Number(raw.lng) : undefined,
    areaValue: raw.areaValue != null ? Number(raw.areaValue) : undefined,
    areaUnit: raw.areaUnit != null ? String(raw.areaUnit) : undefined,
    blockedForBooking: raw.blockedForBooking === true,
    scores: (raw.scores as PortalSearchResultItem['scores']) ?? {},
    offlineBaseScore: raw.offlineBaseScore != null ? Number(raw.offlineBaseScore) : undefined,
    onlineBoosts: (raw.onlineBoosts as PortalSearchResultItem['onlineBoosts']) ?? {},
  };
}

export async function portalSearchProperties(
  filters: PortalSearchFilters,
): Promise<PortalSearchResponse> {
  const { data, error } = await supabase.rpc('portal_search_properties', {
    p_listing_type: filters.listingType,
    p_site_scope: filters.siteScope ?? filters.listingType,
    p_sw_lat: filters.swLat ?? null,
    p_ne_lat: filters.neLat ?? null,
    p_sw_lng: filters.swLng ?? null,
    p_ne_lng: filters.neLng ?? null,
    p_city: filters.city ?? null,
    p_search_text: filters.searchText ?? null,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_bedrooms_min: filters.bedroomsMin ?? null,
    p_capacity_min: filters.capacityMin ?? null,
    p_amenity_ids: filters.amenityIds?.length ? filters.amenityIds : null,
    p_check_in: filters.checkIn ?? null,
    p_check_out: filters.checkOut ?? null,
    p_availability_mode: filters.availabilityMode ?? 'stay',
    p_center_lat: filters.centerLat ?? null,
    p_center_lng: filters.centerLng ?? null,
    p_limit: filters.limit ?? null,
  });

  if (error) throw error;

  const payload = (data ?? { items: [], total: 0 }) as {
    items?: Record<string, unknown>[];
    total?: number;
  };

  const items = (payload.items ?? []).map(mapRpcItem);
  return {
    items,
    total: typeof payload.total === 'number' ? payload.total : items.length,
  };
}

export async function getPropertySearchScores(
  propertyIds: string[],
  listingType: string,
): Promise<PortalSearchResultItem['scores'][]> {
  const { data, error } = await supabase.rpc('get_property_search_scores', {
    p_property_ids: propertyIds,
    p_listing_type: listingType,
  });

  if (error) throw error;
  return ((data ?? []) as { scores?: PortalSearchResultItem['scores'] }[]).map(
    (row) => row.scores ?? {},
  );
}
