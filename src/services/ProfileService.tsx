// src/services/profileService.ts
import apiClient from './AxiosClient'; // Keep for auth-related HTTP calls
import { supabase } from '../config/supabase';
import {
  mapDbToProfile,
  getCurrentUserId,
  mapRoleStringToNumber
} from './SupabaseHelpers';

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
  companies?: UserCompany[];
  roles?: string[];
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

// API Endpoints (keep for auth-related operations)
const ENDPOINTS = {
  CHANGE_PASSWORD: '/profile/me/change-password',
  RESET_PASSWORD_INIT: '/auth/reset-password-init',
};

/**
 * Fetches the profile of the currently authenticated user.
 */
const getCurrentUserProfile = async (user?: any): Promise<ProfileData> => {
  try {
    const userId = await getCurrentUserId(user);

    const { data: memberData, error } = await supabase
      .from('Members')
      .select(`
        *
      `)
      .eq('UserId', userId)
      .eq('IsDeleted', false);

    if (error) {
      // If no member record exists, this might be a new user - handle gracefully
      if (error.code === 'PGRST116') {
        // Create a basic profile from available data
        return {
          id: '',
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          title: '',
          address: {
            street: '',
            street2: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
          },
          companies: []
        };
      }
      throw error;
    }

    // Map the joined data to ProfileData
    const member = memberData[0]; // Should be single due to UserId unique constraint
    return mapDbToProfile(member, member.UserCompanies);

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
    const userId = await getCurrentUserId();

    if (!profileUpdateData.updateProfileDto) {
      throw new Error('No profile data provided for update');
    }

    const { updateProfileDto } = profileUpdateData;

    // Map ProfileData fields to Members table columns
    const updateData: any = {};

    if (updateProfileDto.firstName !== undefined) updateData.FirstName = updateProfileDto.firstName;
    if (updateProfileDto.lastName !== undefined) updateData.LastName = updateProfileDto.lastName;
    if (updateProfileDto.title !== undefined) updateData.Title = updateProfileDto.title;
    if (updateProfileDto.avatarUrl !== undefined) updateData.AvatarUrl = updateProfileDto.avatarUrl;
    if (updateProfileDto.phone !== undefined) updateData.Phone = updateProfileDto.phone;

    // Address fields
    if (updateProfileDto.address) {
      if (updateProfileDto.address.street !== undefined) updateData.Street = updateProfileDto.address.street;
      if (updateProfileDto.address.street2 !== undefined) updateData.Street2 = updateProfileDto.address.street2;
      if (updateProfileDto.address.city !== undefined) updateData.City = updateProfileDto.address.city;
      if (updateProfileDto.address.state !== undefined) updateData.State = updateProfileDto.address.state;
      if (updateProfileDto.address.postalCode !== undefined) updateData.PostalCode = updateProfileDto.address.postalCode;
      if (updateProfileDto.address.country !== undefined) updateData.Country = updateProfileDto.address.country;
    }

    updateData.LastModified = new Date().toISOString();
    updateData.LastModifiedBy = userId;

    const { data, error } = await supabase
      .from('Members')
      .update(updateData)
      .eq('UserId', userId)
      .select()
      .single();

    if (error) throw error;

    return { id: data.Id, updateProfileDto };

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
const PROFILE_PICTURES_MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

const uploadProfilePicture = async (formData: FormData): Promise<{ avatarUrl: string }> => {
  try {
    const userId = await getCurrentUserId();
    const file = formData.get('avatar') as File;

    if (!file) {
      throw new Error('No file provided for upload');
    }

    if (file.size > PROFILE_PICTURES_MAX_SIZE_BYTES) {
      throw new Error('Profile picture must be 8MB or smaller.');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

    // Check if profile_pictures bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.warn('Could not verify bucket existence, proceeding with upload:', bucketError.message);
    } else {
      const profilePicturesBucket = buckets?.find(bucket => bucket.name === 'profile_pictures');
      if (!profilePicturesBucket) {
        console.warn('profile_pictures bucket not found in list, but proceeding with upload attempt');
      }
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('profile_pictures')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      if (uploadError.message?.includes('Bucket not found')) {
        throw new Error('Profile picture storage is not configured. Please contact an administrator to create the "profile_pictures" bucket.');
      }
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile_pictures')
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    // Update the member record with the new avatar URL using RPC function
    // This bypasses RLS policies that might be blocking the direct update
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_member_avatar', {
        avatar_url: avatarUrl
      });

    if (updateError) {
      console.error('RPC update error:', updateError);
      // Fallback to direct update if RPC fails
      const { error: directUpdateError } = await supabase
        .from('Members')
        .update({
          AvatarUrl: avatarUrl,
          LastModified: new Date().toISOString(),
          LastModifiedBy: userId
        })
        .eq('UserId', userId);

      if (directUpdateError) throw directUpdateError;
    } else if (!updateResult) {
      throw new Error('Failed to update avatar URL');
    }

    return { avatarUrl };

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
    const roleNumber = mapRoleStringToNumber(request.newRole);

    // If companyId is specified, update only that specific UserCompany record
    if (request.companyId) {
      const { data, error } = await supabase
        .from('UserCompanies')
        .update({ Role: roleNumber })
        .eq('MemberId', request.userId)
        .eq('CompanyId', request.companyId)
        .eq('IsDeleted', false)
        .select(`
          *,
          Companies (*)
        `);

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('User is not a member of the specified company');
      }

      const affectedCompanies = data.map(uc => ({
        id: uc.Companies.Id,
        name: uc.Companies.Name
      }));

      return {
        success: true,
        message: 'Role updated successfully',
        newRole: request.newRole,
        affectedCompanies
      };
    }

    // If no companyId specified, update all UserCompany records for this user
    const { data, error } = await supabase
      .from('UserCompanies')
      .update({ Role: roleNumber })
      .eq('MemberId', request.userId)
      .eq('IsDeleted', false)
      .select(`
        *,
        Companies (*)
      `);

    if (error) throw error;

    const affectedCompanies = data?.map(uc => ({
      id: uc.Companies.Id,
      name: uc.Companies.Name
    })) || [];

    return {
      success: true,
      message: `Role updated for ${affectedCompanies.length} companies`,
      newRole: request.newRole,
      affectedCompanies
    };

  } catch (error: any) {
    console.error('Change role error:', error.message);
    throw error;
  }
}

