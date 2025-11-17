import React, { useState } from 'react';
import { Modal, Button, Label, TextInput, Alert, ModalHeader, ModalBody } from 'flowbite-react';
import { Mail, AlertCircle } from 'lucide-react';
import companyService from '../../services/CompanyService';
import { AddUserToCompanyRequest } from '../../models/companies/AddUserToCompanyRequest';

interface AddUserModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUserModal({ show, onClose, onSuccess }: AddUserModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError('Por favor, ingresa un correo electrónico');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, ingresa un correo electrónico válido');
      return;
    }

    setIsLoading(true);
    try {
      const request: AddUserToCompanyRequest = { email: email.trim() };
      await companyService.addUserToCompany(request);
      setSuccess(true);
      setEmail('');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 
        err.message || 
        'Error al agregar el usuario. Asegúrate de que el correo pertenezca a un usuario registrado.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose} size="md">
      <ModalHeader>Agregar Usuario a la Compañía</ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" value="Correo Electrónico" />
            <div className="mt-1 relative">
              <TextInput
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                icon={Mail}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              El usuario debe estar registrado en el sistema.
            </p>
          </div>

          {error && (
            <Alert color="failure" icon={AlertCircle}>
              <span className="font-medium">Error:</span> {error}
            </Alert>
          )}

          {success && (
            <Alert color="success">
              <span className="font-medium">¡Éxito!</span> Usuario agregado correctamente.
            </Alert>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              color="gray"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              color="blue"
              disabled={isLoading}
            >
              {isLoading ? 'Agregando...' : 'Agregar Usuario'}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}

