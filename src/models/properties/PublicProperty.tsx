import { Amenity } from "./Amenity";
import { PropertyImage } from "./PropertyImage";
import { PropertyVideo } from "./PropertyVideo";
import type { LocalizedTextByLanguage } from "./localizedText";
import type { PropertySectionDisplayVariant, PropertySectionLayoutType } from "./propertyContentSections";
import type { ListingType, PropertyType } from "./PropertyData";

export interface PublicProperty {
  id: string;
  streetName: string;
  houseNumber: string;
  neighborhood?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  location: { lat: number; lng: number; };
  title: string;
  type: string;
  areaValue: number;
  areaUnit: 'sqm' | 'sqft';
  bedrooms: number;
  bathrooms: number;
  hasGarage: boolean;
  garageSpaces: number;
  propertyImages: PropertyImage[];
  propertyVideos: PropertyVideo[];
  amenities: Amenity[];
  mainImageId: string;
  description: string;
  salePrice?: number;
  rentPrice?: number;
  /** Dynamic pricing base nightly rate (SummerRent / EventVenue). */
  basePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  longStayDiscountEnabled?: boolean;
  longStayMinDays?: number | null;
  longStayDiscountPercentage?: number | null;
  listingId?: string;
  listingType?: string;
  currency: 'USD' | 'EUR' | 'GBP';
  isElectricityIncluded: boolean;
  isWaterIncluded: boolean;
  ownerId?: string;
  /** When true, property is visible but not accepting new bookings (e.g. overdue unpaid receipt). */
  blockedForBooking?: boolean;
  policies?: PublicPropertyPolicy[];
  contentSections?: PublicPropertyContentSection[];
}

export interface PublicPropertyPolicy {
  listingType?: ListingType;
  templateKey?: string | null;
  title?: LocalizedTextByLanguage;
  description?: LocalizedTextByLanguage;
  displayOrder?: number;
}

export interface PublicPropertyContentSection {
  propertyType?: PropertyType;
  templateKey?: string | null;
  localizedName?: LocalizedTextByLanguage;
  localizedDescription?: LocalizedTextByLanguage;
  layoutType?: PropertySectionLayoutType;
  layoutConfig?: { displayVariant?: PropertySectionDisplayVariant };
  images?: Array<{ propertyImageId?: string; url: string; altText?: string; displayOrder?: number }>;
}
