// src/components/admin/users/UserActionsMenu.tsx
import React from 'react';
import { Button } from 'flowbite-react';
import { UserMinusIcon, UserCheckIcon, RotateCcwIcon, LogOutIcon } from 'lucide-react';
import { UserListItem } from '../../../services/UserAdminService';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UserActionsMenuProps {
  user: UserListItem | null;
  hook: UseAdminUsersReturn;
}

export const UserActionsMenu: React.FC<UserActionsMenuProps> = ({ user, hook }) => {
  const { suspendUser, reactivateUser, resetOnboarding, forceLogout, actionLoading } = hook;

  const disabled = !user || actionLoading;

  const handleSuspend = () => {
    if (!user) return;
    void suspendUser(user.id, 'Suspended by admin');
  };
  const handleReactivate = () => {
    if (!user) return;
    void reactivateUser(user.id);
  };
  const handleResetOnboarding = () => {
    if (!user) return;
    void resetOnboarding(user.id);
  };
  const handleForceLogout = () => {
    if (!user) return;
    void forceLogout(user.id, 'Forced logout by admin');
  };

  const isActive = user?.accountStatus === 'active';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        color="light"
        className="flex items-center gap-2"
        disabled={disabled}
        onClick={isActive ? handleSuspend : handleReactivate}
      >
        {isActive ? (
          <UserMinusIcon className="w-4 h-4 shrink-0" aria-hidden />
        ) : (
          <UserCheckIcon className="w-4 h-4 shrink-0" aria-hidden />
        )}
        <span>{isActive ? 'Suspender usuario' : 'Reactivar usuario'}</span>
      </Button>
      <Button
        size="sm"
        color="light"
        className="flex items-center gap-2"
        disabled={disabled}
        onClick={handleResetOnboarding}
      >
        <RotateCcwIcon className="w-4 h-4 shrink-0" aria-hidden />
        <span>Reiniciar onboarding</span>
      </Button>
      <Button
        size="sm"
        color="light"
        className="flex items-center gap-2"
        disabled={disabled}
        onClick={handleForceLogout}
      >
        <LogOutIcon className="w-4 h-4 shrink-0" aria-hidden />
        <span>Cerrar sesión forzada</span>
      </Button>
    </div>
  );
};
