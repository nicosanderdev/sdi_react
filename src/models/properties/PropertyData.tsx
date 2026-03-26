import { PropertyImage } from "./PropertyImage";
import { PropertyDocument } from "./PropertyDocument";
import { PropertyVideo } from "./PropertyVideo";
import { Amenity } from "./Amenity";
import { EstatePropertyValues } from "./EstatePropertyValues";

export type PropertyType =
  | 'SummerRent'
  | 'EventVenue'
  | 'RealEstate';

export type LocationCategory = 'rural' | 'city' | 'near_shore';

export type ViewType = 'city' | 'mountain' | 'rural' | 'sea';

export type ListingType = 'SummerRent' | 'EventVenue' | 'AnnualRent' | 'RealEstate';

export interface Listing {
  id: string;
  estatePropertyId: string;
  listingType: ListingType;
  description?: string;
  availableFrom: Date;
  capacity?: number;
  currency: number;
  salePrice?: number;
  rentPrice?: number;
  hasCommonExpenses: boolean;
  commonExpensesValue?: number;
  isElectricityIncluded?: boolean;
  isWaterIncluded?: boolean;
  isPriceVisible: boolean;
  status: number;
  isActive: boolean;
  isPropertyVisible: boolean;
  isFeatured: boolean;
  blockedForBooking?: boolean;
  isDeleted: boolean;
  createdAt: Date;
  createdBy?: string;
  lastModified?: Date;
  lastModifiedBy?: string;
}

export interface PropertyData {
  // Mirrors `public.get_admin_property_detail` (returns TABLE(...)) shape.
  id: string;

  // address
  street_name: string;
  house_number: string;
  neighborhood?: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  location_latitude: number;
  location_longitude: number;

  // structural
  category: number;
  area_value: number;
  area_unit: number;
  bedrooms: number;
  bathrooms: number;
  garage_spaces: number;

  // infrastructure
  hasLaundryRoom: boolean;
  hasPool: boolean;
  hasBalcony: boolean;
  isFurnished: boolean;
  capacity: number;

  // location and view categories
  location_category: number;
  view_type: number;

  // relationships
  owner_id: string;

  // real estate extension
  allowsFinancing: boolean;
  isNewConstruction: boolean;
  hasMortgage: boolean;
  hoaFees: number;
  minContractMonths: number;
  requiresGuarantee: boolean;
  guaranteeType?: string | null;
  allowsPets: boolean;

  // event venue extension
  maxGuests: number;
  hasCatering: boolean;
  hasSoundSystem: boolean;
  closingHour?: string | null;
  allowedEventsDescription?: string | null;

  // summer rent extension
  minStayDays: number;
  maxStayDays: number;
  leadTimeDays: number;
  bufferDays: number;

  // audit
  isDeleted: boolean;
  created: string;
  createdBy?: string | null;
  lastModified: string;
  lastModifiedBy?: string | null;

  // Optional fields used elsewhere in the app (not returned by the RPC).
  mainImageId?: string;
  propertyImages?: PropertyImage[];
  propertyDocuments?: PropertyDocument[];
  propertyVideos?: PropertyVideo[];
  amenities?: Amenity[];

  estatePropertyValues?: EstatePropertyValues[];
  listings?: Listing[];
}
