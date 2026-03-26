import { SearchX, Home } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';
import { Button } from 'flowbite-react';

export function NotFoundPage() {
  return (
    <PublicLayout>
      <PublicSection background="white" className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full mb-8">
            <SearchX className="h-12 w-12 text-green-600 dark:text-green-400" aria-hidden="true" />
          </div>

          {/* Error Code */}
          <h1 className="text-6xl md:text-7xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">
            404
          </h1>

          {/* Main Message */}
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mb-4">
            Página no encontrada
          </h2>

          {/* Helper Text */}
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Lo sentimos, no pudimos encontrar la página que estás buscando.
            Es posible que haya sido eliminada, que su nombre haya cambiado o que no esté disponible temporalmente.
          </p>

          {/* Call to Action Button */}
          <Button
            href="/"
            color="green"
            size="lg"
          >
            <Home className="w-5 h-5 mr-2" />
            Volver al inicio
          </Button>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}