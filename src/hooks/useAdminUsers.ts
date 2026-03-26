// src/hooks/useAdminUsers.ts
import { useState, useEffect, useCallback } from 'react';
import userAdminService, {
  UserListItem,
  UserDetail,
  UserFilters,
  UserListResponse,
  ActionResult,
  UserRole,
  AdminUserDeletable,
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
  viewUserLoading: boolean;
  editUserLoading: boolean;
  editSubmitting: boolean;

  // Errors
  error: string | null;
  userDetailError: string | null;
  actionError: string | null;
  viewModalError: string | null;
  editModalError: string | null;

  // Filters and sorting
  filters: UserFilters;
  sortConfig: SortConfig;

  // Modal states
  detailModalOpen: boolean;
  deleteConfirmModalOpen: boolean;
  userToDelete: AdminUserDeletable | null;
  viewModalOpen: boolean;
  viewUser: UserDetail | null;
  editModalOpen: boolean;
  editUser: UserDetail | null;
  editFieldErrors: { email?: string; phone?: string };

  // Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  updateFilters: (newFilters: Partial<UserFilters>) => void;
  clearFilters: () => void;
  setSorting: (field: SortField, direction?: SortDirection) => void;
  fetchUsers: () => Promise<void>;
  fetchUserDetail: (userId: string) => Promise<void>;
  closeDetailModal: () => void;

  openUserView: (memberId: string) => Promise<void>;
  closeViewModal: () => void;
  openUserEdit: (memberId: string) => Promise<void>;
  closeEditModal: () => void;
  submitUserEdit: (values: { firstName: string; lastName: string; email: string; phone: string }) => Promise<void>;

  // User actions
  suspendUser: (userId: string, reason?: string) => Promise<void>;
  reactivateUser: (userId: string) => Promise<void>;
  resetOnboarding: (userId: string) => Promise<void>;
  forceLogout: (userId: string, reason?: string) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  softDeleteUser: (userId: string, reason?: string) => Promise<void>;

  // Modal actions
  openDeleteConfirmModal: (user: AdminUserDeletable) => void;
  closeDeleteConfirmModal: (options?: { preserveActionError?: boolean }) => void;
  confirmDeleteUser: (reason?: string) => Promise<void>;
}

