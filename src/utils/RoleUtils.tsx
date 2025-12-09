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
 * Checks if the user is an admin
 */
export const isAdmin = (user: UserData): boolean => {
  return hasRole(user, Roles.Admin);
};

/**
 * Checks if the user is a regular user (not admin)
 */
export const isUser = (user: UserData): boolean => {
  return hasRole(user, Roles.User) || (!isAdmin(user) && hasRole(user, Roles.User));
};

/**
 * Checks if the user has elevated privileges (admin)
 */
export const hasElevatedAccess = (user: UserData): boolean => {
  return isAdmin(user);
};

/**
 * Gets the primary role of the user
 */
export const getPrimaryRole = (user: UserData): UserRole | null => {
  if (!user || !user.roles || user.roles.length === 0) return null;

  if (hasRole(user, Roles.Admin)) return Roles.Admin;
  if (hasRole(user, Roles.User)) return Roles.User;

  return null;
};

/**
 * Gets the appropriate redirect path based on user role
 */
export const getRedirectPath = (user: UserData): string => {
  if (!user) return '/login';

  // All authenticated users (admin or user) can access dashboard
  return '/dashboard';
};