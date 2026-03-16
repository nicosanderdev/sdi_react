// src/services/UserAdminService.tsx
import { supabase } from '../config/supabase';

// Subscription tier mapping (0-5)
export enum SubscriptionTier {
  Free = 0,
  Manager = 1,
  CompanySmall = 2,
  CompanyUnlimited = 3,
  ManagerPro = 4,
  None = 5
}

// User role types
export type UserRole = 'user' | 'admin';

// Account status types
export type AccountStatus = 'active' | 'suspended' | 'deleted';

// Subscription status types
export type SubscriptionStatus = 'active' | 'expired' | 'none';

// Payment status types
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'none' | 'unknown';

// Action history types
export type ActionType = 'suspend' | 'reactivate' | 'role_change' | 'reset_onboarding' | 'force_logout' | 'delete';

// Interfaces
export interface UserListItem {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionTier: number | null;
  subscriptionExpiresAt: string | null;
  accountStatus: AccountStatus;
  registrationDate: string;
  lastLogin: string | null;
  propertiesCount: number;
  paymentStatus: PaymentStatus;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionTier?: number;
  accountStatus?: AccountStatus;
  registrationDateFrom?: string;
  registrationDateTo?: string;
  search?: string;
}

export interface UserDetail {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  role: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionTier: number | null;
  subscriptionExpiresAt: string | null;
  accountStatus: AccountStatus;
  registrationDate: string;
  lastLogin: string | null;
  propertiesCount: number;
  paymentStatus: PaymentStatus;
  onboardingStep: number;
  onboardingComplete: boolean;
  actionHistory: ActionHistoryItem[];
}

export interface ActionHistoryItem {
  id: string;
  actionType: ActionType;
  actionDetails: any;
  performedAt: string;
  performedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ActionResult {
  success: boolean;
  message: string;
}

class UserAdminService {
  /**
   * Fetch paginated list of users with filters
   */
  async getUsersList(filters: UserFilters = {}): Promise<UserListResponse> {
    const params = {
      p_page: filters.page || 1,
      p_limit: filters.limit || 20,
      p_subscription_status: filters.subscriptionStatus || null,
      p_subscription_tier: filters.subscriptionTier || null,
      p_account_status: filters.accountStatus || null,
      p_registration_date_from: filters.registrationDateFrom || null,
      p_registration_date_to: filters.registrationDateTo || null,
      p_search: filters.search || null,
    };

    const { data, error } = await supabase.rpc('get_admin_users_list', params);

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7410/ingest/8cfc8ae1-a75f-4ac9-842a-c9e78ca77428',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e13e9'},body:JSON.stringify({sessionId:'0e13e9',location:'UserAdminService.tsx:getUsersList',message:'get_admin_users_list RPC error',data:{message:error.message,code:error.code,details:error.details,hint:error.hint},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      throw new Error(`Failed to fetch users list: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        users: [],
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 20,
      };
    }

    // Transform the data to match our interface
    const users: UserListItem[] = data.map((user: any) => ({
      id: user.id,
      userId: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      avatarUrl: user.avatar_url,
      role: user.role ?? user.roles?.[0] ?? 'user',
      subscriptionStatus: user.subscription_status,
      subscriptionTier: user.subscription_tier,
      subscriptionExpiresAt: user.subscription_expires_at,
      accountStatus: user.account_status,
      registrationDate: user.registration_date,
      lastLogin: user.last_login,
      propertiesCount: user.properties_count,
      paymentStatus: user.payment_status,
    }));

    return {
      users,
      total: data[0].total_count,
      page: filters.page || 1,
      limit: filters.limit || 20,
    };
  }

  /**
   * Fetch detailed user information
   */
  async getUserDetail(userId: string): Promise<UserDetail | null> {
    const { data, error } = await supabase.rpc('get_admin_user_detail', { p_user_id: userId });

    if (error) {
      throw new Error(`Failed to fetch user detail: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const user = data[0];

    return {
      id: user.id,
      userId: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      avatarUrl: user.avatar_url,
      phone: user.phone,
      street: user.street,
      street2: user.street2,
      city: user.city,
      state: user.state,
      postalCode: user.postal_code,
      country: user.country,
      role: user.role ?? user.roles?.[0] ?? 'user',
      subscriptionStatus: user.subscription_status,
      subscriptionTier: user.subscription_tier,
      subscriptionExpiresAt: user.subscription_expires_at,
      accountStatus: user.account_status,
      registrationDate: user.registration_date,
      lastLogin: user.last_login,
      propertiesCount: user.properties_count,
      paymentStatus: user.payment_status,
      onboardingStep: user.onboarding_step,
      onboardingComplete: user.onboarding_complete,
      actionHistory: user.action_history || [],
    };
  }

  /**
   * Suspend a user account
   */
  async suspendUser(userId: string, reason?: string): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('suspend_user', {
      p_member_id: userId,
      p_reason: reason,
    });

    if (error) {
      throw new Error(`Failed to suspend user: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Reactivate a suspended user account
   */
  async reactivateUser(userId: string): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('reactivate_user', {
      p_member_id: userId,
    });

    if (error) {
      throw new Error(`Failed to reactivate user: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Reset user onboarding status
   */
  async resetOnboarding(userId: string): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('reset_user_onboarding', {
      p_member_id: userId,
    });

    if (error) {
      throw new Error(`Failed to reset onboarding: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Force user logout
   */
  async forceLogout(userId: string, reason?: string): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('force_user_logout', {
      p_member_id: userId,
      p_reason: reason,
    });

    if (error) {
      throw new Error(`Failed to force logout: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: UserRole): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('update_user_role', {
      p_member_id: userId,
      p_new_role: role,
    });

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Soft delete user account
   */
  async softDeleteUser(userId: string, reason?: string): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('soft_delete_user', {
      p_member_id: userId,
      p_reason: reason,
    });

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Check if current user has force logout flag
   */
  async checkForceLogout(): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_force_logout');

    if (error) {
      console.error('Failed to check force logout:', error);
      return false;
    }

    return data || false;
  }

  /**
   * Acknowledge force logout (clear the flag)
   */
  async acknowledgeForceLogout(): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('acknowledge_force_logout');

    if (error) {
      throw new Error(`Failed to acknowledge force logout: ${error.message}`);
    }

    return data as ActionResult;
  }
}

const userAdminService = new UserAdminService();
export default userAdminService;
