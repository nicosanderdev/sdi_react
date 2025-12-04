import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import AuthService from '../../services/AuthService';
import { AuthCard } from '../public/AuthCard';
import { PublicLayout } from '../layout/PublicLayout';
import { Button } from 'flowbite-react';
import { CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-react';

export function EmailConfirmationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: AuthService.confirmEmail,
    onSuccess: () => {
      // On success, redirect to the dashboard after a short delay
      setTimeout(() => navigate('/dashboard'), 3000);
    },
    onError: (err) => {
      // Log the error for debugging
      console.error('Email confirmation failed:', err);
    },
  });

  useEffect(() => {
    if (token) {
      mutate(token);
    } else {
      // If no token is found, redirect to the login page
      navigate('/login');
    }
  }, [token, mutate, navigate]);

  if (isPending) {
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

  if (isError) {
    const errorMessage =
      (error as any)?.response?.data?.message ||
      'El enlace de confirmación no es válido o ha expirado.';
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

  if (isSuccess) {
    return (
      <PublicLayout>
        <AuthCard
          title="¡Email Confirmado!"
          subtitle="¡Gracias! Serás redirigido al panel de control en breve."
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

