import React from 'react';
import { Network, Users, Shield, MessageCircle } from 'lucide-react';
import { PublicSection } from './PublicSection';
import { FeatureCard } from './FeatureCard';

export function ConnectSection() {
  const features = [
    {
      icon: <Network className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Red conectada',
      description: 'Tus propiedades lleguen a más personas sin duplicar esfuerzos.'
    },
    {
      icon: <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Seguridad garantizada',
      description: 'Tu sitio esté siempre actualizado, seguro y optimizado.'
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Comunicación directa',
      description: 'Los usuarios encuentren lo que buscan y se comuniquen directamente contigo.'
    }
  ];

  return (
    <PublicSection background="white">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Conectamos inmobiliarias con compradores reales
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Nuestro sistema funciona como una red de sitios inmobiliarios
            conectados por una misma API, lo que permite que:
          </p>

          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {feature.title}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6">
            <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Para quienes buscan su próxima casa
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Nuestro buscador permite a cualquier persona explorar casas,
            departamentos o terrenos en venta y en alquiler. Cada propiedad
            muestra información clara y completa, con enlaces directos al
            sitio de la inmobiliaria que la gestiona.
          </p>
          {/* COMMENTED OUT: for reuse in new project managing public view */}
          {/* <a href="/search" className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold">
            Explorar propiedades
          </a> */}
        </div>
      </div>
    </PublicSection>
  );
}