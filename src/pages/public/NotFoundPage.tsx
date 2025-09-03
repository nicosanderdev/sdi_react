import React from 'react';
import { SearchX } from 'lucide-react'; 
// Make sure the path to your PublicLayout component is correct
import { PublicLayout } from '../../components/public/layout/PublicLayout';

export function NotFoundPage() {
  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center bg-[#FDFFFC]">
        <div className="text-center py-20 px-4 sm:px-6 lg:px-8">
          
          {/* Icon */}
          <SearchX 
            className="mx-auto h-16 w-16 text-[#62B6CB]" 
            aria-hidden="true" 
          />

          {/* Error Code */}
          <h1 className="mt-6 text-5xl md:text-6xl font-bold text-[#1B4965] tracking-tight">
            Error 404
          </h1>

          {/* Main Message */}
          <h2 className="mt-4 text-2xl md:text-3xl font-semibold text-[#1B4965]">
            Página no encontrada
          </h2>
          
          {/* Helper Text */}
          <p className="mt-4 text-base text-[#101828] max-w-md mx-auto">
            Lo sentimos, no pudimos encontrar la página que estás buscando. 
            Es posible que haya sido eliminada, que su nombre haya cambiado o que no esté disponible temporalmente.
          </p>

          {/* Call to Action Button */}
          <div className="mt-10">
            <a
              href="/"
              className="inline-block bg-[#62B6CB] text-[#FDFFFC] px-6 py-3 rounded-md font-semibold hover:opacity-90 transition-colors shadow-sm"
            >
              Volver a la página de inicio
            </a>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}