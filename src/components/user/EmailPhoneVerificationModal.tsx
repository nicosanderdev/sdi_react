import React, { useState, useEffect } from 'react';
import { XIcon } from 'lucide-react';
import profileService from '../../services/ProfileService';
import { setMemberVerification } from '../../services/OwnerOnboardingService';
import { TwoFactorInput } from '../public/TwoFactorInput';
import { Button, Label, TextInput } from 'flowbite-react';

export type VerificationType = 'email' | 'phone';

type Step = 'enter_value' | 'enter_code' | 'success';

interface EmailPhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: VerificationType;
  /** Member id for recording verification in owner onboarding; if provided, setMemberVerification is called on success */
  memberId?: string | null;
}

const LABELS = {
  email: {
    title: 'Cambiar correo electrónico',
    valueLabel: 'Nuevo correo electrónico',
    valuePlaceholder: 'ejemplo@correo.com',
    sendButton: 'Enviar código',
    codeLabel: 'Introduce el código de 6 dígitos enviado a tu nuevo correo',
    verifyButton: 'Verificar',
  },
  phone: {
    title: 'Cambiar teléfono',
    valueLabel: 'Nuevo número de teléfono',
    valuePlaceholder: '+34 600 000 000',
    sendButton: 'Enviar código',
    codeLabel: 'Introduce el código de 6 dígitos enviado a tu nuevo teléfono',
    verifyButton: 'Verificar',
  },
};

export function EmailPhoneVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  type,
  memberId,
}: EmailPhoneVerificationModalProps) {
  const [step, setStep] = useState<Step>('enter_value');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const labels = LABELS[type];

  useEffect(() => {
    if (isOpen) {
      setStep('enter_value');
      setValue('');
      setCode('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, type]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError(type === 'email' ? 'Introduce un correo válido.' : 'Introduce un número de teléfono.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (type === 'email') {
        await profileService.sendEmailVerification(trimmed);
      } else {
        await profileService.sendPhoneVerification(trimmed);
      }
      setStep('enter_code');
      setCode('');
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar el código. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (type === 'email') {
        await profileService.verifyEmailCode(code);
      } else {
        await profileService.verifyPhoneCode(code);
      }
      if (memberId) {
        await setMemberVerification(memberId, type);
      }
      setStep('success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Código inválido o expirado. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true" role="dialog">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{labels.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Cerrar"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {step === 'enter_value' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <Label htmlFor="verification-value">{labels.valueLabel}</Label>
              <TextInput
                id="verification-value"
                type={type === 'email' ? 'email' : 'tel'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={labels.valuePlaceholder}
                disabled={isSubmitting}
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button color="alternative" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : labels.sendButton}
              </Button>
            </div>
          </form>
        )}

        {step === 'enter_code' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{labels.codeLabel}</p>
            <TwoFactorInput
              length={6}
              value={code}
              onChange={setCode}
              onComplete={setCode}
              disabled={isSubmitting}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                color="alternative"
                onClick={() => setStep('enter_value')}
                disabled={isSubmitting}
              >
                Atrás
              </Button>
              <Button type="submit" disabled={code.length !== 6 || isSubmitting}>
                {isSubmitting ? 'Verificando...' : labels.verifyButton}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
