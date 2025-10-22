import { PropertyImage } from "./PropertyImage";
import { PropertyDocument } from "./PropertyDocument";
import { PropertyVideo } from "./PropertyVideo";
import { Amenity } from "./Amenity";
import { EstatePropertyValues } from "./EstatePropertyValues";

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
  type: 'house' | 'apartment' | 'commercial' | 'land' | 'other';
  areaValue: number;
  areaUnit: 'm²' | 'ft²' | 'yd²' | 'acres' | 'hectares' | 'sq_km' | 'sq_mi';
  bedrooms: number;
  bathrooms: number;
  hasGarage: boolean;
  garageSpaces: number;
  // other info
  //relationships
  mainImageId?: string;
  propertyImages: PropertyImage[];
  propertyDocuments?: PropertyDocument[];
  propertyVideos: PropertyVideo[];
  amenities: Amenity[];
  // estate property values
  description?: string;
  availableFrom: Date;
  availableFromText: string;
  arePetsAllowed: boolean;
  capacity: number;
  ownerId?: string;
  // price and status
  currency: 'USD' | 'UYU' | 'BRL' | 'EUR' | 'GBP';
  salePrice?: string;
  rentPrice?: string;
  hasCommonExpenses: boolean;
  commonExpensesValue?: string;
  isElectricityIncluded: boolean;
  isWaterIncluded: boolean;
  isPriceVisible: boolean;
  status: 'sale' | 'rent' | 'reserved' | 'sold' | 'unavailable';
  isActive: boolean;
  isPropertyVisible: boolean;
  created: Date;
  visits?: number;
  
  // Version history
  estatePropertyValues?: EstatePropertyValues[];
}
