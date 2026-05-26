import React from 'react';
import { Modal, Button, Label, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import { UserIcon, MailIcon, PhoneIcon, CalendarIcon } from 'lucide-react';
import { UseAdminGuestsReturn } from '../../../hooks/useAdminGuests';

interface GuestViewModalProps {
  hook: UseAdminGuestsReturn;
}

const dash = (v: string | null | undefined) => {
  const s = (v ?? '').trim();
  return s || '—';
};

export const GuestViewModal: React.FC<GuestViewModalProps> = ({ hook }) => {
  const { viewModalOpen, closeViewModal, viewGuest, viewGuestLoading, viewModalError } = hook;

  return (
    <Modal show={viewModalOpen} onClose={closeViewModal} size="md">
      <ModalHeader>Ver invitado</ModalHeader>
      <ModalBody>
        {viewGuestLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white" />
          </div>
        ) : viewModalError ? (
          <p className="text-red-600 dark:text-red-400">{viewModalError}</p>
        ) : viewGuest ? (
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block">Nombre</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <UserIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewGuest.firstName)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Apellido</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <UserIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewGuest.lastName)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Teléfono</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <PhoneIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewGuest.phoneNumber)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Correo electrónico</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <MailIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{dash(viewGuest.email)}</span>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Reservas</Label>
              <div className="text-gray-900 dark:text-white">{viewGuest.bookingsCount}</div>
            </div>
            <div>
              <Label className="mb-1 block">Registrado</Label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <CalendarIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <span>{new Date(viewGuest.created).toLocaleString()}</span>
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
