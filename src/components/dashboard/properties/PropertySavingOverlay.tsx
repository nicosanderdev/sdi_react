interface PropertySavingOverlayProps {
  show: boolean;
  title?: string;
  message?: string;
}

const DEFAULT_TITLE = 'Registrando la propiedad inmobiliaria';
const DEFAULT_MESSAGE =
  'Esto puede demorar unos segundos. Por favor, no cierres ni abandones esta página.';

export function PropertySavingOverlay({
  show,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
}: PropertySavingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-50">
      <div className="text-center px-6">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#1B4965] mx-auto mb-4" />
        <p className="text-base font-medium text-gray-800 dark:text-gray-200">{title}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">{message}</p>
      </div>
    </div>
  );
}
