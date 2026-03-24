// src/components/admin/users/UserManagementTable.tsx
import React from 'react';
import { Button, Table, Badge, Avatar, TableHead, TableHeadCell, TableBody, TableCell, TableRow } from 'flowbite-react';
import { ChevronUpIcon, ChevronDownIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { UserListItem, SubscriptionTier } from '../../../services/UserAdminService';
import { UseAdminUsersReturn, SortField } from '../../../hooks/useAdminUsers';
import { UserActionsMenu } from './UserActionsMenu';

interface UserManagementTableProps {
  hook: UseAdminUsersReturn;
}

const getSubscriptionTierLabel = (tier: number | null): string => {
  switch (tier) {
    case SubscriptionTier.Free: return 'Gratis';
    case SubscriptionTier.Manager: return 'Manager';
    case SubscriptionTier.CompanySmall: return 'Empresa pequeña';
    case SubscriptionTier.CompanyUnlimited: return 'Empresa ilimitada';
    case SubscriptionTier.ManagerPro: return 'Manager Pro';
    default: return 'Ninguno';
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'suspended': return 'warning';
    case 'deleted': return 'failure';
    default: return 'gray';
  }
};

const getSubscriptionStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'expired': return 'warning';
    case 'none': return 'gray';
    default: return 'gray';
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Nunca';
  return new Date(dateString).toLocaleDateString();
};

const getFullName = (user: UserListItem): string => {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  return `${firstName} ${lastName}`.trim() || 'Usuario desconocido';
};

export const UserManagementTable: React.FC<UserManagementTableProps> = ({ hook }) => {
  const {
    users,
    loading,
    sortConfig,
    setSorting,
    openUserView,
    openUserEdit,
    openDeleteConfirmModal,
  } = hook;

  const handleSort = (field: SortField) => {
    setSorting(field);
  };

  const SortableHeader: React.FC<{
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }> = ({ field, children, className = '' }) => (
    <TableHeadCell
      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortConfig.field === field && (
          sortConfig.direction === 'asc' ?
            <ChevronUpIcon className="w-4 h-4" /> :
            <ChevronDownIcon className="w-4 h-4" />
        )}
      </div>
    </TableHeadCell>
  );

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2Icon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No se encontraron usuarios con los filtros actuales.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table hoverable>
        <TableHead>
          <TableHeadCell className="w-16">Avatar</TableHeadCell>
          <SortableHeader field="name">Nombre</SortableHeader>
          <SortableHeader field="email">Correo</SortableHeader>
          <SortableHeader field="role">Rol</SortableHeader>
          <SortableHeader field="status">Estado</SortableHeader>
          <SortableHeader field="subscription">Suscripción</SortableHeader>
          <SortableHeader field="registrationDate">Registrado</SortableHeader>
          <SortableHeader field="lastLogin">Último acceso</SortableHeader>
          <TableHeadCell className="min-w-[280px]">Acciones</TableHeadCell>
        </TableHead>
        <TableBody className="divide-y">
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <TableCell>
                <Avatar
                  img={user.avatarUrl || undefined}
                  placeholderInitials={getFullName(user).split(' ').map(n => n[0]).join('').toUpperCase()}
                  rounded
                  size="sm"
                />
              </TableCell>

              <TableCell className="font-medium text-gray-900 dark:text-white">
                {getFullName(user)}
              </TableCell>

              <TableCell className="text-gray-600 dark:text-gray-300">
                {user.email}
              </TableCell>

              <TableCell>
                <Badge
                  color={user.role === 'admin' ? 'purple' : 'gray'}
                  size="sm"
                >
                  {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                </Badge>
              </TableCell>

              <TableCell>
                <Badge
                  color={getStatusBadgeColor(user.accountStatus)}
                  size="sm"
                >
                  {user.accountStatus === 'active' ? 'Activo' : user.accountStatus === 'suspended' ? 'Suspendido' : user.accountStatus === 'deleted' ? 'Eliminado' : user.accountStatus}
                </Badge>
              </TableCell>

              <TableCell>
                <div className="space-y-1">
                  <Badge
                    color={getSubscriptionStatusBadgeColor(user.subscriptionStatus)}
                    size="sm"
                  >
                    {user.subscriptionStatus === 'active' ? 'Activo' : user.subscriptionStatus === 'expired' ? 'Expirado' : user.subscriptionStatus === 'none' ? 'Ninguna' : user.subscriptionStatus}
                  </Badge>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {getSubscriptionTierLabel(user.subscriptionTier)}
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-gray-600 dark:text-gray-300">
                {formatDate(user.registrationDate)}
              </TableCell>

              <TableCell className="text-gray-600 dark:text-gray-300">
                {formatDate(user.lastLogin)}
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    size="xs"
                    color="light"
                    onClick={() => openUserView(user.id)}
                  >
                    Ver
                  </Button>
                  <Button
                    size="xs"
                    color="light"
                    onClick={() => openUserEdit(user.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    outline
                    onClick={() => openDeleteConfirmModal(user)}
                  >
                    <Trash2Icon className="w-4 h-4" />
                  </Button>
                  <UserActionsMenu user={user} hook={hook} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
