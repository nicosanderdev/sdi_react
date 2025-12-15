// src/components/admin/users/UserActionsMenu.tsx
import React, { useState } from 'react';
import { Button, Dropdown } from 'flowbite-react';
import { MoreHorizontalIcon, Loader2Icon } from 'lucide-react';
import { UserListItem } from '../../../services/UserAdminService';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UserActionsMenuProps {
  user: UserListItem;
  hook: UseAdminUsersReturn;
}

export const UserActionsMenu: React.FC<UserActionsMenuProps> = ({ user, hook }) => {
  const [loading, setLoading] = useState(false);

  const {
    suspendUser,
    reactivateUser,
    resetOnboarding,
    forceLogout,
    openDeleteConfirmModal,
  } = hook;

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = () => handleAction(() => suspendUser(user.id, 'Suspended by admin'));
  const handleReactivate = () => handleAction(() => reactivateUser(user.id));
  const handleResetOnboarding = () => handleAction(() => resetOnboarding(user.id));
  const handleForceLogout = () => handleAction(() => forceLogout(user.id, 'Forced logout by admin'));
  const handleDelete = () => openDeleteConfirmModal(user);

  return (
    <Dropdown
      label=""
      renderTrigger={() => (
        <Button size="sm" color="light" className="p-2" disabled={loading}>
          {loading ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            <MoreHorizontalIcon className="w-4 h-4" />
          )}
        </Button>
      )}
    >
      {/* View Details - This would typically open the detail modal */}
      {/* The view action is handled in the table component */}

      {/* Account Status Actions */}
      {user.accountStatus === 'active' ? (
        <Dropdown.Item onClick={handleSuspend}>
          Suspend User
        </Dropdown.Item>
      ) : (
        <Dropdown.Item onClick={handleReactivate}>
          Reactivate User
        </Dropdown.Item>
      )}

      {/* Onboarding Actions */}
      <Dropdown.Item onClick={handleResetOnboarding}>
        Reset Onboarding
      </Dropdown.Item>

      {/* Force Logout */}
      <Dropdown.Item onClick={handleForceLogout}>
        Force Logout
      </Dropdown.Item>

      {/* Delete User */}
      <Dropdown.Divider />
      <Dropdown.Item onClick={handleDelete} className="text-red-600 hover:text-red-700">
        Delete User
      </Dropdown.Item>
    </Dropdown>
  );
};
