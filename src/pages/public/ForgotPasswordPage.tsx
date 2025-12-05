import React, { useState } from 'react';
import { MailIcon, CheckCircleIcon, Shield } from 'lucide-react';
import AuthService from '../../services/AuthService';
import { AuthCard } from '../../components/public/AuthCard';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Button, TextInput } from 'flowbite-react';

type PageStep = 'ENTER_EMAIL' | 'SUCCESS';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<PageStep>('ENTER_EMAIL');

  const [email, setEmail] = useState('');

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
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message || 'Error al solicitar restablecimiento de contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Recibirás un enlace para restablecer tu contraseña en tu correo electrónico.
              </p>
            </div>
          </div>
        );
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
        title={step === 'ENTER_EMAIL' ? 'Recuperar Contraseña' : '¡Listo!'}
        subtitle={step === 'ENTER_EMAIL' ? 'Te enviaremos un enlace para restablecer tu contraseña.' : ''}
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