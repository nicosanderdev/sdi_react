import React, { useState, useEffect } from 'react';
import { XIcon } from 'lucide-react';
import profileService from '../../services/ProfileService';
import { TwoFactorInput } from '../public/TwoFactorInput';
import { Button, Label, TextInput } from 'flowbite-react';
import { PhonePrefixInput } from './PhonePrefixInput';
import { DEFAULT_MEMBER_PHONE_PREFIX, formatMemberPhoneDisplay } from '../../utils/memberPhone';

export type VerificationType = 'email' | 'phone';
export type VerificationIntent = 'verify' | 'add' | 'change';

type Step = 'enter_value' | 'enter_code';

interface EmailPhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: VerificationType;
  intent: VerificationIntent;
  currentEmail?: string | null;
  currentPhone?: string | null;
  currentPhonePrefix?: string | null;
}

function titles(type: VerificationType, intent: VerificationIntent) {
  if (type === 'email') {
    if (intent === 'verify') {
      return {
        title: 'Verificar correo electrónico',
        valueLabel: 'Correo electrónico',
        sendButton: 'Enviar código',
        codeLabel: 'Introduce el código de 6 dígitos enviado a tu correo',
        verifyButton: 'Verificar',
      };
    }
    return {
      title: 'Cambiar correo electrónico',
      valueLabel: 'Nuevo correo electrónico',
      sendButton: 'Enviar código',
      codeLabel: 'Introduce el código de 6 dígitos enviado a tu nuevo correo',
      verifyButton: 'Verificar',
    };
  }
  if (intent === 'verify') {
    return {
      title: 'Verificar teléfono',
      valueLabel: 'Número de teléfono',
      sendButton: 'Enviar código',
      codeLabel: 'Introduce el código de 6 dígitos enviado por WhatsApp',
      verifyButton: 'Verificar',
    };
  }
  if (intent === 'add') {
    return {
      title: 'Agregar y verificar teléfono',
      valueLabel: 'Número de teléfono',
      sendButton: 'Enviar código',
      codeLabel: 'Introduce el código de 6 dígitos enviado por WhatsApp',
      verifyButton: 'Verificar',
    };
  }
  return {
    title: 'Cambiar teléfono',
    valueLabel: 'Nuevo número de teléfono',
    sendButton: 'Enviar código',
    codeLabel: 'Introduce el código de 6 dígitos enviado por WhatsApp',
    verifyButton: 'Verificar',
  };
}

export function EmailPhoneVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  type,
  intent,
  currentEmail,
  currentPhone,
  currentPhonePrefix,
}: EmailPhoneVerificationModalProps) {
  const [step, setStep] = useState<Step>('enter_value');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phonePrefix, setPhonePrefix] = useState(DEFAULT_MEMBER_PHONE_PREFIX);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const labels = titles(type, intent);
  const isVerifyCurrent = intent === 'verify';

  useEffect(() => {
    if (isOpen) {
      setStep('enter_value');
      setEmail((currentEmail ?? '').trim());
      setPhone((currentPhone ?? '').trim());
      setPhonePrefix((currentPhonePrefix ?? '').trim() || DEFAULT_MEMBER_PHONE_PREFIX);
      setCode('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, type, intent, currentEmail, currentPhone, currentPhonePrefix]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (type === 'email') {
      const trimmed = email.trim();
      if (!trimmed) {
        setError('Introduce un correo válido.');
        return;
      }
      setIsSubmitting(true);
      try {
        await profileService.sendEmailVerification(trimmed);
        setStep('enter_code');
        setCode('');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'No se pudo enviar el código. Inténtalo de nuevo.';
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Introduce un número de teléfono.');
      return;
    }
    setIsSubmitting(true);
    try {
      await profileService.sendPhoneVerification(trimmedPhone, phonePrefix);
      setStep('enter_code');
      setCode('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar el código. Inténtalo de nuevo.';
      setError(message);
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
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Código inválido o expirado. Inténtalo de nuevo.';
      setError(message);
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
            {type === 'email' ? (
              <div>
                <Label htmlFor="verification-email">{labels.valueLabel}</Label>
                <TextInput
                  id="verification-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  disabled={isSubmitting || isVerifyCurrent}
                  className="mt-1"
                />
              </div>
            ) : isVerifyCurrent ? (
              <div>
                <Label>{labels.valueLabel}</Label>
                <p className="mt-1 font-medium text-gray-900 dark:text-white">
                  {formatMemberPhoneDisplay(phonePrefix, phone) || '-'}
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="verification-phone">{labels.valueLabel}</Label>
                <div className="mt-1">
                  <PhonePrefixInput
                    prefix={phonePrefix}
                    phone={phone}
                    onPrefixChange={setPhonePrefix}
                    onPhoneChange={setPhone}
                    disabled={isSubmitting}
                    phoneId="verification-phone"
                    required
                  />
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" color="alternative" onClick={onClose} disabled={isSubmitting}>
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
