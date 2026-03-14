import React, { useState } from 'react';
import { Modal, Button, Label, TextInput, Textarea, Alert, ModalHeader, ModalBody, Spinner } from 'flowbite-react';
import { Building2, AlertCircle, CheckCircle } from 'lucide-react';
import companyService from '../../services/CompanyService';
import { useAuth } from '../../contexts/AuthContext';

interface CreateCompanyModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (company: any) => void;
}

export function CreateCompanyModal({ show, onClose, onSuccess }: CreateCompanyModalProps) {
  const { user } = useAuth();
  const userEmail = user?.email ?? '';
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    billingEmail: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.name.trim()) {
      setError('El nombre de la compañía es obligatorio');
      return;
    }

    if (!formData.billingEmail.trim()) {
      setError('El correo de facturación es obligatorio');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.billingEmail)) {
      setError('Por favor, ingresa un correo electrónico válido');
      return;
    }

    setIsLoading(true);
    try {
      const newCompany = await companyService.createCompany({
        name: formData.name.trim(),
        description: formData.description.trim(),
        billingEmail: formData.billingEmail.trim()
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess(newCompany);
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Error al crear la compañía. Inténtalo de nuevo.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', description: '', billingEmail: '' });
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose} size="md">
      <ModalHeader>
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5" />
          <span>Crear Nueva Compañía</span>
        </div>
      </ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert color="failure" icon={AlertCircle}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert color="success" icon={CheckCircle}>
              ¡Compañía creada exitosamente! Redirigiendo...
            </Alert>
          )}

          <div>
            <Label htmlFor="companyName" value="Nombre de la Compañía *" />
            <TextInput
              id="companyName"
              type="text"
              placeholder="Ingresa el nombre de tu compañía"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              disabled={isLoading || success}
            />
          </div>

          <div>
            <Label htmlFor="companyDescription" value="Descripción (opcional)" />
            <Textarea
              id="companyDescription"
              placeholder="Describe brevemente tu compañía"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              disabled={isLoading || success}
            />
          </div>

          <div>
            <Label htmlFor="billingEmail" value="Correo de Facturación *" />
            <div className="flex gap-2 mt-1">
              <TextInput
                id="billingEmail"
                type="email"
                className="flex-1"
                placeholder="correo@empresa.com"
                value={formData.billingEmail}
                onChange={(e) => handleInputChange('billingEmail', e.target.value)}
                required
                disabled={isLoading || success}
              />
              <Button
                type="button"
                size="xs"
                color="light"
                onClick={() => handleInputChange('billingEmail', userEmail)}
                disabled={isLoading || success || !userEmail}
              >
                Usar mi email
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Este correo se utilizará para facturación y comunicaciones importantes
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              color="gray"
              onClick={handleClose}
              disabled={isLoading || success}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || success}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span>Creando...</span>
                </div>
              ) : (
                'Crear Compañía'
              )}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
