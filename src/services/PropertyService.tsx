// src/services/propertyService.ts
import apiClient from './AxiosClient'; // Assuming AxiosClient is correctly set up

// --- Helper Interfaces ---
export interface PropertyImage {
  id?: string; // Or Guid
  url: string;
  altText?: string;
  isMain?: boolean;
}

export interface EstatePropertyDescription {
  id?: string; // Or Guid
  languageCode?: string; // e.g., "en", "es"
  title?: string;
  text: string;
}

// --- Main PropertyData Interface ---
export interface PropertyData {
  // Fields from your C# backend model (or adapted)
  id: string; // PropertyTable uses number, API likely string. Using string.
  address?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  isPublic?: boolean; // Assuming default true if not present
  
  mainImage?: PropertyImage | null; // Raw main image object from backend
  propertyImages?: PropertyImage[] | null;
  featuredDescriptionId?: string | null;
  featuredDescription?: EstatePropertyDescription | null;
  estatePropertyDescriptions?: EstatePropertyDescription[] | null;

  // Fields matching PropertyTable.tsx and common for listings
  title: string;
  price: string; // e.g., "€450,000"
  status: 'sale' | 'rent' | 'reserved' | 'sold' | 'unavailable' | string; // PropertyTable uses 'sale', 'rent', 'reserved'
  type: string; // PropertyTable.tsx uses 'type' (e.g., 'Apartamento', 'Casa')
  area: string; // e.g., "95m²"
  bedrooms: number;
  bathrooms: number;
  created: string; // Date string, e.g., "15/04/2023"
  visits?: number;

  // Derived/Helper fields for UI
  mainImageUrl?: string | null; // To be populated for easy display
}


// API Endpoints
const ENDPOINTS = {
  PROPERTIES: '/properties',
  PROPERTY_DETAIL: (id: string) => `/properties/${id}`,
};

/**
 * Fetches a list of properties.
 * The actual API might return data wrapped, e.g., { data: PropertyData[], total: number }
 * This service should ideally return the processed array of PropertyData.
 */
const getProperties = async (params?: any): Promise<PropertyData[]> => {
  try {
    const response = await apiClient.get<{ data: PropertyData[], total?: number, page?: number }>(ENDPOINTS.PROPERTIES, { params });
    // Adapt this based on your actual API response structure
    // This example assumes the properties are in response.data.data or response.data
    const rawProperties = response.data || (Array.isArray(response.data) ? response.data : []);

    // Transform raw data if necessary (e.g., create mainImageUrl)
    return rawProperties.map(prop => ({
      ...prop,
      id: String(prop.id), // Ensure ID is string
      mainImageUrl: prop.mainImage?.url || (prop.propertyImages && prop.propertyImages.length > 0 ? prop.propertyImages[0].url : undefined),
      isPublic: prop.isPublic === undefined ? true : prop.isPublic, // Default isPublic to true
    }));
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
      mainImageUrl: rawProperty.mainImage?.url || (rawProperty.propertyImages && rawProperty.propertyImages.length > 0 ? rawProperty.propertyImages[0].url : undefined),
      isPublic: rawProperty.isPublic === undefined ? true : rawProperty.isPublic,
    };
  } catch (error: any) {
    console.error(`Error fetching property ${id}:`, error.message);
    throw error;
  }
};

// Create a new property (Payload type might need more specific definition)
const createProperty = async (propertyData: Partial<PropertyData>): Promise<PropertyData> => {
  try {
    const response = await apiClient.post<{ data: PropertyData }>(ENDPOINTS.PROPERTIES, propertyData);
    const rawProperty = response.data || response.data;
    return { // Ensure transformation for consistency
      ...rawProperty,
      id: String(rawProperty.id),
      mainImageUrl: rawProperty.mainImage?.url || (rawProperty.propertyImages && rawProperty.propertyImages.length > 0 ? rawProperty.propertyImages[0].url : undefined),
    };
  } catch (error: any) {
    console.error('Error creating property:', error.message);
    throw error;
  }
};

// Update an existing property
const updateProperty = async (id: string, propertyData: Partial<PropertyData>): Promise<PropertyData> => {
  try {
    const response = await apiClient.put<{ data: PropertyData }>(ENDPOINTS.PROPERTY_DETAIL(id), propertyData);
    const rawProperty = response.data || response.data;
     return { // Ensure transformation for consistency
      ...rawProperty,
      id: String(rawProperty.id),
      mainImageUrl: rawProperty.mainImage?.url || (rawProperty.propertyImages && rawProperty.propertyImages.length > 0 ? rawProperty.propertyImages[0].url : undefined),
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
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
};

export default propertyService;