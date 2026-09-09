import type { GuestSiteListingType } from '../../types/guestReviewContract';

export type PriceRoundingMode = 'none' | 'tens' | 'ending_99';

export type SeasonTier = 'low' | 'mid' | 'high';

export interface SeasonCalendarEntry {
  from: string;
  to: string;
  tier: SeasonTier;
}

export interface SpecialDateEntry {
  start: string;
  end?: string;
  multiplier: number;
}

export interface DailyFactorEntry {
  date: string;
  seasonFactor?: number | null;
  specialFactor?: number | null;
  demandFactor?: number;
  demandScore?: number | null;
}

export type AppParametersMap = Record<string, unknown>;

export interface ListingPricingInput {
  listingId?: string;
  basePrice: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  longStayDiscountEnabled?: boolean;
  longStayMinDays?: number | null;
  longStayDiscountPercentage?: number | null;
}

export interface SearchContext {
  siteListingType: GuestSiteListingType;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  /** Reference date for anticipation (defaults to today). */
  searchDate?: string;
}

export interface PriceBreakdownNight {
  date: string;
  basePrice: number;
  seasonFactor: number;
  specialFactor: number;
  demandFactor: number;
  anticipationFactor: number;
  rawNightly: number;
  clampedNightly: number;
  roundedNightly: number;
}

export interface PriceBreakdown {
  nights: number;
  nightlyAverage: number;
  subtotalBeforeStay: number;
  stayFactor: number;
  totalBeforeRound: number;
  total: number;
  displayLabel: 'per_night' | 'from' | 'total_stay';
  nightDetails?: PriceBreakdownNight[];
}
