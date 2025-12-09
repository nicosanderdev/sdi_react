// src/services/CompanyService.tsx
import apiClient from './AxiosClient'; // Keep for file uploads if needed
import { supabase } from '../config/supabase';
import { CompanyUser } from '../models/companies/CompanyUser';
import { CompanyInfo } from '../models/companies/CompanyInfo';
import { AddUserToCompanyRequest } from '../models/companies/AddUserToCompanyRequest';
import { UpdateCompanyProfilePayload } from '../models/companies/UpdateCompanyProfilePayload';
import { mapDbToCompany, mapDbToCompanyUser, getCurrentUserId } from './SupabaseHelpers';

// Company role constants based on Supabase company_roles enum
// Assuming enum values: 'Admin', 'Manager', 'Member'
const COMPANY_ROLES = {
  MEMBER: 'Member',
  MANAGER: 'Manager',
  ADMIN: 'Admin'
} as const;

export type { CompanyUser, CompanyInfo, AddUserToCompanyRequest, UpdateCompanyProfilePayload };

const ENDPOINTS = {
  COMPANY_INFO: '/company/me',
  COMPANY_USERS: '/company/me/users',
  ADD_USER: '/company/me/users',
  REMOVE_USER: (userId: string) => `/company/me/users/${userId}`,
  UPDATE_PROFILE: '/company/me/profile',
  UPLOAD_LOGO: '/company/me/logo',
  UPLOAD_BANNER: '/company/me/banner',
  CREATE_COMPANY: '/companies',
};

/**
 * Fetches the current user's company information
 */
const getCompanyInfo = async (): Promise<CompanyInfo> => {
  try {
    const userId = await getCurrentUserId();

    // Get the user's primary company (first one they joined)
    const { data: userCompany, error: ucError } = await supabase
      .from('UserCompanies')
      .select(`
        *,
        Companies (*)
      `)
      .eq('MemberId', userId)
      .eq('IsDeleted', false)
      .order('JoinedAt', { ascending: true })
      .limit(1)
      .single();

    if (ucError) throw ucError;

    // Check if company is deleted
    if (userCompany.Companies.IsDeleted) {
      throw new Error('Company has been deleted');
    }

    if (ucError) {
      if ((ucError as any).code === 'PGRST116') {
        throw new Error('User is not a member of any company');
      }
      throw ucError;
    }

    return mapDbToCompany(userCompany.Companies);

  } catch (error: any) {
    console.error('Error fetching company info:', error.message);
    throw error;
  }
};

/**
 * Creates a new company and adds the current user as admin
 */
const createCompany = async (companyData: {
  name: string;
  description?: string;
  billingEmail?: string;
}): Promise<CompanyInfo> => {
  try {
    const userId = await getCurrentUserId();

    // Get current user profile for billing email
    const { data: userProfile, error: profileError } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (profileError) throw profileError;

    // Create company
    const { data: newCompany, error: companyError } = await supabase
      .from('Companies')
      .insert({
        Name: companyData.name,
        Description: companyData.description || '',
        BillingContactUserId: userId,
        BillingEmail: companyData.billingEmail || '', // Will be updated after user provides it
        CreatedAt: new Date().toISOString(),
        LogoUrl: '',
        BannerUrl: '',
        Street: '',
        Street2: '',
        City: '',
        State: '',
        PostalCode: '',
        Country: '',
        Phone: '',
        IsDeleted: false
      })
      .select()
      .single();

    if (companyError) throw companyError;

    // Add user as Admin to UserCompanies
    const { error: membershipError } = await supabase
      .from('UserCompanies')
      .insert({
        MemberId: userProfile.Id,
        CompanyId: newCompany.Id,
        Role: COMPANY_ROLES.ADMIN, // Admin role from company_roles enum
        AddedBy: userId,
        JoinedAt: new Date().toISOString(),
        IsDeleted: false
      });

    if (membershipError) throw membershipError;

    return mapDbToCompany(newCompany);

  } catch (error: any) {
    console.error('Error creating company:', error.message);
    throw error;
  }
};

/**
 * Fetches the list of users in the company
 */
const getCompanyUsers = async (): Promise<CompanyUser[]> => {
  try {
    const userId = await getCurrentUserId();

    // First get the user's company
    const { data: userCompany, error: ucError } = await supabase
      .from('UserCompanies')
      .select('CompanyId')
      .eq('MemberId', userId)
      .eq('IsDeleted', false)
      .order('JoinedAt', { ascending: true })
      .limit(1)
      .single();

    if (ucError) {
      if (ucError.code === 'PGRST116') {
        return []; // User not in any company
      }
      throw ucError;
    }

    // Get all users in this company
    const { data: companyUsers, error: cuError } = await supabase
      .from('UserCompanies')
      .select(`
        *,
        Members (*)
      `)
      .eq('CompanyId', userCompany.CompanyId)
      .eq('IsDeleted', false)
      .eq('Members.IsDeleted', false);

    if (cuError) throw cuError;

    return companyUsers?.map(cu => mapDbToCompanyUser(cu)) || [];

  } catch (error: any) {
    console.error('Error fetching company users:', error.message);
    throw error;
  }
};