const defaultFilters: UserFilters = {
  page: 1,
  limit: 10,
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
  const [pageSize, setPageSize] = useState(10);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewUserLoading, setViewUserLoading] = useState(false);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [userDetailError, setUserDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewModalError, setViewModalError] = useState<string | null>(null);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Filters and sorting
  const [filters, setFilters] = useState<UserFilters>(defaultFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSortConfig);

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUserDeletable | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState<UserDetail | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDetail | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<{ email?: string; phone?: string }>({});

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

  // Fetch user detail (full admin modal)
  const fetchUserDetail = useCallback(async (userId: string) => {
    setUserDetailLoading(true);
    setUserDetailError(null);

    try {
      const userDetail = await userAdminService.getUserDetail(userId);
      if (!userDetail) {
        setUserDetailError('Usuario no encontrado');
        return;
      }
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

  const closeViewModal = useCallback(() => {
    setViewModalOpen(false);
    setViewUser(null);
    setViewModalError(null);
    setViewUserLoading(false);
  }, []);

  const openUserView = useCallback(async (memberId: string) => {
    setViewModalOpen(true);
    setViewUser(null);
    setViewModalError(null);
    setViewUserLoading(true);
    try {
      const d = await userAdminService.getUserDetail(memberId);
      if (!d) {
        setViewModalError('Usuario no encontrado');
        return;
      }
      setViewUser(d);
    } catch (err: any) {
      setViewModalError(err.message || 'No se pudieron cargar los datos');
    } finally {
      setViewUserLoading(false);
    }
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditUser(null);
    setEditModalError(null);
    setEditFieldErrors({});
    setEditUserLoading(false);
  }, []);

  const openUserEdit = useCallback(async (memberId: string) => {
    setEditModalOpen(true);
    setEditUser(null);
    setEditModalError(null);
    setEditFieldErrors({});
    setEditUserLoading(true);
    try {
      const d = await userAdminService.getUserDetail(memberId);
      if (!d) {
        setEditModalError('Usuario no encontrado');
        return;
      }
      setEditUser(d);
    } catch (err: any) {
      setEditModalError(err.message || 'No se pudieron cargar los datos');
    } finally {
      setEditUserLoading(false);
    }
  }, []);

  const submitUserEdit = useCallback(
    async (values: { firstName: string; lastName: string; email: string; phone: string }) => {
      if (!editUser) return;
      setEditSubmitting(true);
      setEditFieldErrors({});
      setEditModalError(null);
      try {
        const result = await userAdminService.updateAdminUserProfile({
          memberId: editUser.id,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email.trim(),
          phone: values.phone.trim(),
        });
        if (!result.success) {
          setEditFieldErrors(result.fieldErrors || {});
          setEditModalError(result.message || 'No se pudo guardar');
          return;
        }
        await fetchUsers();
        closeEditModal();
      } catch (err: any) {
        setEditModalError(err.message || 'Error de red');
      } finally {
        setEditSubmitting(false);
      }
    },
    [editUser, fetchUsers, closeEditModal],
  );

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
  const closeDeleteConfirmModal = useCallback((options?: { preserveActionError?: boolean }) => {
    setDeleteConfirmModalOpen(false);
    setUserToDelete(null);
    if (!options?.preserveActionError) {
      setActionError(null);
    }
  }, []);

  // Generic action handler
  const handleAction = useCallback(
    async (action: () => Promise<ActionResult>, successMessage: string, errorMessage: string) => {
      setActionLoading(true);
      setActionError(null);

      try {
        const result = await action();
        if (result.success) {
          await fetchUsers();
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
    },
    [fetchUsers, deleteConfirmModalOpen, closeDeleteConfirmModal],
  );

  // User actions
  const suspendUser = useCallback(
    (userId: string, reason?: string) =>
      handleAction(
        () => userAdminService.suspendUser(userId, reason),
        'User suspended successfully',
        'Failed to suspend user',
      ),
    [handleAction],
  );

  const reactivateUser = useCallback(
    (userId: string) =>
      handleAction(
        () => userAdminService.reactivateUser(userId),
        'User reactivated successfully',
        'Failed to reactivate user',
      ),
    [handleAction],
  );

  const resetOnboarding = useCallback(
    (userId: string) =>
      handleAction(
        () => userAdminService.resetOnboarding(userId),
        'User onboarding reset successfully',
        'Failed to reset onboarding',
      ),
    [handleAction],
  );

  const forceLogout = useCallback(
    (userId: string, reason?: string) =>
      handleAction(
        () => userAdminService.forceLogout(userId, reason),
        'Force logout initiated successfully',
        'Failed to force logout',
      ),
    [handleAction],
  );

  const updateUserRole = useCallback(
    (userId: string, role: UserRole) =>
      handleAction(
        () => userAdminService.updateUserRole(userId, role),
        'User role updated successfully',
        'Failed to update user role',
      ),
    [handleAction],
  );

  const softDeleteUser = useCallback(
    (userId: string, reason?: string) =>
      handleAction(
        () => userAdminService.softDeleteUser(userId, reason),
        'User deleted successfully',
        'Failed to delete user',
      ),
    [handleAction],
  );

  const openDeleteConfirmModal = useCallback((user: AdminUserDeletable) => {
    setActionError(null);
    setUserToDelete(user);
    setDeleteConfirmModalOpen(true);
  }, []);

  const confirmDeleteUser = useCallback(
    async (reason?: string) => {
      if (!userToDelete) return;
      const snapshot = userToDelete;
      setActionLoading(true);
      setActionError(null);
      try {
        const result = await userAdminService.softDeleteUser(snapshot.id, reason);
        if (!result.success) {
          setActionError(result.message || 'No se pudo eliminar el usuario');
          return;
        }
        setActionError(null);
        await fetchUsers();
        let banFailed = false;
        try {
          const banResult = await userAdminService.banAuthUserAfterSoftDelete(snapshot.userId);
          if (!banResult.success) {
            banFailed = true;
            setActionError(
              `Usuario marcado como eliminado, pero no se pudo bloquear el acceso: ${banResult.message}`,
            );
          }
        } catch (banErr: any) {
          banFailed = true;
          setActionError(
            `Usuario marcado como eliminado, pero no se pudo bloquear el acceso: ${banErr.message || 'Error desconocido'}`,
          );
        }
        closeDeleteConfirmModal({ preserveActionError: banFailed });
      } catch (err: any) {
        setActionError(err.message || 'No se pudo eliminar el usuario');
      } finally {
        setActionLoading(false);
      }
    },
    [userToDelete, fetchUsers, closeDeleteConfirmModal],
  );

  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    selectedUser,
    totalUsers,
    currentPage,
    pageSize,
    totalPages,

    loading,
    userDetailLoading,
    actionLoading,
    viewUserLoading,
    editUserLoading,
    editSubmitting,

    error,
    userDetailError,
    actionError,
    viewModalError,
    editModalError,

    filters,
    sortConfig,

    detailModalOpen,
    deleteConfirmModalOpen,
    userToDelete,
    viewModalOpen,
    viewUser,
    editModalOpen,
    editUser,
    editFieldErrors,

    setPage,
    setPageSize: handleSetPageSize,
    updateFilters,
    clearFilters,
    setSorting,
    fetchUsers,
    fetchUserDetail,
    closeDetailModal,

    openUserView,
    closeViewModal,
    openUserEdit,
    closeEditModal,
    submitUserEdit,

    suspendUser,
    reactivateUser,
    resetOnboarding,
    forceLogout,
    updateUserRole,
    softDeleteUser,

    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    confirmDeleteUser,
  };
};
