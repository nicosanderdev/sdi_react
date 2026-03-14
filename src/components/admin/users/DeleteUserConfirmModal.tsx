// src/components/admin/users/DeleteUserConfirmModal.tsx
import React, { useState } from 'react';
import { Modal, Button, Alert, Checkbox } from 'flowbite-react';
import { AlertTriangleIcon, TrashIcon, UsersIcon } from 'lucide-react';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface DeleteUserConfirmModalProps {
  hook: UseAdminUsersReturn;
}

export const DeleteUserConfirmModal: React.FC<DeleteUserConfirmModalProps> = ({ hook }) => {
  const {
    deleteConfirmModalOpen,
    userToDelete,
    closeDeleteConfirmModal,
    confirmDeleteUser,
    actionLoading,
    actionError,
  } = hook;

  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [understandConsequences, setUnderstandConsequences] = useState(false);
  const [confirmOwnership, setConfirmOwnership] = useState(false);

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await confirmDeleteUser(reason || undefined);
      // Modal will be closed by the hook on success
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleClose = () => {
    closeDeleteConfirmModal();
    // Reset form state
    setReason('');
    setConfirmText('');
    setUnderstandConsequences(false);
    setConfirmOwnership(false);
  };

  const canDelete = userToDelete &&
    confirmText === 'DELETE' &&
    understandConsequences &&
    confirmOwnership &&
    reason.trim().length > 0;

  if (!userToDelete) return null;

  const userName = `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim() || 'Unknown User';

  return (
    <Modal show={deleteConfirmModalOpen} onClose={handleClose} size="lg">
      <Modal.Header>
        <div className="flex items-center space-x-2">
          <TrashIcon className="w-5 h-5 text-red-600" />
          <span>Delete User Account</span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert color="failure" icon={AlertTriangleIcon}>
            <span className="font-medium">Danger Zone:</span> This action cannot be undone. Deleting a user account will permanently remove their access and data.
          </Alert>

          {/* User Information */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">User to be deleted:</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Name:</strong> {userName}</p>
              <p><strong>Email:</strong> {userToDelete.email}</p>
              <p><strong>Role:</strong> {userToDelete.roles.includes('admin') ? 'Admin' : 'User'}</p>
              <p><strong>Properties:</strong> {userToDelete.propertiesCount}</p>
            </div>
          </div>

          {/* Consequences */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white">What will happen:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center space-x-2">
                <UsersIcon className="w-4 h-4" />
                <span>User will lose access to all platform features</span>
              </li>
              <li className="flex items-center space-x-2">
                <HomeIcon className="w-4 h-4" />
                <span>All associated properties will become inaccessible</span>
              </li>
              <li>User account will be marked as deleted (soft delete)</li>
              <li>All active sessions will be terminated</li>
              <li>User data will be retained for audit purposes</li>
            </ul>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for deletion <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for deleting this user account..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              required
            />
          </div>

          {/* Safety Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="understand-consequences"
                checked={understandConsequences}
                onChange={(e) => setUnderstandConsequences(e.target.checked)}
              />
              <label htmlFor="understand-consequences" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                I understand that this action is irreversible and the user will permanently lose access
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="confirm-ownership"
                checked={confirmOwnership}
                onChange={(e) => setConfirmOwnership(e.target.checked)}
              />
              <label htmlFor="confirm-ownership" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                I confirm that I have the authority to delete this user account
              </label>
            </div>
          </div>

          {/* Final Confirmation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type <code className="bg-red-100 dark:bg-red-900 px-1 py-0.5 rounded text-xs text-red-800 dark:text-red-200">
                DELETE
              </code> to confirm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Error Display */}
          {actionError && (
            <Alert color="failure">
              {actionError}
            </Alert>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button color="gray" onClick={handleClose} disabled={actionLoading}>
          Cancel
        </Button>
        <Button
          color="failure"
          onClick={handleDelete}
          disabled={!canDelete || actionLoading}
          className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        >
          {actionLoading ? 'Deleting...' : 'Delete User Account'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
