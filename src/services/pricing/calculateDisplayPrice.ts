import { clampPrice, commercialRound, getRoundingMode } from './commercialRound';
import { resolveAnticipationFactor } from './resolveAnticipation';
import { resolveDemandFactor } from './resolveDemandFactor';
import { resolveSeasonFactor } from './resolveSeason';
import { resolveSpecialDayFactor } from './resolveSpecialDates';
import { resolveStayFactor } from './resolveStayDiscount';
import type {
  AppParametersMap,
  DailyFactorEntry,
  ListingPricingInput,
  PriceBreakdown,
  SearchContext,
} from './types';

function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function eachNight(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  const start = parseUtcDate(checkIn);
  const end = parseUtcDate(checkOut);
  const cur = new Date(start);
  while (cur < end) {
    nights.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return nights;
}

function paramNumber(params: AppParametersMap, key: string, fallback: number): number {
  const v = params[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') return parseFloat(v);
  return fallback;
}

function computeNightly(
  listing: ListingPricingInput,
  dateIso: string,
  params: AppParametersMap,
  searchDate: Date,
  dailyFactors?: DailyFactorEntry[]
) {
  const date = parseUtcDate(dateIso);
  const seasonFactor = resolveSeasonFactor(date, params);
  const specialFactor = resolveSpecialDayFactor(date, params);
  const demandFactor = resolveDemandFactor(listing.listingId, dateIso, dailyFactors);
  const anticipationFactor = resolveAnticipationFactor(date, params, searchDate);
  const raw =
    listing.basePrice * seasonFactor * specialFactor * demandFactor * anticipationFactor;
  const rounding = getRoundingMode(params);
  const clamped = clampPrice(raw, listing.minPrice, listing.maxPrice);
  const rounded = commercialRound(clamped, rounding);
  return {
    seasonFactor,
    specialFactor,
    demandFactor,
    anticipationFactor,
    rawNightly: raw,
    clampedNightly: clamped,
    roundedNightly: rounded,
  };
}

/** Lowest plausible nightly for "from" pricing when dates are unknown. */
export function computeFromPrice(
  listing: ListingPricingInput,
  params: AppParametersMap
): number {
  const lowSeason = paramNumber(params, 'SEASON_FACTOR_LOW', 0.9);
  const raw = listing.basePrice * lowSeason;
  const rounding = getRoundingMode(params);
  const clamped = clampPrice(raw, listing.minPrice, listing.maxPrice);
  return commercialRound(clamped, rounding);
}

export function calculateDisplayPrice(
  listing: ListingPricingInput,
  params: AppParametersMap,
  context: SearchContext,
  dailyFactors?: DailyFactorEntry[]
): PriceBreakdown {
  const searchDate = context.searchDate
    ? parseUtcDate(context.searchDate)
    : new Date();

  if (!context.checkIn || !context.checkOut) {
    const from = computeFromPrice(listing, params);
    return {
      nights: 0,
      nightlyAverage: from,
      subtotalBeforeStay: from,
      stayFactor: 1,
      totalBeforeRound: from,
      total: from,
      displayLabel: 'from',
    };
  }

  const nightDates = eachNight(context.checkIn, context.checkOut);
  const nights = nightDates.length;
  if (nights <= 0) {
    const from = computeFromPrice(listing, params);
    return {
      nights: 0,
      nightlyAverage: from,
      subtotalBeforeStay: from,
      stayFactor: 1,
      totalBeforeRound: from,
      total: from,
      displayLabel: 'from',
    };
  }

  let subtotal = 0;
  const nightDetails = nightDates.map(dateIso => {
    const n = computeNightly(listing, dateIso, params, searchDate, dailyFactors);
    subtotal += n.roundedNightly;
    return {
      date: dateIso,
      basePrice: listing.basePrice,
      ...n,
    };
  });

  const stayFactor = resolveStayFactor(listing, nights);
  const totalBeforeRound = subtotal * stayFactor;
  const total = Math.round(totalBeforeRound * 100) / 100;
  const nightlyAverage = nights > 0 ? Math.round((total / nights) * 100) / 100 : total;

  return {
    nights,
    nightlyAverage,
    subtotalBeforeStay: subtotal,
    stayFactor,
    totalBeforeRound,
    total,
    displayLabel: nights === 1 ? 'per_night' : 'total_stay',
    nightDetails,
  };
}
