import React, { memo, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { debugSessionLog } from '../../lib/debugSessionLog';
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
  const location = useLocation();

  useEffect(() => {
    const awaitingInitialProfile = userStatus === 'idle' || (userStatus === 'loading' && !user);
    let branch = 'render-children';
    if (authLoading) branch = 'auth-loading-spinner';
    else if (requireAuth && !supabaseUser) branch = 'redirect-login-no-user';
    else if (supabaseUser && awaitingInitialProfile) branch = 'profile-loading-spinner';
    else if (supabaseUser && userStatus === 'failed') branch = 'redirect-login-profile-failed';
    else if (supabaseUser && userStatus === 'succeeded') {
      const userRole = getPrimaryRole(user);
      if (!userRole) branch = 'redirect-login-no-role';
      else if (!allowedRoles.includes(userRole as typeof Roles.Admin | typeof Roles.User)) branch = 'redirect-role-mismatch';
    } else if (supabaseUser && userStatus === 'loading' && user) {
      branch = 'profile-refetch-keep-children';
    }

    debugSessionLog('ProtectedRoute.tsx:guard', 'route guard evaluated', {
      pathname: location.pathname,
      branch,
      authLoading,
      hasSupabaseUser: Boolean(supabaseUser),
      userStatus,
      hasProfile: Boolean(user),
      allowedRoles,
    }, 'G');
  }, [authLoading, supabaseUser, userStatus, user, location.pathname, requireAuth, allowedRoles]);

  // Show loading only while auth state is being determined, not while profile is loading.
  // When we have a session, render children and let the dashboard handle profile loading/null.
  if (authLoading) {
    return <LoadingSpinner />;
  }

  // If route requires auth and we don't have a Supabase user, redirect to login
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