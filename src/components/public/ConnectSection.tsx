import React from 'react';
import { Network, Users, Shield, MessageCircle } from 'lucide-react';
import { PublicSection } from './PublicSection';

export function ConnectSection() {
  const features = [
    {
      icon: <Network className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Operación conectada',
      description:
        'Sincroniza listados, disponibilidad y comunicación entre ambos portales sin procesos manuales repetidos.',
    },
    {
      icon: <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Confianza y control',
      description:
        'Mantén la información de tus inmuebles y venues ordenada, con trazabilidad y accesos seguros para tu equipo.',
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Canal directo con interesados',
      description:
        'Gestiona consultas y reservas con mensajería integrada para responder con rapidez a huéspedes y organizadores.',
    },
  ];

  return (
    <PublicSection background="white">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Diseñado para arrendadores y gestores de espacios
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Tanto si administras casas por temporadas como salones o venues para eventos, la plataforma concentra la
            gestión para que escales sin perder el control:
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
            Una experiencia clara para quienes reservan
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Cada portal orienta a huéspedes o a organizadores de eventos con información precisa sobre la propiedad
            o el venue, condiciones de alquiler y vías de contacto directas con quien gestiona el anuncio.
          </p>
        </div>
      </div>
    </PublicSection>
  );
}
