import React from 'react';
import { Home, Landmark } from 'lucide-react';
import { Button } from 'flowbite-react';
import { PublicSection } from './PublicSection';

export function PortalsSection() {
  const portals = [
    {
      icon: <Home className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Alquiler de casas temporales',
      description:
        'Gestiona viviendas para estancias cortas: calendarios, tarifas, descripción y disponibilidad en un portal dedicado al alquiler por temporadas.',
      ctaLabel: 'Explorar',
      ctaHref: '/contact',
    },
    {
      icon: <Landmark className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Alquiler de espacios para eventos',
      description:
        'Publica salones, fincas y venues para celebraciones y encuentros. Centraliza consultas, condiciones y reservas en el portal de eventos.',
      ctaLabel: 'Ver más',
      ctaHref: '/pricing',
    },
  ];

  return (
    <PublicSection background="white">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Nuestros portales
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Dos líneas de negocio, una misma herramienta: administra catálogos, propiedades y la relación con tus clientes.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {portals.map((portal) => (
          <div
            key={portal.title}
            className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6">
              {portal.icon}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {portal.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed flex-grow mb-6">
              {portal.description}
            </p>
            <Button
              href={portal.ctaHref}
              color="green"
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              {portal.ctaLabel}
            </Button>
          </div>
        ))}
      </div>
    </PublicSection>
  );
}
