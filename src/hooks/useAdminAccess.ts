import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, getRedirectPath } from '../utils/RoleUtils';

interface UseAdminAccessReturn {
  isLoading: boolean;
  hasAccess: boolean;
  redirectPath: string | null;
  user: any;
}

/**
 * Hook to check if the current user has admin access
 * Returns loading state, access status, and redirect path for non-admins
 */
export const useAdminAccess = (): UseAdminAccessReturn => {
  const { user: supabaseUser, loading: authLoading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const userStatus = useSelector((state: RootState) => state.user.status);

  const isLoading = authLoading || userStatus === 'loading' || userStatus === 'idle';
  const hasAccess = !isLoading && supabaseUser && user && isAdmin(user);
  const redirectPath = !hasAccess && !isLoading ? getRedirectPath(user) : null;

  return {
    isLoading,
    hasAccess,
    redirectPath,
    user
  };
};
