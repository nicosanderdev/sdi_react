import React from 'react';
import { Building2, Globe, Link, BarChart3 } from 'lucide-react';
import { FeatureCard } from './FeatureCard';
import { PublicSection } from './PublicSection';

export function ServicesSection() {
  const services = [
    {
      icon: <Building2 className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Publica y gestiona propiedades',
      description: 'Carga propiedades con fotos, descripciones, ubicaciones y características. Todo centralizado y accesible desde cualquier dispositivo.'
    },
    {
      icon: <Globe className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Sitio web personalizado',
      description: 'Obtén un sitio web inmobiliario moderno, con tu propio dominio y diseño profesional. Sin necesidad de programadores.'
    },
    {
      icon: <Link className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Conexión automática con nuestro buscador',
      description: 'Tus propiedades aparecerán automáticamente en nuestro portal de búsqueda, donde miles de personas buscan casa cada día.'
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Estadísticas y seguimiento',
      description: 'Visualiza visitas, contactos y rendimiento de tus publicaciones. Mejora tu estrategia con datos reales.'
    }
  ];

  return (
    <PublicSection background="gray">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          ¿Qué puedes hacer con nuestra plataforma?
        </h2>
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