// src/pages/auth/ForgotPasswordPage.tsx

import React, { useState } from 'react';
import { MailIcon, KeyRoundIcon, LockKeyholeIcon, ArrowLeftIcon, CheckCircleIcon } from 'lucide-react';
import AuthService, { RecoveryCodePayload, ResetPasswordPayload } from '../../services/AuthService';

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
          <>
            <div className="text-center mb-8"><h1 className="text-2xl font-bold text-[#1B4965] mb-2">Recuperar Contraseña</h1><p className="text-gray-600">Te enviaremos un enlace para restablecer tu contraseña.</p></div>
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div><label className="block text-sm font-medium text-[#101828] mb-2">Correo electrónico</label><div className="relative"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="tu@empresa.com" disabled={isSubmitting} /><MailIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors flex items-center justify-center">{isSubmitting ? 'Enviando...' : 'Enviar Enlace'}</button>
            </form>
            <div className="mt-4 text-center"><button onClick={() => setStep('ENTER_RECOVERY')} className="text-sm text-[#62B6CB] hover:text-[#1B4965]">¿Perdiste acceso a tu correo? Usa un código de recuperación</button></div>
          </>
        );
      case 'ENTER_RECOVERY':
        return (
            <>
            <div className="text-center mb-8"><h1 className="text-2xl font-bold text-[#1B4965] mb-2">Usar Código de Recuperación</h1><p className="text-gray-600">Ingresa uno de tus códigos de recuperación para continuar.</p></div>
            <form onSubmit={handleRecoverySubmit} className="space-y-6">
              <div><label className="block text-sm font-medium text-[#101828] mb-2">Código de Recuperación</label><div className="relative"><input type="text" required value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="abc-123-xyz" disabled={isSubmitting} /><KeyRoundIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors flex items-center justify-center">{isSubmitting ? 'Validando...' : 'Validar Código'}</button>
            </form>
            <div className="mt-4 text-center"><button onClick={() => setStep('ENTER_EMAIL')} className="text-sm text-[#62B6CB] hover:text-[#1B4965]">Volver a usar correo electrónico</button></div>
          </>
        )
      case 'SET_NEW_PASSWORD':
        return (
            <>
            <div className="text-center mb-8"><h1 className="text-2xl font-bold text-[#1B4965] mb-2">Establecer Nueva Contraseña</h1><p className="text-gray-600">Código validado. Ahora puedes crear una nueva contraseña.</p></div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-[#101828] mb-1">Nueva Contraseña</label><div className="relative"><input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg" disabled={isSubmitting} /><LockKeyholeIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div><p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres.</p></div>
              <div><label className="block text-sm font-medium text-[#101828] mb-1">Confirmar Nueva Contraseña</label><div className="relative"><input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg" disabled={isSubmitting} /><LockKeyholeIcon className="absolute left-3 top-2.5 text-gray-400" size={18} /></div></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#5CA4B8] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors flex items-center justify-center">{isSubmitting ? 'Guardando...' : 'Guardar Contraseña'}</button>
            </form>
          </>
        )
      case 'SUCCESS':
          return (
            <div className="text-center">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
                <h2 className="mt-4 text-xl font-semibold text-[#1B4965]">¡Listo!</h2>
                <div className="bg-green-50 text-green-800 p-4 rounded-lg my-6">
                    {successMessage}
                </div>
            </div>
          )
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-16">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          {renderContent()}
          <div className="mt-6 text-center">
            <a href="/login" className="text-sm text-[#62B6CB] hover:text-[#1B4965] flex items-center justify-center">
              <ArrowLeftIcon size={14} className="mr-2" /> Volver al inicio de sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}