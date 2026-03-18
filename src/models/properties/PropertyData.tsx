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
  id: string;
  // address
  streetName: string;
  houseNumber: string;
  neighborhood?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  location: {
    lat: number;
    lng: number;
  };
  // description
  title: string;
  type?: 'house' | 'apartment' | 'land' | 'small_farm' | 'farm';
  areaValue: number;
  areaUnit: 'm²' | 'ft²' | 'yd²' | 'acres' | 'hectares' | 'sq_km' | 'sq_mi';
  bedrooms: number;
  bathrooms: number;
  hasGarage: boolean;
  garageSpaces: number;
  // end-purpose type and structural/infrastructure flags
  propertyType?: PropertyType;
  hasLaundryRoom?: boolean;
  hasPool?: boolean;
  hasBalcony?: boolean;
  isFurnished?: boolean;
  capacity?: number;
  // other info
  //relationships
  mainImageId?: string;
  propertyImages: PropertyImage[];
  propertyDocuments?: PropertyDocument[];
  propertyVideos: PropertyVideo[];
  amenities: Amenity[];
  locationCategory?: LocationCategory;
  viewType?: ViewType;
  // estate property values
  description?: string;
  availableFrom: Date;
  availableFromText: string;
  ownerId?: string;
  // price and status
  currency?: 'USD' | 'UYU' | 'BRL' | 'EUR' | 'GBP';
  salePrice?: string;
  rentPrice?: string;
  hasCommonExpenses?: boolean;
  commonExpensesValue?: string;
  isElectricityIncluded?: boolean;
  isWaterIncluded?: boolean;
  isPriceVisible?: boolean;
  status?: 'sale' | 'rent' | 'reserved' | 'sold' | 'unavailable';
  isActive?: boolean;
  isPropertyVisible?: boolean;
  blockedForBooking?: boolean;
  created: Date;
  visits?: number;
  
  // Version history
  estatePropertyValues?: EstatePropertyValues[];
  // Listings history (one active per type, others historical)
  listings?: Listing[];
}
