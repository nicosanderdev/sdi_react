import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { getRedirectPath, isManager } from '../../utils/RoleUtils';
import { Roles } from '../../models/Roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: (Roles.Manager | Roles.PublicUser)[];
  requireAuth?: boolean;
}

export function ProtectedRoute({ 
  children,
  allowedRoles = [Roles.Manager, Roles.PublicUser, Roles.Admin], 
  requireAuth = true 
}: ProtectedRouteProps) {
  const user = useSelector((state: RootState) => state.user.profile);
  const userStatus = useSelector((state: RootState) => state.user.status);

  if (userStatus === 'loading' || userStatus === 'idle') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#1B4965]"></div>
      </div>
    );
  }
  
  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  if (user) {
    const userRole = isManager(user) ? Roles.Manager : Roles.PublicUser;
    
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to={getRedirectPath(user)} replace />;
    }
  }

  return <>{children}</>;
}

export function ManagerOnlyRoute({ children }: { children: React.ReactNode }) {
  
    return (
    <ProtectedRoute allowedRoles={[Roles.Manager]}>
      {children}
    </ProtectedRoute>
  );
}

// COMMENTED OUT: for reuse in new project managing public view - dashboard only system
// export function PublicUserOnlyRoute({ children }: { children: React.ReactNode }) {
//   return (
//     <ProtectedRoute allowedRoles={[Roles.PublicUser]}>
//       {children}
//     </ProtectedRoute>
//   );
// }

export function PublicRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={false}>
      {children}
    </ProtectedRoute>
  );
}

export function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[Roles.Admin]}>
      {children}
    </ProtectedRoute>
  );
}