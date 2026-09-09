import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from 'flowbite-react';
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';

export const MercadoPagoConnectResultPage: React.FC = () => {
  const [params] = useSearchParams();
  const status = params.get('status') || 'error';
  const reason = params.get('reason') || '';

  const content = useMemo(() => {
    if (status === 'success') {
      return {
        ok: true,
        title: 'Conexión completada',
        body: 'Tu cuenta de Mercado Pago quedó vinculada. Ya podés cobrar las reservas online de tus propiedades.',
      };
    }

    const reasonMessage = mapReason(reason);
    return {
      ok: false,
      title: 'No se pudo completar la conexión',
      body: reasonMessage,
    };
  }, [status, reason]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <div className="flex items-start gap-3 mb-3">
          {content.ok ? (
            <CheckCircle2Icon className="w-7 h-7 text-green-600 shrink-0" />
          ) : (
            <XCircleIcon className="w-7 h-7 text-red-600 shrink-0" />
          )}
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {content.title}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{content.body}</p>
          </div>
        </div>

        {!content.ok && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Pedile a un administrador que te envíe un nuevo enlace por WhatsApp. Cada enlace vence
            a los 10 minutos.
          </p>
        )}

        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          Volver al inicio
        </Link>
      </Card>
    </div>
  );
};

function mapReason(reason: string): string {
  switch (reason) {
    case 'declined':
      return 'Cancelaste o rechazaste la autorización en Mercado Pago.';
    case 'link_expired':
      return 'El enlace expiró o ya no es válido.';
    case 'invalid_state':
    case 'missing_params':
      return 'La respuesta de Mercado Pago no pudo validarse. Probá con un enlace nuevo.';
    case 'store_failed':
    case 'oauth_failed':
      return 'Hubo un problema al guardar la conexión. Pedí un enlace nuevo e intentá otra vez.';
    default:
      return 'No pudimos vincular tu cuenta de Mercado Pago en este momento.';
  }
}

export default MercadoPagoConnectResultPage;
