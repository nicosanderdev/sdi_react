// src/components/admin/properties/DeletePropertyConfirmModal.tsx
import React, { useState } from 'react';
import { Modal, ModalBody, ModalHeader, ModalFooter, Button, Alert, Checkbox } from 'flowbite-react';
import { AlertTriangleIcon, TrashIcon, HomeIcon } from 'lucide-react';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';

interface DeletePropertyConfirmModalProps {
  hook: UseAdminPropertiesReturn;
}

export const DeletePropertyConfirmModal: React.FC<DeletePropertyConfirmModalProps> = ({ hook }) => {
  const {
    deleteConfirmModalOpen,
    propertyToDelete,
    closeDeleteConfirmModal,
    confirmDeleteProperty,
    actionLoading,
    actionError,
  } = hook;

  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [understandConsequences, setUnderstandConsequences] = useState(false);
  const [confirmOwnership, setConfirmOwnership] = useState(false);

  const handleDelete = async () => {
    if (!propertyToDelete) return;

    try {
      await confirmDeleteProperty(reason);
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

  const canDelete = propertyToDelete &&
    confirmText === 'DELETE' &&
    understandConsequences &&
    confirmOwnership &&
    reason.trim().length > 0;

  if (!propertyToDelete) return null;

  return (
    <Modal show={deleteConfirmModalOpen} onClose={handleClose} size="lg">
      <ModalHeader>
        <div className="flex items-center space-x-2">
          <TrashIcon className="w-5 h-5 text-red-600" />
          <span>Delete Property</span>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert color="failure" icon={AlertTriangleIcon}>
            <span className="font-medium">Danger Zone:</span> This action cannot be undone. Deleting a property will permanently remove it from the system.
          </Alert>

          {/* Property Information */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Property to be deleted:</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Title:</strong> {propertyToDelete.title}</p>
              <p><strong>Owner:</strong> {(propertyToDelete as any).ownerName || 'Unknown'}</p>
              <p><strong>Location:</strong> {propertyToDelete.city}, {propertyToDelete.state}</p>
              <p><strong>Status:</strong> {(propertyToDelete as any).status || 'Unknown'}</p>
            </div>
          </div>

          {/* Consequences */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white">What will happen:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center space-x-2">
                <HomeIcon className="w-4 h-4" />
                <span>Property will be permanently removed from the system</span>
              </li>
              <li>All associated images, documents, and videos will be deleted</li>
              <li>Property will no longer be visible to any users</li>
              <li>All message threads related to this property will be affected</li>
              <li>Property visit logs will be removed</li>
              <li>This action is irreversible and for emergency use only</li>
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
              placeholder="Please provide a detailed reason for permanently deleting this property..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              rows={4}
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
                I understand that this action is irreversible and the property will be permanently deleted
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="confirm-ownership"
                checked={confirmOwnership}
                onChange={(e) => setConfirmOwnership(e.target.checked)}
              />
              <label htmlFor="confirm-ownership" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                I confirm that I have the authority to permanently delete this property and understand the emergency nature of this action
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
      </ModalBody>

      <ModalFooter>
        <Button color="gray" onClick={handleClose} disabled={actionLoading}>
          Cancel
        </Button>
        <Button
          color="failure"
          onClick={handleDelete}
          disabled={!canDelete || actionLoading}
          className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        >
          {actionLoading ? 'Deleting...' : 'Permanently Delete Property'}
        </Button>
        </ModalFooter>
    </Modal>
  );
};
