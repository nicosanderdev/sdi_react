import React from 'react';
import { Modal, ModalHeader, ModalBody } from 'flowbite-react';
import { AdminCreateMemberForm } from '../properties/AdminCreateMemberForm';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreateSuccess: () => Promise<void> | void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  open,
  onClose,
  onCreateSuccess,
}) => {
  const handleSubmitSuccess = async () => {
    await onCreateSuccess();
    onClose();
  };

  return (
    <Modal show={open} onClose={onClose} size="3xl">
      <ModalHeader>Create User</ModalHeader>
      <ModalBody>
        <div data-testid="admin-create-user-modal">
          <AdminCreateMemberForm
            onSubmitSuccess={handleSubmitSuccess}
            onCancel={onClose}
            submitLabel="Create User"
            submittingLabel="Creating..."
            cancelLabel="Cancel"
            hideExtendedFields
          />
        </div>
      </ModalBody>
    </Modal>
  );
};
