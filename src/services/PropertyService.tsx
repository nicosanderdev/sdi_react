import {
  PropertyParams,
  PublicPropertyDataList,
  PropertyDataList,
  PropertyData,
} from '../models/properties';

import apiClient from './AxiosClient';

// API Endpoints
const ENDPOINTS = {
  PROPERTIES: '/properties',
  CREATE_PROPERTY: '/properties/create',
  USERS_PROPERTIES: '/properties/mine',
  PROPERTY_DETAIL: (id: string) => `/properties/${id}`,
  USERS_PROPERTY_DETAIL: (id: string) => `/properties/mine/${id}`,
};

/**
 * Fetches a list of properties.
 */
const getProperties = async (params?: PropertyParams): Promise<PublicPropertyDataList> => {
  try {
    const response = await apiClient.get<PublicPropertyDataList>(ENDPOINTS.PROPERTIES, { params });
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
    return response;
  } catch (error: any) {
    console.error('Error fetching properties:', error.message);
    throw error;
  }
};

// Fetch a single property with public info by its ID
const getPropertyById = async (id: string): Promise<PropertyData> => {
  try {
    const response = await apiClient.get<PropertyData>(ENDPOINTS.PROPERTY_DETAIL(id));
    return response;
  } catch (error: any) {
    console.error(`Error fetching property ${id}:`, error.message);
    throw error;
  }
};

// Fetch a single property by its ID
const getOwnersPropertyById = async (id: string): Promise<PropertyData> => {
  try {
    const response = await apiClient.get<PropertyData>(ENDPOINTS.USERS_PROPERTY_DETAIL(id));
    return response;
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

const propertyService = {
  getProperties,
  getUserProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getOwnersPropertyById
};

export default propertyService;