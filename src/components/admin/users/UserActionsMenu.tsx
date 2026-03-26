// src/components/admin/users/UserActionsMenu.tsx
import React, { useState } from 'react';
import { Button, Dropdown, DropdownDivider, DropdownItem } from 'flowbite-react';
import { MoreHorizontalIcon, Loader2Icon, FileTextIcon } from 'lucide-react';
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
    forceLogout
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

  return (
    <Dropdown
      label=""
      renderTrigger={() => (
        <Button size="xs" color="light" className="p-2" disabled={loading} title="Más acciones">
          {loading ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            <MoreHorizontalIcon className="w-4 h-4" />
          )}
        </Button>
      )}
    >
      {user.accountStatus === 'active' ? (
        <DropdownItem onClick={handleSuspend}>
          Suspender usuario
        </DropdownItem>
      ) : (
        <DropdownItem onClick={handleReactivate}>
          Reactivar usuario
        </DropdownItem>
      )}
      <DropdownItem onClick={handleResetOnboarding}>
        Reiniciar onboarding
      </DropdownItem>
      <DropdownItem onClick={handleForceLogout}>
        Cerrar sesión forzada
      </DropdownItem>
    </Dropdown>
  );
};
