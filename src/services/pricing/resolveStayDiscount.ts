import type { ListingPricingInput } from './types';

/** Multiplier applied to subtotal when long-stay rules match (e.g. 10% off → 0.9). */
export function resolveStayFactor(listing: ListingPricingInput, nights: number): number {
  if (
    !listing.longStayDiscountEnabled ||
    listing.longStayMinDays == null ||
    nights < listing.longStayMinDays ||
    listing.longStayDiscountPercentage == null
  ) {
    return 1;
  }
  return Math.max(0, 1 - listing.longStayDiscountPercentage / 100);
}
