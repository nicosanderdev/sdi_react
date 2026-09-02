import { useState } from 'react';
import { Alert, Button, Label, Modal, ModalBody, ModalHeader, TextInput, Textarea } from 'flowbite-react';
import { UseAdminCompaniesReturn } from '../../../hooks/useAdminCompanies';

interface Props {
  open: boolean;
  onClose: () => void;
  hook: UseAdminCompaniesReturn;
}

export function CreateCompanyModal({ open, onClose, hook }: Props) {
  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!name.trim()) return setFormError('El nombre es obligatorio.');
    if (!billingEmail.trim()) return setFormError('El email es obligatorio.');

    const ok = await hook.createCompany({ name, billingEmail, description });
    if (ok) {
      setName('');
      setBillingEmail('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Modal show={open} onClose={onClose}>
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
          <div className="flex justify-end gap-2">
            <Button color="light" onClick={onClose} type="button">Cancelar</Button>
            <Button type="submit" data-testid="admin-create-company-submit">Crear</Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
