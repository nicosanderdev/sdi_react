import React from 'react';
import { Network } from 'lucide-react';
export function ConnectSection() {
  return <section className="py-20 bg-[#BEE9E8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-[#1B4965] mb-6">
              Conectamos inmobiliarias con compradores reales
            </h2>
            <p className="text-lg text-[#101828] mb-8">
              Nuestro sistema funciona como una red de sitios inmobiliarios
              conectados por una misma API, lo que permite que:
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <Network className="text-[#62B6CB] mr-3 mt-1" size={24} />
                <span className="text-[#101828]">
                  Tus propiedades lleguen a más personas sin duplicar esfuerzos.
                </span>
              </li>
              <li className="flex items-start">
                <Network className="text-[#62B6CB] mr-3 mt-1" size={24} />
                <span className="text-[#101828]">
                  Tu sitio esté siempre actualizado, seguro y optimizado.
                </span>
              </li>
              <li className="flex items-start">
                <Network className="text-[#62B6CB] mr-3 mt-1" size={24} />
                <span className="text-[#101828]">
                  Los usuarios encuentren lo que buscan, y se comuniquen
                  directamente contigo.
                </span>
              </li>
            </ul>
          </div>
          <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold text-[#1B4965] mb-6">
              Para quienes buscan su próxima casa
            </h3>
            <p className="text-[#101828] mb-8">
              Nuestro buscador permite a cualquier persona explorar casas,
              departamentos o terrenos en venta y en alquiler. Cada propiedad
              muestra información clara y completa, con enlaces directos al
              sitio de la inmobiliaria que la gestiona.
            </p>
            <a href="/search" className="inline-block bg-[#62B6CB] text-[#FDFFFC] px-6 py-3 rounded-md hover:opacity-90 transition-colors">
              Explorar propiedades
            </a>
          </div>
        </div>
      </div>
    </section>;
}