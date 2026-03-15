import React, { memo, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { getPrimaryRole, getRedirectPath } from '../../utils/RoleUtils';
import { Roles } from '../../models/Roles';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';

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
  const [sessionPendingContext, setSessionPendingContext] = useState(false);

  // When we would redirect to login but session might exist (context not updated yet), check getSession once
  useEffect(() => {
    if (!requireAuth || supabaseUser || authLoading) {
      setSessionPendingContext(false);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session?.user) setSessionPendingContext(true);
    });
    return () => { cancelled = true; };
  }, [requireAuth, supabaseUser, authLoading]);

  // Show loading if auth is loading; for protected routes only, wait for profile when loading/idle (not when 'failed')
  // When userStatus === 'failed' we allow render so dashboard shell can show; children handle null profile.
  if (authLoading || (requireAuth && supabaseUser && (userStatus === 'loading' || userStatus === 'idle'))) {
    return <LoadingSpinner />;
  }

  // Check Supabase session first; if session exists but context not updated yet, show loading instead of redirect
  if (requireAuth && !supabaseUser) {
    if (sessionPendingContext) return <LoadingSpinner />;
    return <Navigate to="/login" replace />;
  }

  // If we have a Supabase user but no profile loaded yet, let it pass through
  // The profile will be loaded by the AuthContext
  if (supabaseUser && user) {
    const userRole = user.role ?? getPrimaryRole(user) ?? Roles.User;

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