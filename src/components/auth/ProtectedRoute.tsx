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
  const [sessionPendingContext, setSessionPendingContext] = useState(false);
  const [sessionCheckDone, setSessionCheckDone] = useState(false);
  const [noSessionFound, setNoSessionFound] = useState(false);

  // When we would redirect to login, check getSession first so we don't redirect if session exists but context not updated yet
  useEffect(() => {
    if (!requireAuth || supabaseUser || authLoading) {
      setSessionCheckDone(false);
      setSessionPendingContext(false);
      setNoSessionFound(false);
      return;
    }
    setSessionCheckDone(false);
    setNoSessionFound(false);
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setSessionCheckDone(true);
      if (session?.user) {
        setSessionPendingContext(true);
        setNoSessionFound(false);
      } else {
        setNoSessionFound(true);
        setSessionPendingContext(false);
      }
    });
    return () => { cancelled = true; };
  }, [requireAuth, supabaseUser, authLoading]);

  // Show loading only while auth state is being determined, not while profile is loading.
  // When we have a session, render children and let the dashboard handle profile loading/null.
  if (authLoading) {
    return <LoadingSpinner />;
  }

  // Check Supabase session first; if session exists but context not updated yet, show loading instead of redirect
  if (requireAuth && !supabaseUser) {
    if (sessionPendingContext) return <LoadingSpinner />;
    // Only redirect once we've confirmed there is no session (avoids redirecting right after login before context updates)
    if (sessionCheckDone && noSessionFound) return <Navigate to="/login" replace />;
    return <LoadingSpinner />;
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