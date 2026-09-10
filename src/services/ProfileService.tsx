// src/services/profileService.ts
import { supabase } from '../config/supabase';
import { storageService } from './storage';
import {
  mapDbToProfile,
  getCurrentUserId,
  mapRoleStringToNumber
} from './SupabaseHelpers';

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
  /** CompanyMembers.Role: Admin | Manager | Member */
  role?: string;
}

export interface ProfileData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phonePrefix?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  title: string;
  avatarUrl?: string;
  address: AddressData;
  companies?: UserCompany[];
  role?: string;
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

/**
 * Fetches the profile of the currently authenticated user.
 */
const getCurrentUserProfile = async (user?: any): Promise<ProfileData> => {
  try {
    const userId = await getCurrentUserId(user);

    const { data: memberData, error } = await supabase
      .from('Members')
      .select(`
        *,
        CompanyMembers (
          *,
          Companies!FK_CompanyMembers_Companies_CompanyId (*)
        )
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
          phonePrefix: '',
          emailVerified: false,
          phoneVerified: false,
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
    return mapDbToProfile(member, (member as any).CompanyMembers);

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

    const { publicUrl: avatarUrl } = await storageService.presignAndUpload(file, {
      bucket: 'avatars',
      key: fileName,
    });

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
        .from('CompanyMembers')
        .update({ Role: roleNumber })
        .eq('MemberId', request.userId)
        .eq('CompanyId', request.companyId)
        .eq('IsDeleted', false)
        .select(`
          *,
          Companies!FK_CompanyMembers_Companies_CompanyId (*)
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
      .from('CompanyMembers')
      .update({ Role: roleNumber })
      .eq('MemberId', request.userId)
      .eq('IsDeleted', false)
      .select(`
        *,
        Companies!FK_CompanyMembers_Companies_CompanyId (*)
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
 * Sends an email verification code. Omit email to use the current member email.
 */
const sendEmailVerification = async (email?: string): Promise<{ message: string; email: string }> => {
  const { data, error } = await supabase.functions.invoke('send-email-verification', {
    body: email ? { email } : {},
  });
  if (data?.error) throw new Error(data.error);
  if (error) throw error;
  return { message: data?.message ?? 'Verification code sent', email: data?.email ?? email ?? '' };
};

/**
 * Verifies the email OTP.
 */
const verifyEmailCode = async (code: string): Promise<{ message: string; newEmail: string }> => {
  const { data, error } = await supabase.functions.invoke('verify-email-code', {
    body: { code },
  });
  if (data?.error) throw new Error(data.error);
  if (error) throw error;
  return { message: data?.message ?? 'Email updated', newEmail: data?.newEmail ?? '' };
};

/**
 * Sends a phone verification code via WhatsApp.
 */
const sendPhoneVerification = async (
  phone: string,
  phonePrefix: string
): Promise<{ message: string; phone: string }> => {
  const { data, error } = await supabase.functions.invoke('send-phone-verification', {
    body: { phone, phonePrefix },
  });
  if (data?.error) throw new Error(data.error);
  if (error) throw error;
  return { message: data?.message ?? 'Verification code sent', phone: data?.phone ?? phone };
};

/**
 * Verifies the phone OTP sent via WhatsApp.
 */
const verifyPhoneCode = async (code: string): Promise<{ message: string; newPhone: string }> => {
  const { data, error } = await supabase.functions.invoke('verify-phone-code', {
    body: { code },
  });
  if (data?.error) throw new Error(data.error);
  if (error) throw error;
  return { message: data?.message ?? 'Phone updated', newPhone: data?.newPhone ?? '' };
};

const profileService = {
  getCurrentUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  changeRole,
  sendEmailVerification,
  verifyEmailCode,
  sendPhoneVerification,
  verifyPhoneCode
};

export default profileService;