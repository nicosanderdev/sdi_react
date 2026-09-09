import React, { useEffect, useState } from 'react';
import { Modal, Button, Label, TextInput, Textarea, Alert, ModalHeader, ModalBody, Spinner } from 'flowbite-react';
import { Building2, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import companyService from '../../services/CompanyService';
import subscriptionService, { isPlanPaymentRequiredError } from '../../services/SubscriptionService';
import { useAuth } from '../../contexts/AuthContext';
import { useContactVerificationGate } from '../../hooks/useContactVerificationGate';
import { CONTACT_VERIFICATION_REQUIRED_MESSAGE } from '../../utils/contactVerification';
import { CompanyPlanCards } from '../subscription/CompanyPlanCards';
import type { PlanData } from '../../models/subscriptions/PlanData';

interface CreateCompanyModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (company: any) => void;
}

export function CreateCompanyModal({ show, onClose, onSuccess }: CreateCompanyModalProps) {
  const { user } = useAuth();
  const userEmail = user?.email ?? '';
  const { needsVerification, isLoading: isVerificationLoading } = useContactVerificationGate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    billingEmail: ''
  });
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    (async () => {
      try {
        const companyPlans = await subscriptionService.getPlans('company');
        if (cancelled) return;
        setPlans(companyPlans.filter(plan => plan.isActive));
        setPlansError(null);
      } catch (err: any) {
        if (!cancelled) setPlansError(err.message || 'Error al cargar los planes');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (needsVerification) {
      setError(CONTACT_VERIFICATION_REQUIRED_MESSAGE);
      return;
    }

    if (!formData.name.trim()) {
      setError('El nombre de la compañía es obligatorio');
      return;
    }

    if (!formData.billingEmail.trim()) {
      setError('El correo de facturación es obligatorio');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.billingEmail)) {
      setError('Por favor, ingresa un correo electrónico válido');
      return;
    }

    if (!selectedPlanId) {
      setError('Debes elegir un plan de compañía');
      return;
    }

    const selectedPlan = plans.find(plan => plan.id === selectedPlanId);
    if (!selectedPlan) {
      setError('Plan seleccionado no encontrado');
      return;
    }

    setIsLoading(true);
    try {
      if (selectedPlan.monthlyPrice > 0) {
        const session = await subscriptionService.createPlanCheckout({
          kind: 'create_company',
          planId: selectedPlanId,
          name: formData.name.trim(),
          billingEmail: formData.billingEmail.trim(),
          description: formData.description.trim(),
        });
        window.location.href = session.checkoutUrl;
        return;
      }

      const newCompany = await companyService.createCompany({
        name: formData.name.trim(),
        description: formData.description.trim(),
        billingEmail: formData.billingEmail.trim(),
        planId: selectedPlanId,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess(newCompany);
        handleClose();
      }, 1500);
    } catch (err: any) {
      if (isPlanPaymentRequiredError(err) && selectedPlanId) {
        try {
          const session = await subscriptionService.createPlanCheckout({
            kind: 'create_company',
            planId: selectedPlanId,
            name: formData.name.trim(),
            billingEmail: formData.billingEmail.trim(),
            description: formData.description.trim(),
          });
          window.location.href = session.checkoutUrl;
          return;
        } catch (checkoutErr: any) {
          setError(checkoutErr.message || 'Error al iniciar el pago del plan.');
          return;
        }
      }
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
    setSelectedPlanId(null);
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose} size="2xl" data-testid="create-company-modal">
      <ModalHeader>
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5" />
          <span>Crear Nueva Compañía</span>
        </div>
      </ModalHeader>
      <ModalBody>
        {needsVerification && !isVerificationLoading ? (
          <div className="space-y-4">
            <Alert color="warning" icon={AlertCircle}>
              {CONTACT_VERIFICATION_REQUIRED_MESSAGE}
            </Alert>
            <div className="flex justify-end space-x-3">
              <Button color="gray" onClick={handleClose}>
                Cerrar
              </Button>
              <Button as={Link} to="/dashboard/profile" onClick={handleClose}>
                Ir al perfil
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert color="failure" icon={AlertCircle}>
                {error}
              </Alert>
            )}
            {plansError && (
              <Alert color="failure" icon={AlertCircle}>
                {plansError}
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

            <div>
              <Label value="Plan de compañía *" />
              <p className="text-xs text-gray-500 mb-2">
                El plan es permanente. El ciclo de facturación se renueva; el plan no se reasigna cada mes.
              </p>
              <CompanyPlanCards
                plans={plans}
                selectedPlanId={selectedPlanId}
                onSelect={setSelectedPlanId}
                disabled={isLoading || success}
              />
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
                data-testid="create-company-submit"
                disabled={isLoading || success || isVerificationLoading || !selectedPlanId}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Procesando...</span>
                  </div>
                ) : (
                  'Crear Compañía'
                )}
              </Button>
            </div>
          </form>
        )}
      </ModalBody>
    </Modal>
  );
}
