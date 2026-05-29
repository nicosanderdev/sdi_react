import type { GuestSiteListingType } from '../../types/guestReviewContract';
import type { AppParametersMap } from '../pricing/types';

export type { AppParametersMap };

export interface PropertySearchScores {
  quality_score?: number;
  engagement_score?: number;
  reputation_score?: number;
  freshness_score?: number;
  exploration_boost?: number;
  offline_base_score?: number;
}

export interface PropertySearchOnlineBoosts {
  availability_score?: number;
  distance_score?: number;
}

export interface PortalSearchResultItem {
  estatePropertyId: string;
  listingId: string;
  listingType: string;
  title: string;
  description?: string;
  displayPrice?: number;
  currency?: string;
  city?: string;
  state?: string;
  country?: string;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number;
  capacity?: number;
  ownerId?: string;
  lat?: number;
  lng?: number;
  areaValue?: number;
  areaUnit?: string;
  blockedForBooking?: boolean;
  scores: PropertySearchScores;
  offlineBaseScore?: number;
  onlineBoosts: PropertySearchOnlineBoosts;
}

export interface PortalSearchResponse {
  items: PortalSearchResultItem[];
  total: number;
}

export interface PortalSearchFilters {
  listingType: GuestSiteListingType;
  siteScope?: GuestSiteListingType;
  swLat?: number;
  neLat?: number;
  swLng?: number;
  neLng?: number;
  city?: string;
  searchText?: string;
  minPrice?: number;
  maxPrice?: number;
  bedroomsMin?: number;
  capacityMin?: number;
  amenityIds?: string[];
  checkIn?: string;
  checkOut?: string;
  centerLat?: number;
  centerLng?: number;
  limit?: number;
}

export interface RankedSearchItem extends PortalSearchResultItem {
  finalScore: number;
}

export interface SearchScoreWeights {
  quality?: number;
  engagement?: number;
  reputation?: number;
  freshness?: number;
  exploration?: number;
}

export interface SearchOnlineWeights {
  availability?: number;
  distance?: number;
}

export interface SearchDiversityRules {
  maxPerOwner?: number;
  maxPerCity?: number;
  geoGridKm?: number;
  maxPerCell?: number;
}

export interface SearchRandomnessConfig {
  enabled?: boolean;
  strength?: number;
  seedTtlMinutes?: number;
}

export interface SearchRankOptions {
  params: AppParametersMap;
  sessionSeed: string;
}
