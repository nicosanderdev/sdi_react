// src/components/admin/users/UserEditModal.tsx
import React, { useEffect, useState } from 'react';
import { Modal, Button, Label, TextInput, Alert, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UserEditModalProps {
  hook: UseAdminUsersReturn;
}

const emailOk = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const UserEditModal: React.FC<UserEditModalProps> = ({ hook }) => {
  const {
    editModalOpen,
    closeEditModal,
    editUser,
    editUserLoading,
    editSubmitting,
    editModalError,
    editFieldErrors,
    submitUserEdit,
  } = hook;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (editUser) {
      setFirstName(editUser.firstName ?? '');
      setLastName(editUser.lastName ?? '');
      setEmail(editUser.email ?? '');
      setPhone(editUser.phone ?? '');
      setClientError(null);
    }
  }, [editUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    const em = email.trim();
    if (!em) {
      setClientError('El correo es obligatorio');
      return;
    }
    if (!emailOk(em)) {
      setClientError('Introduce un correo electrónico válido');
      return;
    }
    await submitUserEdit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: em,
      phone: phone.trim(),
    });
  };

  return (
    <Modal show={editModalOpen} onClose={closeEditModal} size="md">
      <ModalHeader>Editar usuario</ModalHeader>
      <ModalBody>
        <div data-testid="admin-edit-user-modal">
          {editUserLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white" />
            </div>
          ) : editModalError && !editUser ? (
            <p className="text-red-600 dark:text-red-400">{editModalError}</p>
          ) : editUser ? (
            <form id="admin-user-edit-form" onSubmit={handleSubmit} className="space-y-4">
              {(editModalError || clientError) && (
                <Alert color="failure">{clientError || editModalError}</Alert>
              )}
              <div>
                <Label htmlFor="edit-first-name" className="mb-1 block">
                  Nombre
                </Label>
                <TextInput
                  id="edit-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={editSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="edit-last-name" className="mb-1 block">
                  Apellido
                </Label>
                <TextInput
                  id="edit-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={editSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone" className="mb-1 block">
                  Teléfono
                </Label>
                <TextInput
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={editSubmitting}
                  color={editFieldErrors.phone ? 'failure' : 'gray'}
                />
                {editFieldErrors.phone && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{editFieldErrors.phone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-email" className="mb-1 block">
                  Correo electrónico
                </Label>
                <TextInput
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={editSubmitting}
                  required
                  color={editFieldErrors.email ? 'failure' : 'gray'}
                />
                {editFieldErrors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{editFieldErrors.email}</p>
                )}
              </div>
            </form>
          ) : null}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="gray" onClick={closeEditModal} disabled={editSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="admin-user-edit-form"
          disabled={editUserLoading || !editUser || editSubmitting}
        >
          {editSubmitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
