import { CalendarCheck, Shield, MessageCircle } from 'lucide-react';
import { PublicSection } from './PublicSection';
import { EditorialTitle } from './EditorialTitle';

export function ConnectSection() {
  const features = [
    {
      icon: <CalendarCheck className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Menos idas y vueltas',
      description:
        'La disponibilidad y las condiciones quedan en la ficha, listas para quien quiere reservar.',
    },
    {
      icon: <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'El control sigue siendo tuyo',
      description:
        'Vos decidís precios, reglas y qué se publica de tu casa o de tu espacio.',
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Respuesta directa',
      description:
        'Las consultas de huéspedes y de organizadores llegan al mismo lugar.',
    },
  ];

  return (
    <PublicSection background="white">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <EditorialTitle
            as="h2"
            lead="Diseñado para facilitar tus"
            emphasis="alquileres"
            className="text-4xl md:text-5xl mb-6"
          />
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Si tenés una casa por temporada o un salón para eventos, el panel concentra la publicación para que no armes el anuncio en varios lados:
          </p>

          <div className="space-y-4">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <img
            src="/images/hero-portals.jpg"
            alt="Espacio listo para publicar en alquiler"
            className="rounded-3xl shadow-2xl w-full h-[28rem] object-cover"
          />
        </div>
      </div>
    </PublicSection>
  );
}
