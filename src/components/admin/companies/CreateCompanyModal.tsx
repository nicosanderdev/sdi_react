import { useEffect, useState } from 'react';
import { Alert, Button, Label, Modal, ModalBody, ModalHeader, TextInput, Textarea } from 'flowbite-react';
import { UseAdminCompaniesReturn } from '../../../hooks/useAdminCompanies';
import subscriptionService from '../../../services/SubscriptionService';
import { CompanyPlanCards } from '../../subscription/CompanyPlanCards';
import type { PlanData } from '../../../models/subscriptions/PlanData';

interface Props {
  open: boolean;
  onClose: () => void;
  hook: UseAdminCompaniesReturn;
}

export function CreateCompanyModal({ open, onClose, hook }: Props) {
  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [description, setDescription] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    subscriptionService.getPlans('company').then((rows) => {
      setPlans(rows.filter((plan) => plan.isActive));
    }).catch((err: Error) => {
      setFormError(err.message);
    });
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) return setFormError('El nombre es obligatorio.');
    if (!billingEmail.trim()) return setFormError('El email es obligatorio.');
    if (!planId) return setFormError('Debes elegir un plan de compañía.');

    const ok = await hook.createCompany({ name, billingEmail, description, planId });
    if (ok) {
      setName('');
      setBillingEmail('');
      setDescription('');
      setPlanId(null);
      onClose();
    }
  };

  return (
    <Modal show={open} onClose={onClose} size="2xl">
      <ModalHeader>Crear compañía</ModalHeader>
      <ModalBody>
        <form className="space-y-3" onSubmit={submit}>
          {formError && <Alert color="failure">{formError}</Alert>}
          {hook.actionError && <Alert color="failure">{hook.actionError}</Alert>}
          <div>
            <Label htmlFor="admin-company-name">Nombre</Label>
            <TextInput id="admin-company-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="admin-company-billing-email">Email de contacto/facturación</Label>
            <TextInput id="admin-company-billing-email" type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Plan de compañía</Label>
            <CompanyPlanCards plans={plans} selectedPlanId={planId} onSelect={setPlanId} />
          </div>
          <div className="flex justify-end gap-2">
            <Button color="light" onClick={onClose} type="button">Cancelar</Button>
            <Button type="submit" data-testid="admin-create-company-submit">Crear</Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
