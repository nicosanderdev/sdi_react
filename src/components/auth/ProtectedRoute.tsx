import React, { memo } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { getPrimaryRole, getRedirectPath } from '../../utils/RoleUtils';
import { Roles } from '../../models/Roles';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: (Roles.Admin | Roles.User)[];
  requireAuth?: boolean;
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#1B4965]"></div>
  </div>
);

const ProtectedRouteComponent = ({
  children,
  allowedRoles = [Roles.Admin, Roles.User],
  requireAuth = true
}: ProtectedRouteProps) => {
  const { user: supabaseUser, loading: authLoading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const userStatus = useSelector((state: RootState) => state.user.status);

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (requireAuth && !supabaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (supabaseUser && (userStatus === 'idle' || (userStatus === 'loading' && !user))) {
    return <LoadingSpinner />;
  }

  if (supabaseUser && userStatus === 'failed') {
    return <Navigate to="/login" replace />;
  }

  if (supabaseUser && userStatus === 'succeeded') {
    const userRole = getPrimaryRole(user);

    if (!userRole) {
      return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(userRole as typeof Roles.Admin | typeof Roles.User)) {
      return <Navigate to={getRedirectPath(user)} replace />;
    }
  }

  return <>{children}</>;
};

export const ProtectedRoute = memo(ProtectedRouteComponent);

export const PublicRoute = memo(({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireAuth={false}>
    {children}
  </ProtectedRoute>
));

export const AdminOnlyRoute = memo(({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute allowedRoles={[Roles.Admin]}>
    {children}
  </ProtectedRoute>
));
