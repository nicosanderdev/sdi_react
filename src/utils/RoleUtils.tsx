import { Roles } from '../models/Roles';
import { ProfileData } from '../services/ProfileService';

interface AuthUser {
  id: string;
  userName: string;
  email: string;
  isEmailConfirmed: boolean;
  isAuthenticated: boolean;
  is2FAEnabled: boolean;
  role: string;
}

// Union type to handle both ProfileData and AuthUser
export type UserData = ProfileData | AuthUser | null;

export type UserRole = typeof Roles[keyof typeof Roles];

/**
 * Checks if the user has a specific role (case-insensitive for robustness).
 */
export const hasRole = (user: UserData, role: UserRole): boolean => {
  if (!user) return false;
  const r = (user as { role?: string; roles?: string[] }).role ?? (user as { role?: string; roles?: string[] }).roles?.[0];
  if (r == null || r === '') return false;
  const normalizedRole = role.toLowerCase();
  return String(r).toLowerCase() === normalizedRole;
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
  return hasRole(user, Roles.User);
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
  if (!user) return null;
  const r = (user as { role?: string; roles?: string[] }).role ?? (user as { role?: string; roles?: string[] }).roles?.[0];
  if (r == null || r === '') return null;
  const normalized = String(r).toLowerCase();
  if (normalized === Roles.Admin) return Roles.Admin;
  if (normalized === Roles.User) return Roles.User;
  return null;
};

/**
 * Gets the appropriate redirect path based on user role
 */
export const getRedirectPath = (user: UserData): string => {
  if (!user) return '/login';

  // Admin users should go to admin dashboard
  if (isAdmin(user)) {
    return '/dashboard/admin/dashboard';
  }

  // Regular users go to standard dashboard
  return '/dashboard';
};