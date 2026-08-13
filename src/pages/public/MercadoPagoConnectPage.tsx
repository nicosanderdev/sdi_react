import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Spinner } from 'flowbite-react';

type StartState = 'loading' | 'redirecting' | 'error';

export const MercadoPagoConnectPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() || '', [params]);
  const [state, setState] = useState<StartState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!token) {
        setState('error');
        setErrorMessage('Falta el token del enlace. Pedile a un administrador que te envíe uno nuevo.');
        return;
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const response = await fetch(`${supabaseUrl}/functions/v1/mercado-pago-connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          authorizationUrl?: string;
          error?: string;
          error_code?: string;
        };

        if (!response.ok || !payload.authorizationUrl) {
          if (!cancelled) {
            setState('error');
            setErrorMessage(mapConnectError(payload.error_code, payload.error));
          }
          return;
        }

        if (!cancelled) {
          setState('redirecting');
          window.location.assign(payload.authorizationUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'No se pudo iniciar la conexión con Mercado Pago.',
          );
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Conectar con Mercado Pago
        </h1>
        {state === 'loading' || state === 'redirecting' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Spinner size="lg" />
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
              {state === 'redirecting'
                ? 'Redirigiendo a Mercado Pago…'
                : 'Validando tu enlace…'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              El enlace es de un solo uso y vence a los 10 minutos. Pedile a un administrador que te
              envíe uno nuevo por WhatsApp.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

function mapConnectError(code?: string, fallback?: string): string {
  switch (code) {
    case 'LINK_EXPIRED':
      return 'Este enlace expiró. Pedí uno nuevo (válido por 10 minutos).';
    case 'LINK_USED':
      return 'Este enlace ya fue utilizado.';
    case 'LINK_REVOKED':
      return 'Este enlace fue revocado.';
    case 'ALREADY_CONNECTED':
      return 'Tu cuenta ya está conectada a Mercado Pago.';
    case 'INVALID_LINK':
    case 'MISSING_TOKEN':
      return 'El enlace no es válido.';
    default:
      return fallback || 'No se pudo iniciar la conexión con Mercado Pago.';
  }
}

export default MercadoPagoConnectPage;
