import React from 'react';
import { Building2, Globe, Link, BarChart3 } from 'lucide-react';
import { FeatureCard } from './FeatureCard';
import { PublicSection } from './PublicSection';

export function ServicesSection() {
  const services = [
    {
      icon: <Building2 className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Catálogo unificado de propiedades',
      description:
        'Administra viviendas de alquiler temporal y espacios para eventos con fichas completas: fotos, condiciones, ubicación y reglas de uso desde un único panel.',
    },
    {
      icon: <Globe className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Portales diferenciados',
      description:
        'Mantén la coherencia de marca y al mismo tiempo adapta la experiencia: cada portal refleja su público, sin duplicar herramientas ni datos.',
    },
    {
      icon: <Link className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Publicación y visibilidad',
      description:
        'Actualiza oferta y disponibilidad en tiempo real para que huéspedes y organizadores encuentren lo que necesitan con información clara y fiable.',
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Operación y seguimiento',
      description:
        'Supervisa reservas, mensajes y rendimiento por propiedad o portal para tomar decisiones con datos y reducir fricción en el día a día.',
    },
  ];

  return (
    <PublicSection background="gray">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Todo lo que necesitas para tus portales
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Una plataforma SaaS pensada para quienes gestionan alquileres cortos y venues profesionales.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {services.map((service, index) => (
          <FeatureCard
            key={index}
            icon={service.icon}
            title={service.title}
            description={service.description}
          />
        ))}
      </div>
    </PublicSection>
  );
}
