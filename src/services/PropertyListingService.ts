import type { ListingType } from '../models/properties/PropertyData';

export interface ListingIntentPayload {
  propertyId: string;
  listingType: ListingType;
  /** Whether this listing should be visible immediately. */
  publishNow: boolean;
  /** Whether this listing should be the featured one for its type. */
  isFeatured: boolean;
}

export const PropertyListingService = {
  /**
   * Create one listing per type for a property, based on the
   * high-level intent captured in the creation wizard.
   * This is a placeholder – implement with Supabase RPC/tables later.
   */
  async createListingsForProperty(
    _intents: ListingIntentPayload[]
  ): Promise<void> {
    // TODO: Implement using Supabase RPC / tables.
    return;
  },
};

export default PropertyListingService;