/**
 * Sends an email verification code to the new email address.
 * Call verifyEmailCode with the code to complete the change.
 */
const sendEmailVerification = async (newEmail: string): Promise<{ message: string; email: string }> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.functions.invoke('send-email-verification', {
    body: { userId, newEmail }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { message: data?.message ?? 'Verification code sent', email: data?.email ?? newEmail };
};

/**
 * Verifies the email change with the 6-digit code received by email.
 */
const verifyEmailCode = async (code: string): Promise<{ message: string; newEmail: string }> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.functions.invoke('verify-email-code', {
    body: { userId, code }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { message: data?.message ?? 'Email updated', newEmail: data?.newEmail ?? '' };
};

/**
 * Sends a phone verification code to the new phone number.
 * Call verifyPhoneCode with the code to complete the change.
 */
const sendPhoneVerification = async (newPhone: string): Promise<{ message: string; phone: string }> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.functions.invoke('send-phone-verification', {
    body: { userId, newPhone }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { message: data?.message ?? 'Verification code sent', phone: data?.phone ?? newPhone };
};

/**
 * Verifies the phone change with the 6-digit code received by SMS.
 */
const verifyPhoneCode = async (code: string): Promise<{ message: string; newPhone: string }> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.functions.invoke('verify-phone-code', {
    body: { userId, code }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { message: data?.message ?? 'Phone updated', newPhone: data?.newPhone ?? '' };
};

const profileService = {
  getCurrentUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  requestPasswordChange,
  changeRole,
  sendEmailVerification,
  verifyEmailCode,
  sendPhoneVerification,
  verifyPhoneCode
};

export default profileService;