import type { PropertyType } from '../models/properties/PropertyData';

export interface PropertyExtensionIntent {
  propertyId: string;
  /** Logical property purpose, e.g. RealEstate, SummerRent, EventVenue, AnnualRent. */
  propertyType: PropertyType;
  /** Whether this extension should be considered the main/featured one for this purpose. */
  isPrimary: boolean;
}

export const PropertyExtensionService = {
  /**
   * Create one or more logical extensions for a newly created property.
   * This is a placeholder – wire it to your RPC/edge functions later.
   */
  async createExtensionsForProperty(
    _intents: PropertyExtensionIntent[]
  ): Promise<void> {
    // TODO: Implement using Supabase RPC / tables.
    return;
  },
};

export default PropertyExtensionService;