/**
 * Adds a user to the company by email
 */
const addUserToCompany = async (_request: AddUserToCompanyRequest): Promise<CompanyUser> => {
  try {
    const currentUserId = await getCurrentUserId();

    // Get the current user's company
    const { data: userCompany, error: ucError } = await supabase
      .from('UserCompanies')
      .select('CompanyId, Role')
      .eq('MemberId', currentUserId)
      .eq('IsDeleted', false)
      .order('JoinedAt', { ascending: true })
      .limit(1)
      .single();

    if (ucError) throw ucError;

    // Check if current user has permission (Admin or Manager can add users)
    if (userCompany.Role === COMPANY_ROLES.MEMBER) {
      throw new Error('Insufficient permissions to add users to company');
    }

    // For now, we'll directly add users if they exist in the system
    // In a proper implementation, this would create an invite that users accept

    // Note: Invite system not yet implemented - this is a placeholder
    throw new Error('Invite system not yet implemented. Please contact support to add users.');

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
    const userId = await getCurrentUserId();

    // Get the user's company
    const { data: userCompany, error: ucError } = await supabase
      .from('UserCompanies')
      .select('CompanyId, Role')
      .eq('MemberId', userId)
      .eq('IsDeleted', false)
      .order('JoinedAt', { ascending: true })
      .limit(1)
      .single();

    if (ucError) throw ucError;

    // Check permissions (Admin or Manager can update)
    if (userCompany.Role === COMPANY_ROLES.MEMBER) {
      throw new Error('Insufficient permissions to update company profile');
    }

    // Map payload to database columns
    const updateData: any = {};

    if (payload.name !== undefined) updateData.Name = payload.name;
    if (payload.description !== undefined) updateData.Description = payload.description;

    // Address fields
    if (payload.address) {
      if (payload.address.street !== undefined) updateData.Street = payload.address.street;
      if (payload.address.street2 !== undefined) updateData.Street2 = payload.address.street2;
      if (payload.address.city !== undefined) updateData.City = payload.address.city;
      if (payload.address.state !== undefined) updateData.State = payload.address.state;
      if (payload.address.postalCode !== undefined) updateData.PostalCode = payload.address.postalCode;
      if (payload.address.country !== undefined) updateData.Country = payload.address.country;
    }

    // Note: logoUrl, bannerUrl, and phone are not in the current payload interface
    // These would need to be added to UpdateCompanyProfilePayload if needed

    updateData.LastModified = new Date().toISOString();
    updateData.LastModifiedBy = userId;

    const { data: updatedCompany, error: updateError } = await supabase
      .from('Companies')
      .update(updateData)
      .eq('Id', userCompany.CompanyId)
      .select()
      .single();

    if (updateError) throw updateError;

    return mapDbToCompany(updatedCompany);

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
    const userId = await getCurrentUserId();
    const file = formData.get('logo') as File;

    if (!file) {
      throw new Error('No file provided for upload');
    }

    // Get user's company
    const { data: userCompany, error: ucError } = await supabase
      .from('UserCompanies')
      .select('CompanyId')
      .eq('MemberId', userId)
      .eq('IsDeleted', false)
      .order('JoinedAt', { ascending: true })
      .limit(1)
      .single();

    if (ucError) throw ucError;

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `companies/${userCompany.CompanyId}/logo-${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('company-assets') // Assuming you have a 'company-assets' bucket
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(fileName);

    const logoUrl = urlData.publicUrl;

    // Update the company record
    const { error: updateError } = await supabase
      .from('Companies')
      .update({
        LogoUrl: logoUrl,
        LastModified: new Date().toISOString(),
        LastModifiedBy: userId
      })
      .eq('Id', userCompany.CompanyId);

    if (updateError) throw updateError;

    return { logoUrl };

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
    const userId = await getCurrentUserId();
    const file = formData.get('banner') as File;

    if (!file) {
      throw new Error('No file provided for upload');
    }

    // Get user's company
    const { data: userCompany, error: ucError } = await supabase
      .from('UserCompanies')
      .select('CompanyId')
      .eq('MemberId', userId)
      .eq('IsDeleted', false)
      .order('JoinedAt', { ascending: true })
      .limit(1)
      .single();

    if (ucError) throw ucError;

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `companies/${userCompany.CompanyId}/banner-${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('company-assets') // Assuming you have a 'company-assets' bucket
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(fileName);

    const bannerUrl = urlData.publicUrl;

    // Update the company record
    const { error: updateError } = await supabase
      .from('Companies')
      .update({
        BannerUrl: bannerUrl,
        LastModified: new Date().toISOString(),
        LastModifiedBy: userId
      })
      .eq('Id', userCompany.CompanyId);

    if (updateError) throw updateError;

    return { bannerUrl };

  } catch (error: any) {
    console.error('Error uploading company banner:', error.message);
    throw error;
  }
};

const companyService = {
  getCompanyInfo,
  getCompanyUsers,
  createCompany,
  addUserToCompany,
  removeUserFromCompany,
  updateCompanyProfile,
  uploadCompanyLogo,
  uploadCompanyBanner,
};

export default companyService;

