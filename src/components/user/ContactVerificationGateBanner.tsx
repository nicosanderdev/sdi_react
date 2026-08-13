import { Link } from 'react-router-dom';

interface ContactVerificationGateBannerProps {
  id?: string;
  className?: string;
}

export function ContactVerificationGateBanner({
  id = 'contact-verification-gate',
  className = '',
}: ContactVerificationGateBannerProps) {
  return (
    <div
      id={id}
      className={`mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 ${className}`}
    >
      <p className="text-sm text-amber-800 dark:text-amber-200">
        Antes de crear o editar propiedades o empresas, necesitamos verificar tu correo electrónico y
        teléfono. Esto ayuda a mantener la confianza y la comunicación con los huéspedes.
      </p>
      <Link
        to="/dashboard/profile"
        className="inline-block mt-2 text-sm font-medium text-[#62B6CB] hover:text-[#4a9bb0] underline"
      >
        Ir al perfil para verificar
      </Link>
    </div>
  );
}
