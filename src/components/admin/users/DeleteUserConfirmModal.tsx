// src/components/admin/users/DeleteUserConfirmModal.tsx
import React, { useState } from 'react';
import { Modal, Button, Alert, Textarea, Label, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import { AlertTriangleIcon, TrashIcon } from 'lucide-react';
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

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await confirmDeleteUser(reason.trim() || undefined);
    } catch {
      // Errors surfaced via actionError
    }
  };

  const handleClose = () => {
    closeDeleteConfirmModal();
    setReason('');
  };

  if (!userToDelete) return null;

  const userName = `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim() || 'Usuario';

  return (
    <Modal show={deleteConfirmModalOpen} onClose={handleClose} size="lg">
      <ModalHeader>
        <div className="flex items-center space-x-2">
          <TrashIcon className="w-5 h-5 text-red-600" />
          <span>Eliminar usuario</span>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          <Alert color="failure" icon={AlertTriangleIcon}>
            Esta acción marca al usuario como eliminado (<strong>IsDeleted</strong>) y revoca el acceso de
            autenticación cuando la función <code className="text-xs">admin-ban-user</code> está desplegada.
          </Alert>

          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Usuario:</strong> {userName}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Correo:</strong> {userToDelete.email}
            </p>
          </div>

          <div>
            <Label htmlFor="delete-reason" className="mb-2 block">
              Motivo (opcional, para auditoría)
            </Label>
            <Textarea
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo de la eliminación…"
              rows={3}
              className="w-full"
            />
          </div>

          {actionError && (
            <Alert color="failure">
              {actionError}
            </Alert>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button color="gray" onClick={handleClose} disabled={actionLoading}>
          Cancelar
        </Button>
        <Button color="failure" onClick={handleDelete} disabled={actionLoading}>
          {actionLoading ? 'Eliminando…' : 'Confirmar eliminación'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
