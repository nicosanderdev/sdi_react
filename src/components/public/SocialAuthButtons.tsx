import React from 'react';
import { Button } from 'flowbite-react';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25C22.56 11.45 22.49 10.68 22.36 9.93H12.25V14.4H18.1C17.84 15.93 17.06 17.21 15.82 18.06V20.75H19.46C21.45 18.99 22.56 15.9 22.56 12.25Z" fill="#4285F4" />
    <path d="M12.25 23C15.47 23 18.2 21.94 20.04 20.1L16.4 17.45C15.33 18.15 13.89 18.57 12.25 18.57C9.22 18.57 6.65 16.68 5.68 14.04H1.94V16.81C3.76 20.44 7.69 23 12.25 23Z" fill="#34A853" />
    <path d="M5.68 14.04C5.43 13.34 5.3 12.6 5.3 11.83C5.3 11.05 5.43 10.31 5.68 9.61V6.84H1.94C1.23 8.26 0.85 9.98 0.85 11.83C0.85 13.67 1.23 15.39 1.94 16.81L5.68 14.04Z" fill="#FBBC05" />
    <path d="M12.25 5.18C13.99 5.18 15.26 5.86 15.84 6.4L18.49 3.84C16.69 2.13 14.6 1 12.25 1C7.69 1 3.76 3.56 1.94 7.19L5.68 9.96C6.65 7.32 9.22 5.18 12.25 5.18Z" fill="#EA4335" />
  </svg>
);

type SocialAuthButtonsProps = {
  onGoogle: () => void;
  disabled?: boolean;
  /** When true, shows the Login Terms disclaimer under the buttons. */
  showTermsHint?: boolean;
};

export function SocialAuthButtons({
  onGoogle,
  disabled = false,
  showTermsHint = false,
}: SocialAuthButtonsProps) {
  return (
    <div className="my-6 space-y-3">
      <Button
        type="button"
        onClick={onGoogle}
        color="light"
        className="w-full flex items-center justify-center gap-3"
        disabled={disabled}
      >
        <GoogleIcon />
        Continuar con Google
      </Button>
      {showTermsHint && (
        <p className="text-center text-xs text-gray-600 dark:text-gray-400">
          Al continuar, aceptas los{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline"
          >
            Términos y Condiciones
          </a>
        </p>
      )}
    </div>
  );
}
