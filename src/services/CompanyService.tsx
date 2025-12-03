// src/services/CompanyService.tsx
import apiClient from './AxiosClient';
import { CompanyUser } from '../models/companies/CompanyUser';
import { CompanyInfo } from '../models/companies/CompanyInfo';
import { AddUserToCompanyRequest } from '../models/companies/AddUserToCompanyRequest';
import { UpdateCompanyProfilePayload } from '../models/companies/UpdateCompanyProfilePayload';

export type { CompanyUser, CompanyInfo, AddUserToCompanyRequest, UpdateCompanyProfilePayload };

const ENDPOINTS = {
  COMPANY_INFO: '/company/me',
  COMPANY_USERS: '/company/me/users',
  ADD_USER: '/company/me/users',
  REMOVE_USER: (userId: string) => `/company/me/users/${userId}`,
  UPDATE_PROFILE: '/company/me/profile',
  UPLOAD_LOGO: '/company/me/logo',
  UPLOAD_BANNER: '/company/me/banner',
};

/**
 * Fetches the current user's company information
 */
const getCompanyInfo = async (): Promise<CompanyInfo> => {
  try {
    return await apiClient.get<CompanyInfo>(ENDPOINTS.COMPANY_INFO);
  } catch (error: any) {
    console.error('Error fetching company info:', error.message);
    throw error;
  }
};

/**
 * Fetches the list of users in the company
 */
const getCompanyUsers = async (): Promise<CompanyUser[]> => {
  try {
    const response = await apiClient.get<CompanyUser[]>(ENDPOINTS.COMPANY_USERS);
    return Array.isArray(response) ? response : [];
  } catch (error: any) {
    console.error('Error fetching company users:', error.message);
    throw error;
  }
};

/**
 * Adds a user to the company by email
 */
const addUserToCompany = async (request: AddUserToCompanyRequest): Promise<CompanyUser> => {
  try {
    return await apiClient.post<CompanyUser>(ENDPOINTS.ADD_USER, request);
  } catch (error: any) {
    console.error('Error adding user to company:', error.message);
    throw error;
  }
};

/**
 * Removes a user from the company
 */
const removeUserFromCompany = async (userId: string): Promise<void> => {
  try {
    await apiClient.delete(ENDPOINTS.REMOVE_USER(userId));
  } catch (error: any) {
    console.error('Error removing user from company:', error.message);
    throw error;
  }
};

/**
 * Updates the company profile information
 */
const updateCompanyProfile = async (payload: UpdateCompanyProfilePayload): Promise<CompanyInfo> => {
  try {
    return await apiClient.put<CompanyInfo>(ENDPOINTS.UPDATE_PROFILE, payload);
  } catch (error: any) {
    console.error('Error updating company profile:', error.message);
    throw error;
  }
};

/**
 * Uploads a company logo image
 */
const uploadCompanyLogo = async (formData: FormData): Promise<{ logoUrl: string }> => {
  try {
    const response = await apiClient.post<{ logoUrl: string }>(ENDPOINTS.UPLOAD_LOGO, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  } catch (error: any) {
    console.error('Error uploading company logo:', error.message);
    throw error;
  }
};

/**
 * Uploads a company banner/cover image
 */
const uploadCompanyBanner = async (formData: FormData): Promise<{ bannerUrl: string }> => {
  try {
    const response = await apiClient.post<{ bannerUrl: string }>(ENDPOINTS.UPLOAD_BANNER, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  } catch (error: any) {
    console.error('Error uploading company banner:', error.message);
    throw error;
  }
};

const companyService = {
  getCompanyInfo,
  getCompanyUsers,
  addUserToCompany,
  removeUserFromCompany,
  updateCompanyProfile,
  uploadCompanyLogo,
  uploadCompanyBanner,
};

export default companyService;

