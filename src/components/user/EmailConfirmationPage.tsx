import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthCard } from '../public/AuthCard';
import { PublicLayout } from '../layout/PublicLayout';
import { Button } from 'flowbite-react';
import { CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-react';
import { supabase } from '../../config/supabase';

export function EmailConfirmationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Supabase automatically handles email confirmation from URL fragments
    // when users click the confirmation link
    const handleEmailConfirmation = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Email confirmation error:', error);
          setErrorMessage(error.message);
          setStatus('error');
          return;
        }

        if (data.session) {
          setStatus('success');
          // Redirect to dashboard after showing success message
          setTimeout(() => navigate('/dashboard'), 3000);
        } else {
          // Check if there are any URL fragments that indicate email confirmation
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            // Email was confirmed, user should be logged in
            setStatus('success');
            setTimeout(() => navigate('/dashboard'), 3000);
          } else {
            setErrorMessage('No se pudo confirmar el email. El enlace puede ser inválido o expirado.');
            setStatus('error');
          }
        }
      } catch (err: any) {
        console.error('Email confirmation failed:', err);
        setErrorMessage('Ocurrió un error durante la confirmación.');
        setStatus('error');
      }
    };

    handleEmailConfirmation();
  }, [navigate]);

  if (status === 'loading') {
    return (
      <PublicLayout>
        <AuthCard
          title="Confirmando tu email..."
          subtitle="Por favor espera un momento."
          icon={<LoaderIcon className="w-8 h-8 text-green-600 dark:text-green-400 animate-spin" />}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-green-600 mx-auto mb-4"></div>
          </div>
        </AuthCard>
      </PublicLayout>
    );
  }

  if (status === 'error') {
    return (
      <PublicLayout>
        <AuthCard
          title="Confirmación Fallida"
          subtitle={errorMessage}
          icon={<XCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />}
        >
          <Button
            onClick={() => navigate('/login')}
            color="failure"
            className="w-full"
          >
            Ir al Inicio de Sesión
          </Button>
        </AuthCard>
      </PublicLayout>
    );
  }

  if (status === 'success') {
    return (
      <PublicLayout>
        <AuthCard
          title="¡Email Confirmado!"
          subtitle="¡Gracias! Tu cuenta ha sido verificada. Serás redirigido al panel de control en breve."
          icon={<CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />}
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full mb-4">
              <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </AuthCard>
      </PublicLayout>
    );
  }

  return null;
};

export default EmailConfirmationPage;

