import React from 'react';
import { Modal, Button, Alert, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import { AlertTriangleIcon, UnlinkIcon } from 'lucide-react';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UnlinkMercadoPagoConfirmModalProps {
  hook: UseAdminUsersReturn;
}

export const UnlinkMercadoPagoConfirmModal: React.FC<UnlinkMercadoPagoConfirmModalProps> = ({
  hook,
}) => {
  const {
    unlinkMercadoPagoModalOpen,
    userToUnlinkMercadoPago,
    closeUnlinkMercadoPagoModal,
    confirmUnlinkMercadoPago,
    actionLoading,
    actionError,
  } = hook;

  if (!userToUnlinkMercadoPago) return null;

  const userName =
    `${userToUnlinkMercadoPago.firstName || ''} ${userToUnlinkMercadoPago.lastName || ''}`.trim() ||
    'Usuario';

  return (
    <Modal show={unlinkMercadoPagoModalOpen} onClose={closeUnlinkMercadoPagoModal} size="lg">
      <ModalHeader>
        <div className="flex items-center space-x-2">
          <UnlinkIcon className="w-5 h-5 text-amber-600" />
          <span>Desvincular Mercado Pago</span>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          <Alert color="warning" icon={AlertTriangleIcon}>
            Se eliminarán de nuestra base de datos los tokens y datos de conexión de Mercado Pago de
            este usuario. No podrá cobrar reservas online hasta que vuelva a conectar su cuenta.
          </Alert>

          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Usuario:</strong> {userName}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Correo:</strong> {userToUnlinkMercadoPago.email}
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Mercado Pago no ofrece una API de revocación para marketplaces. El vendedor también puede
            revocar el acceso a la aplicación desde su cuenta de Mercado Pago.
          </p>

          {actionError && (
            <Alert color="failure">{actionError}</Alert>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <div className="flex w-full justify-end gap-2">
          <Button color="light" onClick={closeUnlinkMercadoPagoModal} disabled={actionLoading}>
            Cancelar
          </Button>
          <Button
            color="failure"
            onClick={() => void confirmUnlinkMercadoPago()}
            disabled={actionLoading}
            data-testid="admin-users-unlink-mp-confirm"
          >
            {actionLoading ? 'Desvinculando…' : 'Desvincular'}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};
