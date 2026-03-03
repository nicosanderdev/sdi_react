import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { isAdmin } from '../../utils/RoleUtils';

interface AdminRedirectWrapperProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that redirects admin users away from non-admin pages
 * Admin users are redirected to /dashboard/admin/dashboard
 */
export const AdminRedirectWrapper: React.FC<AdminRedirectWrapperProps> = ({ children }) => {
  const user = useSelector((state: RootState) => state.user.profile);

  // If user is admin, redirect to admin dashboard
  if (user && isAdmin(user)) {
    return <Navigate to="/dashboard/admin/dashboard" replace />;
  }

  // Otherwise, render the children (non-admin content)
  return <>{children}</>;
};
