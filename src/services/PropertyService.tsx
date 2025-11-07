import {
  PropertyParams,
  PublicPropertyDataList,
  PropertyDataList,
  PropertyData,
  PublicProperty,
  Amenity,
} from '../models/properties';
import { DuplicatedEstateProperty } from '../models/properties/DuplicatedEstateProperty';

import apiClient from './AxiosClient';

// API Endpoints
const ENDPOINTS = {
  PROPERTIES: '/properties',
  CREATE_PROPERTY: '/properties/create',
  USERS_PROPERTIES: '/properties/mine',
  PROPERTY_DETAIL: (id: string) => `/properties/${id}`,
  PROPERTY_DUPLICATE: (id: string) => `/properties/${id}/duplicate`,
  AMENITIES: '/properties/amenities',
  FAVORITE_UPDATE: '/properties/favorite-update',
  FAVORITES: '/properties/favorites'
};


/**
 * Fetches a list of public properties.
 * @param params - The parameters for the query.
 * @returns A list of public properties.
 */
const getProperties = async (params?: PropertyParams): Promise<PublicPropertyDataList> => {
  try {
    var newParams = {
      ...params,
      includeImages: true
    };
    const response = await apiClient.get<PublicPropertyDataList>(ENDPOINTS.PROPERTIES, { params: newParams });
    return response;
  } catch (error: any) {
    console.error('Error fetching properties:', error.message);
    throw error;
  }
};

/**
 * Fetches properties within a specific map bounding box.
 * This is optimized for map viewport-based queries.
 */
const getPropertiesInBounds = async (
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  additionalParams?: Partial<PropertyParams>
): Promise<PublicPropertyDataList> => {
  try {
    const filter: PropertyParams['filter'] = {
      ...additionalParams?.filter,
      swLat,
      swLng,
      neLat,
      neLng,
      includeImages: true
    };

    const params: PropertyParams = {
      pageNumber: additionalParams?.pageNumber ?? 1,
      pageSize: additionalParams?.pageSize ?? 100,
      filter
    };

    const requestParams: Record<string, unknown> = {
      ...params,
      'Filter.IncludeImages': true
    };

    const response = await apiClient.get<PublicPropertyDataList>(ENDPOINTS.PROPERTIES, {
      params: requestParams,
      paramsSerializer: { indexes: null }
    });

    return {
      ...response,
      items: response.items?.map(property => ({
        ...property,
        propertyImages: property.propertyImages ?? []
      })) ?? []
    };
  } catch (error: any) {
    console.error('Error fetching properties in bounds:', error.message);
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

// Duplicate a property by its ID
const duplicateProperty = async (id: string): Promise<DuplicatedEstateProperty> => {
  try {
    const response = await apiClient.post<DuplicatedEstateProperty>(ENDPOINTS.PROPERTY_DUPLICATE(id));
    return response;
  } catch (error: any) {
    console.error(`Error duplicating property ${id}:`, error.message);
    throw error;
  }
};

// Update favorite status for a property
const updatePropertyFavorite = async (estatePropertyId: string, isFavorite: boolean): Promise<void> => {
  try {
    console.log(`Making API call to update favorite: ${ENDPOINTS.FAVORITE_UPDATE}`, {
      favoriteDto: {
        estatePropertyId: estatePropertyId,
        userId: null,
        isFavorite: isFavorite
      }
    });
    await apiClient.post(ENDPOINTS.FAVORITE_UPDATE, {
      favoriteDto: {
        estatePropertyId: estatePropertyId,
        userId: null,
        isFavorite: isFavorite
      }
    });
    console.log(`API call successful for property ${estatePropertyId}`);
  } catch (error: any) {
    console.error(`Error updating favorite status for property ${estatePropertyId}:`, error.message);
    throw error;
  }
};

// Get user's favorite property IDs
const getPropertiesAsFavorite = async (): Promise<string[]> => {
  try {
    console.log(`Making API call to fetch favorites: ${ENDPOINTS.FAVORITES}`);
    const response = await apiClient.get<string[]>(ENDPOINTS.FAVORITES);
    console.log('Favorites API response:', response);
    return response;
  } catch (error: any) {
    console.error('Error fetching favorite properties:', error.message);
    throw error;
  }
};

// Get user's favorite properties as full objects
const getFavoriteProperties = async (): Promise<PublicProperty[]> => {
  try {
    console.log(`Making API call to fetch favorite property IDs: ${ENDPOINTS.FAVORITES}`);
    const propertyIds = await apiClient.get<string[]>(ENDPOINTS.FAVORITES);
    console.log('Favorite property IDs:', propertyIds);
    
    if (!propertyIds || propertyIds.length === 0) {
      return [];
    }
    
    // Fetch the full property objects using the IDs
    const response = await apiClient.get<PublicPropertyDataList>(ENDPOINTS.PROPERTIES, {
      params: {
        Ids: propertyIds,
        'Filter.IncludeImages': true,
        'Filter.IncludeVideos': true,
        'Filter.IncludeAmenities': true
      },
      paramsSerializer: { indexes: null }
    });
    
    console.log('Favorite properties fetched:', response.items);
    return response.items || [];
  } catch (error: any) {
    console.error('Error fetching favorite properties:', error.message);
    throw error;
  }
};

const propertyService = {
  getProperties,
  getPropertiesInBounds,
  getUserProperties,
  getPropertyById,
  getOwnersProperties,
  getOwnersPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  duplicateProperty,
  getAmenities,
  updatePropertyFavorite,
  getPropertiesAsFavorite,
  getFavoriteProperties
};

export default propertyService;