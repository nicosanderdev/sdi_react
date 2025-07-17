// src/services/propertyService.ts
import apiClient from './AxiosClient'; // Assuming AxiosClient is correctly set up

// --- Helper Interfaces ---
export interface PropertyImage {
  id?: string;
  url: string;
  altText?: string;
  isMain?: boolean;
}

export interface EstatePropertyDescription {
  id?: string;
  languageCode?: string;
  title?: string;
  text: string;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface PropertyDataList {
  items: PropertyData[];
  total?: number;
  page?: number;
}

// --- Main PropertyData Interface ---
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
  images: File[];
  mainImage?: File;
  mainImageUrl?: string;
  publicDeed: File;
  propertyPlans: File;
  taxReceipts: File;
  otherDocuments?: File[];
  // estate property values
  description?: string;
  availableFrom: Date;
  arePetsAllowed: boolean;
  capacity: number;
  ownerId?: string;
  // price and status
  currency: 'USD' | 'UYU' | 'BRL' | 'EUR' | 'GBP';
  salePrice?: string;
  rentPrice?: string;
  hasCommonExpenses: boolean;
  commonExpensesAmount?: string;
  isElectricityIncluded: boolean;
  isWaterIncluded: boolean;
  isPriceVisible: boolean;
  status: 'sale' | 'rent' | 'reserved' | 'sold' | 'unavailable';
  isActive: boolean;
  isPropertyVisible: boolean;
  created: Date;
}

// API Endpoints
const ENDPOINTS = {
  PROPERTIES: '/properties',
  CREATE_PROPERTY: '/properties/create',
  USERS_PROPERTIES: '/properties/mine',
  PROPERTY_DETAIL: (id: string) => `/properties/${id}`,
};

/**
 * Fetches a list of properties.
 */
const getProperties = async (params?: any): Promise<PropertyDataList> => {
  try {
    const response = await apiClient.get<PropertyDataList>(ENDPOINTS.PROPERTIES, { params });
    return response;
  } catch (error: any) {
    console.error('Error fetching properties:', error.message);
    throw error;
  }
};

// Fetch a list of properties owned by the user
const getUserProperties = async (params?: any): Promise<PropertyDataList> => {
  try {
    const response = await apiClient.get<PropertyDataList>(ENDPOINTS.USERS_PROPERTIES, { params });
    response.items.map(prop => ({
      ...prop,
      id: String(prop.id),
    }));
    return response
  } catch (error: any) {
    console.error('Error fetching properties:', error.message);
    throw error;
  }
};

// Fetch a single property by its ID
const getPropertyById = async (id: string): Promise<PropertyData> => {
  try {
    const response = await apiClient.get<{ data: PropertyData }>(ENDPOINTS.PROPERTY_DETAIL(id));
    const rawProperty = response.data;
     return {
      ...rawProperty,
      id: String(rawProperty.id),
      isPropertyVisible: rawProperty.isPropertyVisible === undefined ? true : rawProperty.isPropertyVisible,
    };
  } catch (error: any) {
    console.error(`Error fetching property ${id}:`, error.message);
    throw error;
  }
};

// Create a new property using FormData
const createProperty = async (formData: FormData): Promise<PropertyData> => {
  try {
    const response = await apiClient.post<PropertyData>(ENDPOINTS.CREATE_PROPERTY, formData, {
      headers: { 'Content-Type': 'multipart/form-data' } 
    });
    const rawProperty = response;
    return { 
      ...rawProperty,
      id: String(rawProperty!),
    };
  } catch (error: any) {
    console.error('Error creating property:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to create property via FormData');
  }
};

// Update an existing property
const updateProperty = async (id: string, propertyData: Partial<PropertyData>): Promise<PropertyData> => {
  try {
    const response = await apiClient.put<{ data: PropertyData }>(ENDPOINTS.PROPERTY_DETAIL(id), propertyData);
    const rawProperty = response.data || response.data;
     return { // Ensure transformation for consistency
      ...rawProperty,
      id: String(rawProperty.id)
    };
  } catch (error: any) {
    console.error(`Error updating property ${id}:`, error.message);
    throw error;
  }
};

// Delete a property by its ID
const deleteProperty = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(ENDPOINTS.PROPERTY_DETAIL(id));
  } catch (error: any) {
    console.error(`Error deleting property ${id}:`, error.message);
    throw error;
  }
};

const propertyService = {
  getProperties,
  getUserProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
};

export default propertyService;