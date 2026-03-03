import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAccess } from '../../hooks/useAdminAccess';

interface AccessGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirect?: boolean;
}

/**
 * AccessGuard component that protects content requiring admin access
 * Shows loading state, handles access denial, and renders children when access granted
 */
const AccessGuard: React.FC<AccessGuardProps> = ({
  children,
  fallback,
  redirect = true
}) => {
  const { isLoading, hasAccess, redirectPath } = useAdminAccess();

  // Show loading spinner while checking access
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#1B4965]"></div>
      </div>
    );
  }

  // Redirect to appropriate path if no access and redirect is enabled
  if (!hasAccess && redirect && redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // Show fallback content if no access and redirect is disabled
  if (!hasAccess && !redirect && fallback) {
    return <>{fallback}</>;
  }

  // Show access denied message if no access and no fallback
  if (!hasAccess && !redirect && !fallback) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-md p-6 max-w-md mx-auto">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Access Denied
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>You don't have permission to access this page. This feature requires global admin privileges.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render children if access is granted
  return <>{children}</>;
};

export default AccessGuard;
