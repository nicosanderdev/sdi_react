import {
  PropertyParams,
  PublicPropertyDataList,
  PropertyDataList,
  PropertyData,
  PublicProperty,
  Amenity,
} from '../models/properties';

import apiClient from './AxiosClient';

// API Endpoints
const ENDPOINTS = {
  PROPERTIES: '/properties',
  CREATE_PROPERTY: '/properties/create',
  USERS_PROPERTIES: '/properties/mine',
  PROPERTY_DETAIL: (id: string) => `/properties/${id}`,
  AMENITIES: '/properties/amenities',
};


// Fetches a list of public properties.
const getProperties = async (params?: PropertyParams): Promise<PublicPropertyDataList> => {
  try {
    const response = await apiClient.get<PublicPropertyDataList>(ENDPOINTS.PROPERTIES, { params });
    return response;
  } catch (error: any) {
    console.error('Error fetching properties:', error.message);
    throw error;
  }
};

// Fetch a single property with public info by its ID
const getPropertyById = async (id: string, params?: PropertyParams): Promise<PublicProperty> => {
    try {
        if (params?.filter?.includeImages !== undefined) {
            params = {...params, filter: { ...params.filter, includeImages: true } }
        };
        if (params?.filter?.includeVideos !== undefined) {
            params = { ...params, filter: { ...params.filter, includeVideos: true } }
        };
        if (params?.filter?.includeAmenities !== undefined) {
            params = { ...params, filter: { ...params.filter, includeAmenities: true } }
        };
        const response = await apiClient.get<PublicPropertyDataList>(ENDPOINTS.PROPERTIES, {
            params: {
                Ids: [id],
                ...(params?.filter?.includeImages !== undefined && { 'Filter.IncludeImages': true }),
                ...(params?.filter?.includeVideos !== undefined && { 'Filter.IncludeVideos': true }),
                ...(params?.filter?.includeAmenities !== undefined && { 'Filter.IncludeAmenities': true }),
            },
            paramsSerializer: { indexes: null }
        });
        if (response.items && response.items.length > 0) {
            return response.items[0];
        }
        throw new Error('Property not found');
    } catch (error: any) {
        console.error(`Error fetching property ${id}:`, error.message);
        throw error;
    }
};

// Fetch a single property owned by the user by its ID
const getOwnersPropertyById = async (id: string): Promise<PropertyData> => {
  try {
    const response = await apiClient.get<PropertyDataList>(ENDPOINTS.USERS_PROPERTIES, { 
        params: { Ids: [id],
        'Filter.IncludeImages': true,
        'Filter.IncludeVideos': true,
        'Filter.IncludeDocuments': true,
        'Filter.IncludeAmenities': true
        },
        paramsSerializer: { indexes: null }
    });
    if (response.items && response.items.length > 0) {
      return response.items[0];
    }
    throw new Error('Property not found');
  } catch (error: any) {
    console.error(`Error fetching property ${id}:`, error.message);
    throw error;
  }
};

// Fetch a list of properties owned by the user
const getOwnersProperties = async (params?: PropertyParams): Promise<PropertyDataList> => {
  try {
    if (params?.filter?.includeImages !== undefined) {
      params.filter.includeImages = true;
    }
    if (params?.filter?.includeDocuments !== undefined) {
      params.filter.includeDocuments = true;
    }
    if (params?.filter?.includeVideos !== undefined) {
      params.filter.includeVideos = true;
    }
    if (params?.filter?.includeAmenities !== undefined) {
      params.filter.includeAmenities = true;
    }
    const response = await apiClient.get<PropertyDataList>(ENDPOINTS.USERS_PROPERTIES, { params });
    return {
      ...response,
      items: response.items.map(prop => ({
        ...prop,
        id: String(prop.id),
      }))
    };
  } catch (error: any) {
    console.error('Error fetching properties:', error.message);
    throw error;
  }
};

// Create a new property using FormData
const createProperty = async (formData: FormData): Promise<PropertyData> => {
  try {
    const response = await apiClient.post<PropertyData>(ENDPOINTS.CREATE_PROPERTY, formData, {
      headers: { 'Content-Type': 'multipart/form-data' } 
    });
    return { 
      ...response,
      id: String(response.id),
    };
  } catch (error: any) {
    console.error('Error creating property:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to create property via FormData');
  }
};

// Update an existing property
const updateProperty = async (id: string, formData: FormData): Promise<PropertyData> => {
  try {
    const response = await apiClient.put<PropertyData>(ENDPOINTS.PROPERTY_DETAIL(id), formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return {
      ...response,
      id: String(response.id)
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

// Get all amenities for a property
const getAmenities = async (): Promise<Amenity[]> => {
    try {
      return await apiClient.get<Amenity[]>(ENDPOINTS.AMENITIES);
    } catch (error: any) {
      console.error(`Error fetching amenities:`, error.message);
      throw error;
    }
  };

const propertyService = {
  getProperties,
  getPropertyById,
  getOwnersProperties,
  getOwnersPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getAmenities
};

// Legacy method names for backward compatibility
export const getUserProperties = getOwnersProperties;

export default propertyService;