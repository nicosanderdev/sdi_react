// src/services/profileService.ts
import apiClient from './AxiosClient'; // Assuming AxiosClient is correctly set up for JWT auth

export interface RequestPasswordChangeResponse {
  is2FaRequired: boolean;
  token?: string;
}

export interface AddressData {
  street: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface UserCompany {
  id: string;
  name: string;
}

export interface ProfileData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  avatarUrl?: string;
  address: AddressData;
  roles?: string[];
  companies?: UserCompany[];
}

export interface UpdateProfilePayload {
  id? : string;
  updateProfileDto? : Partial<ProfileData>
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export interface ChangeRoleRequest {
  userId: string;
  newRole: string;
  companyId?: string;
}

export interface ChangeRoleResponse {
  success: boolean;
  message: string;
  newRole: string;
  affectedCompanies: UserCompany[];
}

// API Endpoints
const ENDPOINTS = {
  CURRENT_PROFILE: '/profile/me',
  CHANGE_PASSWORD: '/profile/me/change-password',
  UPLOAD_AVATAR: '/profile/avatar',
  RESET_PASSWORD_INIT: '/auth/reset-password-init',
  CHANGE_ROLE: '/users/change-role',
};

/**
 * Fetches the profile of the currently authenticated user.
 */
const getCurrentUserProfile = async (): Promise<ProfileData> => {
  try {
    return await apiClient.get<ProfileData>(ENDPOINTS.CURRENT_PROFILE);
  } catch (error: any) {
    console.error('Error fetching current user profile:', error.message);
    throw error;
  }
};

/**
 * Updates the profile of the currently authenticated user.
 * @param {UpdateProfilePayload} profileUpdateData - An object containing the profile fields to update.
 */
const updateUserProfile = async (profileUpdateData: UpdateProfilePayload): Promise<UpdateProfilePayload> => {
  try {
    return await apiClient.put<UpdateProfilePayload>(ENDPOINTS.CURRENT_PROFILE, profileUpdateData);
  } catch (error: any) {
    console.error('Error updating user profile:', error.message);
    throw error;
  }
};

/**
 * Uploads a new profile picture for the currently authenticated user.
 * @param {FormData} formData - The FormData object containing the image file.
 *                              Typically, the file is appended with a key like 'avatar'.
 */
const uploadProfilePicture = async (formData: FormData): Promise<{ avatarUrl: string }> => { // Or Promise<ProfileData> if backend returns full profile
  try {
    const response = await apiClient.post<{ avatarUrl: string }>(ENDPOINTS.UPLOAD_AVATAR, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  } catch (error: any) {
    console.error('Error uploading profile picture:', error.message);
    throw error;
  }
};

const requestPasswordChange = async(): Promise<RequestPasswordChangeResponse> => {
  try {
    return await apiClient.post<RequestPasswordChangeResponse>(ENDPOINTS.RESET_PASSWORD_INIT, {});
  } catch (error: any) {
    console.error('Reset password error:', error?.response?.data || error?.message);
    throw error;
  }
}

/**
 * Changes the role of a user (admin to manager, etc.)
 * @param request - The role change request
 * @returns The response with new role and affected companies
 */
const changeRole = async (request: ChangeRoleRequest): Promise<ChangeRoleResponse> => {
  try {
    return await apiClient.post<ChangeRoleResponse>(ENDPOINTS.CHANGE_ROLE, request);
  } catch (error: any) {
    console.error('Change role error:', error?.response?.data || error?.message);
    throw error;
  }
}

const profileService = {
  getCurrentUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  requestPasswordChange,
  changeRole
};

export default profileService;