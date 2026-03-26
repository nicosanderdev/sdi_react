// src/components/admin/users/UserViewModal.tsx
import React from 'react';
import { Modal, Button, Label, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import { UserIcon, MailIcon, PhoneIcon } from 'lucide-react';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UserViewModalProps {
  hook: UseAdminUsersReturn;
}

const dash = (v: string | null | undefined) => {
  const s = (v ?? '').trim();
  return s || '—';
};

export const UserViewModal: React.FC<UserViewModalProps> = ({ hook }) => {
  const {
    viewModalOpen,
    closeViewModal,
    viewUser,
    viewUserLoading,
    viewModalError,
  } = hook;

  return (
    <Modal show={viewModalOpen} onClose={closeViewModal} size="md">
      <ModalHeader>Ver usuario</ModalHeader>
      <ModalBody>
        {viewUserLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white" />
          </div>
        ) : viewModalError ? (
          <p className="text-red-600 dark:text-red-400">{viewModalError}</p>
        ) : viewUser ? (
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Nombre</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <UserIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewUser.firstName)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Apellido</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <UserIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewUser.lastName)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Teléfono</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <PhoneIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewUser.phone)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Correo electrónico</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <MailIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewUser.email)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button color="gray" onClick={closeViewModal}>
          Cerrar
        </Button>
      </ModalFooter>
    </Modal>
  );
};
