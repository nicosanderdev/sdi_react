import React, { useState } from 'react';
import { MailIcon, KeyRoundIcon, LockKeyholeIcon, ArrowLeftIcon, CheckCircleIcon, Shield } from 'lucide-react';
import AuthService, { RecoveryCodePayload, ResetPasswordPayload } from '../../services/AuthService';
import { AuthCard } from '../../components/public/AuthCard';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Button, TextInput } from 'flowbite-react';

type PageStep = 'ENTER_EMAIL' | 'ENTER_RECOVERY' | 'SET_NEW_PASSWORD' | 'SUCCESS';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<PageStep>('ENTER_EMAIL');
  
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // This token is received from a valid recovery code submission
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await AuthService.forgotPassword(email);
      setSuccessMessage('Si existe una cuenta con ese correo electrónico, recibirás un enlace para restablecer tu contraseña.');
      // To-do: Handle two factor auth
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message || 'Error al solicitar restablecimiento de contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
        const payload: RecoveryCodePayload = { recoveryCode };
        await AuthService.validateRecoveryPasswordChange(payload);
        setStep('SET_NEW_PASSWORD');
    } catch(err: any) {
        setError(err.message || 'El código de recuperación es inválido.');
    } finally {
        setIsSubmitting(false);
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!resetToken) {
        setError('Sesión inválida. Por favor, intente de nuevo.');
        setStep('ENTER_RECOVERY');
        return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
        const payload: ResetPasswordPayload = { token: resetToken, newPassword: newPassword };
        await AuthService.resetPassword(payload);
        setSuccessMessage('¡Tu contraseña ha sido restablecida con éxito! Ahora puedes iniciar sesión.');
        setStep('SUCCESS');
    } catch (err: any) {
        setError(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
        setIsSubmitting(false);
    }
  }

  const renderContent = () => {
    switch (step) {
      case 'ENTER_EMAIL':
        return (
          <div className="space-y-6">
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <TextInput
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  disabled={isSubmitting}
                  icon={MailIcon}
                  color={error ? "failure" : "gray"}
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                color="success"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Enlace'}
              </Button>
            </form>
            <div className="text-center">
              <button
                onClick={() => setStep('ENTER_RECOVERY')}
                className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              >
                ¿Perdiste acceso a tu correo? Usa un código de recuperación
              </button>
            </div>
          </div>
        );
      case 'ENTER_RECOVERY':
        return (
          <div className="space-y-6">
            <form onSubmit={handleRecoverySubmit} className="space-y-6">
              <div>
                <TextInput
                  type="text"
                  required
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="abc-123-xyz"
                  disabled={isSubmitting}
                  icon={KeyRoundIcon}
                  color={error ? "failure" : "gray"}
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                color="success"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Validando...' : 'Validar Código'}
              </Button>
            </form>
            <div className="text-center">
              <button
                onClick={() => setStep('ENTER_EMAIL')}
                className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              >
                Volver a usar correo electrónico
              </button>
            </div>
          </div>
        )
      case 'SET_NEW_PASSWORD':
        return (
          <div className="space-y-6">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <TextInput
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  disabled={isSubmitting}
                  icon={LockKeyholeIcon}
                  color={error ? "failure" : "gray"}
                  helperText="Mínimo 8 caracteres."
                />
              </div>
              <div>
                <TextInput
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar nueva contraseña"
                  disabled={isSubmitting}
                  icon={LockKeyholeIcon}
                  color={error ? "failure" : "gray"}
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                color="success"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Contraseña'}
              </Button>
            </form>
          </div>
        )
      case 'SUCCESS':
        return (
          <div className="text-center space-y-6">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-600 dark:text-green-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">¡Listo!</h2>
            <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 p-4 rounded-lg">
              {successMessage}
            </div>
          </div>
        )
    }
  }

  return (
    <PublicLayout>
      <AuthCard
        title={step === 'ENTER_EMAIL' ? 'Recuperar Contraseña' : step === 'ENTER_RECOVERY' ? 'Usar Código de Recuperación' : step === 'SET_NEW_PASSWORD' ? 'Establecer Nueva Contraseña' : '¡Listo!'}
        subtitle={step === 'ENTER_EMAIL' ? 'Te enviaremos un enlace para restablecer tu contraseña.' : step === 'ENTER_RECOVERY' ? 'Ingresa uno de tus códigos de recuperación para continuar.' : step === 'SET_NEW_PASSWORD' ? 'Código validado. Ahora puedes crear una nueva contraseña.' : ''}
        icon={<Shield className="w-8 h-8 text-green-600 dark:text-green-400" />}
      >
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6" role="alert">
            <span>{error}</span>
          </div>
        )}
        {renderContent()}
        <div className="text-center mt-6">
          <a href="/login" className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center justify-center">
            <ArrowLeftIcon size={14} className="mr-2" /> Volver al inicio de sesión
          </a>
        </div>
      </AuthCard>
    </PublicLayout>
  );
}