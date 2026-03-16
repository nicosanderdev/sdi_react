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
          <span>Eliminar propiedad</span>
        </div>
      </ModalHeader>

      <ModalBody>
        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert color="failure" icon={AlertTriangleIcon}>
            <span className="font-medium">Zona de peligro: </span>Esta acción no se puede deshacer. Eliminar una propiedad la borrará permanentemente del sistema.
          </Alert>

          {/* Property Information */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Propiedad a eliminar:</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Título:</strong> {propertyToDelete.title}</p>
              <p><strong>Propietario:</strong> {(propertyToDelete as any).ownerName || 'Desconocido'}</p>
              <p><strong>Ubicación:</strong> {propertyToDelete.city}, {propertyToDelete.state}</p>
              <p><strong>Estado:</strong> {(propertyToDelete as any).status || 'Desconocido'}</p>
            </div>
          </div>

          {/* Consequences */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white">Qué sucederá:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center space-x-2">
                <HomeIcon className="w-4 h-4" />
                <span>La propiedad se eliminará permanentemente del sistema</span>
              </li>
              <li>Se eliminarán todas las imágenes, documentos y vídeos asociados</li>
              <li>La propiedad ya no será visible para ningún usuario</li>
              <li>Los hilos de mensajes relacionados con esta propiedad se verán afectados</li>
              <li>Se eliminarán los registros de visitas de la propiedad</li>
              <li>Esta acción es irreversible y solo para uso de emergencia</li>
            </ul>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motivo de la eliminación <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Escriba el motivo detallado por el que elimina permanentemente esta propiedad..."
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
                Entiendo que esta acción es irreversible y que la propiedad se eliminará permanentemente
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="confirm-ownership"
                checked={confirmOwnership}
                onChange={(e) => setConfirmOwnership(e.target.checked)}
              />
              <label htmlFor="confirm-ownership" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                Confirmo que tengo autoridad para eliminar permanentemente esta propiedad y entiendo el carácter de emergencia de esta acción
              </label>
            </div>
          </div>

          {/* Final Confirmation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Escriba <code className="bg-red-100 dark:bg-red-900 px-1 py-0.5 rounded text-xs text-red-800 dark:text-red-200">
                DELETE
              </code> para confirmar <span className="text-red-500">*</span>
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
          Cancelar
        </Button>
        <Button
          color="failure"
          onClick={handleDelete}
          disabled={!canDelete || actionLoading}
          className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
        >
          {actionLoading ? 'Eliminando...' : 'Eliminar propiedad permanentemente'}
        </Button>
        </ModalFooter>
    </Modal>
  );
};
