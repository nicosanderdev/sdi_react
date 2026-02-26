import { Amenity } from "./Amenity";
import { PropertyImage } from "./PropertyImage";
import { PropertyVideo } from "./PropertyVideo";

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
  currency: 'USD' | 'EUR' | 'GBP';
  isElectricityIncluded: boolean;
  isWaterIncluded: boolean;
  ownerId?: string;
  /** When true, property is visible but not accepting new bookings (e.g. overdue unpaid receipt). */
  blockedForBooking?: boolean;
}
