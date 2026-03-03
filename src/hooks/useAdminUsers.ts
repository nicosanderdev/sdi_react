// src/hooks/useAdminUsers.ts
import { useState, useEffect, useCallback } from 'react';
import userAdminService, {
  UserListItem,
  UserDetail,
  UserFilters,
  UserListResponse,
  ActionResult,
  UserRole,
} from '../services/UserAdminService';

// Sorting options
export type SortField = 'name' | 'email' | 'role' | 'status' | 'subscription' | 'registrationDate' | 'lastLogin';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface UseAdminUsersReturn {
  // Data
  users: UserListItem[];
  selectedUser: UserDetail | null;
  totalUsers: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;

  // Loading states
  loading: boolean;
  userDetailLoading: boolean;
  actionLoading: boolean;

  // Errors
  error: string | null;
  userDetailError: string | null;
  actionError: string | null;

  // Filters and sorting
  filters: UserFilters;
  sortConfig: SortConfig;

  // Modal states
  detailModalOpen: boolean;
  deleteConfirmModalOpen: boolean;
  userToDelete: UserListItem | null;

  // Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  updateFilters: (newFilters: Partial<UserFilters>) => void;
  clearFilters: () => void;
  setSorting: (field: SortField, direction?: SortDirection) => void;
  fetchUsers: () => Promise<void>;
  fetchUserDetail: (userId: string) => Promise<void>;
  closeDetailModal: () => void;

  // User actions
  suspendUser: (userId: string, reason?: string) => Promise<void>;
  reactivateUser: (userId: string) => Promise<void>;
  resetOnboarding: (userId: string) => Promise<void>;
  forceLogout: (userId: string, reason?: string) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  softDeleteUser: (userId: string, reason?: string) => Promise<void>;

  // Modal actions
  openDeleteConfirmModal: (user: UserListItem) => void;
  closeDeleteConfirmModal: () => void;
  confirmDeleteUser: (reason?: string) => Promise<void>;
}

const defaultFilters: UserFilters = {
  page: 1,
  limit: 20,
};

const defaultSortConfig: SortConfig = {
  field: 'registrationDate',
  direction: 'desc',
};

export const useAdminUsers = (): UseAdminUsersReturn => {
  // Data state
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [userDetailError, setUserDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters and sorting
  const [filters, setFilters] = useState<UserFilters>(defaultFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSortConfig);

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserListItem | null>(null);

  // Computed values
  const totalPages = Math.ceil(totalUsers / pageSize);

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response: UserListResponse = await userAdminService.getUsersList({
        ...filters,
        page: currentPage,
        limit: pageSize,
      });

      setUsers(response.users);
      setTotalUsers(response.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize]);

  // Fetch user detail
  const fetchUserDetail = useCallback(async (userId: string) => {
    setUserDetailLoading(true);
    setUserDetailError(null);

    try {
      const userDetail = await userAdminService.getUserDetail(userId);
      setSelectedUser(userDetail);
      setDetailModalOpen(true);
    } catch (err: any) {
      setUserDetailError(err.message || 'Failed to fetch user details');
    } finally {
      setUserDetailLoading(false);
    }
  }, []);

  // Close detail modal
  const closeDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedUser(null);
    setUserDetailError(null);
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 })); // Reset to first page when filtering
    setCurrentPage(1);
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  }, []);

  // Set sorting
  const setSorting = useCallback((field: SortField, direction?: SortDirection) => {
    setSortConfig(prev => ({
      field,
      direction: direction || (prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'),
    }));
  }, []);

  // Set page
  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Set page size
  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  }, []);

  // Modal actions (defined before handleAction to avoid temporal dead zone)
  const closeDeleteConfirmModal = useCallback(() => {
    setDeleteConfirmModalOpen(false);
    setUserToDelete(null);
    setActionError(null);
  }, []);

  // Generic action handler
  const handleAction = useCallback(async (
    action: () => Promise<ActionResult>,
    successMessage: string,
    errorMessage: string
  ) => {
    setActionLoading(true);
    setActionError(null);

    try {
      const result = await action();
      if (result.success) {
        // Refresh users list
        await fetchUsers();
        // Close modals if needed
        if (deleteConfirmModalOpen) {
          closeDeleteConfirmModal();
        }
      } else {
        setActionError(result.message || errorMessage);
      }
    } catch (err: any) {
      setActionError(err.message || errorMessage);
    } finally {
      setActionLoading(false);
    }
  }, [fetchUsers, deleteConfirmModalOpen, closeDeleteConfirmModal]);

  // User actions
  const suspendUser = useCallback((userId: string, reason?: string) =>
    handleAction(
      () => userAdminService.suspendUser(userId, reason),
      'User suspended successfully',
      'Failed to suspend user'
    ), [handleAction]);

  const reactivateUser = useCallback((userId: string) =>
    handleAction(
      () => userAdminService.reactivateUser(userId),
      'User reactivated successfully',
      'Failed to reactivate user'
    ), [handleAction]);

  const resetOnboarding = useCallback((userId: string) =>
    handleAction(
      () => userAdminService.resetOnboarding(userId),
      'User onboarding reset successfully',
      'Failed to reset onboarding'
    ), [handleAction]);

  const forceLogout = useCallback((userId: string, reason?: string) =>
    handleAction(
      () => userAdminService.forceLogout(userId, reason),
      'Force logout initiated successfully',
      'Failed to force logout'
    ), [handleAction]);

  const updateUserRole = useCallback((userId: string, role: UserRole) =>
    handleAction(
      () => userAdminService.updateUserRole(userId, role),
      'User role updated successfully',
      'Failed to update user role'
    ), [handleAction]);

  const softDeleteUser = useCallback((userId: string, reason?: string) =>
    handleAction(
      () => userAdminService.softDeleteUser(userId, reason),
      'User deleted successfully',
      'Failed to delete user'
    ), [handleAction]);

  // Modal actions
  const openDeleteConfirmModal = useCallback((user: UserListItem) => {
    setUserToDelete(user);
    setDeleteConfirmModalOpen(true);
  }, []);

  const confirmDeleteUser = useCallback((reason?: string) => {
    if (!userToDelete) return Promise.resolve();
    return softDeleteUser(userToDelete.id, reason);
  }, [userToDelete, softDeleteUser]);

  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    // Data
    users,
    selectedUser,
    totalUsers,
    currentPage,
    pageSize,
    totalPages,

    // Loading states
    loading,
    userDetailLoading,
    actionLoading,

    // Errors
    error,
    userDetailError,
    actionError,

    // Filters and sorting
    filters,
    sortConfig,

    // Modal states
    detailModalOpen,
    deleteConfirmModalOpen,
    userToDelete,

    // Actions
    setPage,
    setPageSize: handleSetPageSize,
    updateFilters,
    clearFilters,
    setSorting,
    fetchUsers,
    fetchUserDetail,
    closeDetailModal,

    // User actions
    suspendUser,
    reactivateUser,
    resetOnboarding,
    forceLogout,
    updateUserRole,
    softDeleteUser,

    // Modal actions
    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    confirmDeleteUser,
  };
};
