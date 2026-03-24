// src/pages/dashboard/admin/UserManagementPage.tsx
import React from 'react';
import { Button, Card } from 'flowbite-react';
import { RefreshCwIcon } from 'lucide-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminUsers } from '../../../hooks/useAdminUsers';
import { UserFilters } from '../../../components/admin/users/UserFilters';
import { UserManagementTable } from '../../../components/admin/users/UserManagementTable';
import { UserDetailModal } from '../../../components/admin/users/UserDetailModal';
import { UserViewModal } from '../../../components/admin/users/UserViewModal';
import { UserEditModal } from '../../../components/admin/users/UserEditModal';
import { DeleteUserConfirmModal } from '../../../components/admin/users/DeleteUserConfirmModal';
import { UserStatistics } from '../../../components/admin/users/UserStatistics';

const UserManagementPage: React.FC = () => {
  const hook = useAdminUsers();

  const {
    users,
    totalUsers,
    currentPage,
    pageSize,
    totalPages,
    loading,
    error,
    actionError,
    fetchUsers,
  } = hook;

  const handleRefresh = () => {
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <DashboardPageTitle
          title="Administración de usuarios"
          subtitle="Gestiona los usuarios de la plataforma, roles y estado de la cuenta"
        />

        <Button
          color="light"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center space-x-2"
        >
          <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
          </div>
        </Card>
      )}

      {actionError && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="text-amber-900 dark:text-amber-100">
            <strong>Acción:</strong> {actionError}
          </div>
        </Card>
      )}

      {/* Statistics */}
      <UserStatistics hook={hook} />

      {/* Filters */}
      <UserFilters hook={hook} />

      {/* Results Summary */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total de usuarios</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalUsers.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Mostrando</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {users.length} de {totalUsers}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Página {currentPage} de {totalPages}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pageSize} por página
            </p>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <UserManagementTable hook={hook} />
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Página {currentPage} de {totalPages}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                color="light"
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => hook.setPage(currentPage - 1)}
              >
                Anterior
              </Button>

              {/* Page numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      color={pageNum === currentPage ? 'blue' : 'light'}
                      size="sm"
                      disabled={loading}
                      onClick={() => hook.setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                color="light"
                size="sm"
                disabled={currentPage === totalPages || loading}
                onClick={() => hook.setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Modals */}
      <UserViewModal hook={hook} />
      <UserEditModal hook={hook} />
      <UserDetailModal hook={hook} />
      <DeleteUserConfirmModal hook={hook} />
    </div>
  );
};

export default UserManagementPage;
