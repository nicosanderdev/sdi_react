import { useState } from 'react';
import { Alert, Button, Label, Modal, ModalBody, ModalHeader, TextInput } from 'flowbite-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<boolean>;
  error: string | null;
}

export default function AddCompanyUserModal({ open, onClose, onSubmit, error }: Props) {
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!email.trim()) {
      setFormError('Ingresa un correo electrónico.');
      return;
    }
    const ok = await onSubmit(email);
    if (ok) {
      setEmail('');
      onClose();
    }
  };

  return (
    <Modal show={open} onClose={onClose}>
      <ModalHeader>Agregar usuario a la compañía</ModalHeader>
      <ModalBody>
        <form className="space-y-3" onSubmit={submit}>
          {formError && <Alert color="failure">{formError}</Alert>}
          {error && <Alert color="failure">{error}</Alert>}
          <div>
            <Label value="Correo del usuario" />
            <TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button color="light" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Agregar usuario</Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
