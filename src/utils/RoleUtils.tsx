import { Roles } from '../models/Roles';
import { ProfileData } from '../services/ProfileService';

interface AuthUser {
  id: string;
  userName: string;
  email: string;
  isEmailConfirmed: boolean;
  isAuthenticated: boolean;
  is2FAEnabled: boolean;
  roles: string[];
}

// Union type to handle both ProfileData and AuthUser
export type UserData = ProfileData | AuthUser | null;

export type UserRole = typeof Roles[keyof typeof Roles];

/**
 * Checks if the user has a specific role
 */
export const hasRole = (user: UserData, role: UserRole): boolean => {
    if (!user || !user.roles) return false;
  return user.roles.includes(role);
};

/**
 * Checks if the user is a manager or admin
 */
export const isManager = (user: UserData): boolean => {
  return hasRole(user, Roles.Manager) || hasRole(user, Roles.Admin);
};

/**
 * Checks if the user is a public user (not manager or admin)
 */
export const isPublicUser = (user: UserData): boolean => {
  return !isManager(user);
};

/**
 * Gets the primary role of the user
 */
export const getPrimaryRole = (user: UserData): UserRole | null => {
  if (!user || !user.roles || user.roles.length === 0) return null;
  
  if (hasRole(user, Roles.Admin)) return Roles.Admin;
  if (hasRole(user, Roles.Manager)) return Roles.Manager;
  if (hasRole(user, Roles.PublicUser)) return Roles.PublicUser;
  
  return null;
};

/**
 * Gets the appropriate redirect path based on user role
 */
export const getRedirectPath = (user: UserData): string => {
  if (!user) return '/login';

  if (isManager(user)) {
    return '/dashboard';
  } else {
    // Dashboard-only system: redirect non-managers to login
    return '/login';
  }
};