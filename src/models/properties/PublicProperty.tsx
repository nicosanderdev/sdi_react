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
  images: { id: string; url: string; }[];
  mainImageId: string;
  description: string;
  arePetsAllowed: boolean;
  salePrice?: number;
  rentPrice?: number;
  currency: 'USD' | 'EUR' | 'GBP';
  isElectricityIncluded: boolean;
  isWaterIncluded: boolean;
}
