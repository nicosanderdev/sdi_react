// src/components/admin/users/UserRoleSelector.tsx
import React, { useState } from 'react';
import { Button, Modal, Radio, Alert } from 'flowbite-react';
import { ShieldIcon, AlertTriangleIcon } from 'lucide-react';
import { UserRole } from '../../../services/UserAdminService';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UserRoleSelectorProps {
  userId: string;
  currentRole: UserRole;
  userName: string;
  hook: UseAdminUsersReturn;
}

export const UserRoleSelector: React.FC<UserRoleSelectorProps> = ({
  userId,
  currentRole,
  userName,
  hook
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [confirmText, setConfirmText] = useState('');

  const { updateUserRole, actionLoading } = hook;

  const handleRoleChange = async () => {
    if (selectedRole === currentRole) {
      setShowModal(false);
      return;
    }

    try {
      await updateUserRole(userId, selectedRole);
      setShowModal(false);
      setConfirmText('');
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const openModal = () => {
    setSelectedRole(currentRole);
    setConfirmText('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setConfirmText('');
  };

  const isRoleChanging = selectedRole !== currentRole;
  const requiredConfirmText = `CHANGE ${selectedRole.toUpperCase()}`;

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Full administrative access to all system features, user management, and platform configuration.';
      case 'user':
        return 'Standard user access with property management and basic features.';
      default:
        return '';
    }
  };

  const getRoleWarning = (role: UserRole) => {
    if (role === 'admin' && currentRole === 'user') {
      return 'Granting admin privileges gives this user full access to manage other users, modify system settings, and perform administrative actions.';
    }
    if (role === 'user' && currentRole === 'admin') {
      return 'Removing admin privileges will restrict this user to standard features only. They will lose access to user management and administrative functions.';
    }
    return null;
  };

  return (
    <>
      <Button
        color="light"
        size="sm"
        onClick={openModal}
        className="flex items-center space-x-2"
      >
        <ShieldIcon className="w-4 h-4" />
        <span>Change Role</span>
      </Button>

      <Modal show={showModal} onClose={closeModal} size="lg">
        <Modal.Header>
          Change User Role
        </Modal.Header>

        <Modal.Body>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {userName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current role: <span className="font-medium">{currentRole}</span>
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select new role:
              </label>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Radio
                    id="role-user"
                    name="userRole"
                    value="user"
                    checked={selectedRole === 'user'}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  />
                  <div className="flex-1">
                    <label htmlFor="role-user" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                      User
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {getRoleDescription('user')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Radio
                    id="role-admin"
                    name="userRole"
                    value="admin"
                    checked={selectedRole === 'admin'}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  />
                  <div className="flex-1">
                    <label htmlFor="role-admin" className="font-medium text-gray-900 dark:text-white cursor-pointer">
                      Admin
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {getRoleDescription('admin')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isRoleChanging && getRoleWarning(selectedRole) && (
              <Alert color="warning" icon={AlertTriangleIcon}>
                <span className="font-medium">Warning:</span> {getRoleWarning(selectedRole)}
              </Alert>
            )}

            {isRoleChanging && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">
                    {requiredConfirmText}
                  </code> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder={requiredConfirmText}
                />
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button color="gray" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleRoleChange}
            disabled={actionLoading || (isRoleChanging && confirmText !== requiredConfirmText)}
          >
            {actionLoading ? 'Updating...' : 'Update Role'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
