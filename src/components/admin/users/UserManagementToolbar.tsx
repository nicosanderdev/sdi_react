// src/components/admin/users/UserManagementToolbar.tsx
import React from 'react';
import { Button } from 'flowbite-react';
import { EyeIcon, Edit2Icon, TrashIcon } from 'lucide-react';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';
import { UserActionsMenu } from './UserActionsMenu';

interface UserManagementToolbarProps {
  hook: UseAdminUsersReturn;
}

export const UserManagementToolbar: React.FC<UserManagementToolbarProps> = ({ hook }) => {
  const {
    selectedUserIds,
    primarySelectedUser,
    openUserView,
    openUserEdit,
    openDeleteConfirmModal,
  } = hook;

  const singleSelection = selectedUserIds.length === 1;
  const selectedId = primarySelectedUser?.id ?? null;

  const disabled = !singleSelection || !primarySelectedUser;

  const handleView = () => {
    if (!selectedId) return;
    void openUserView(selectedId);
  };

  const handleEdit = () => {
    if (!selectedId) return;
    void openUserEdit(selectedId);
  };

  const handleDelete = () => {
    if (!primarySelectedUser) return;
    openDeleteConfirmModal(primarySelectedUser);
  };

  return (
    <div
      className="flex flex-col gap-2 border-b border-gray-200 dark:border-gray-700 pb-3 mb-3"
      data-testid="admin-users-toolbar"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleView}
          className="flex items-center gap-2"
        >
          <EyeIcon className="w-4 h-4 shrink-0" />
          <span>Ver</span>
        </Button>
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleEdit}
          className="flex items-center gap-2"
        >
          <Edit2Icon className="w-4 h-4 shrink-0" />
          <span>Editar</span>
        </Button>
        <UserActionsMenu user={primarySelectedUser} hook={hook} />
        <Button
          size="sm"
          color="light"
          disabled={disabled}
          onClick={handleDelete}
          className="flex items-center gap-2 text-red-700 dark:text-red-400"
        >
          <TrashIcon className="w-4 h-4 shrink-0" />
          <span>Eliminar</span>
        </Button>
      </div>
      {selectedUserIds.length > 1 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Seleccione una sola fila para usar estas acciones.
        </p>
      )}
    </div>
  );
};
