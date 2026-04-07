import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { isAdmin } from '../../utils/RoleUtils';

interface UserDashboardFeatureGuardProps {
  children: React.ReactNode;
  blockedForUsers?: Array<'messages' | 'reports'>;
  redirectTo?: string;
}

export const UserDashboardFeatureGuard: React.FC<UserDashboardFeatureGuardProps> = ({
  children,
  blockedForUsers = [],
  redirectTo = '/dashboard',
}) => {
  const user = useSelector((state: RootState) => state.user.profile);

  // Global admins keep full dashboard feature access.
  if (user && isAdmin(user)) {
    return <>{children}</>;
  }

  if (blockedForUsers.length > 0) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
