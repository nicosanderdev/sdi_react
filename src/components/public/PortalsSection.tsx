import { Home, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from 'flowbite-react';
import { PublicSection } from './PublicSection';
import { EditorialTitle } from './EditorialTitle';

export function PortalsSection() {
  const offerings = [
    {
      icon: <Home className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Casas y alquileres',
      description:
        'Publicá una vivienda para estancias cortas: fotos, tarifas, descripción y el calendario de disponibilidad.',
      ctaLabel: 'Publicá tu propiedad',
      ctaHref: '/register',
    },
    {
      icon: <Landmark className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Espacios para eventos',
      description:
        'Publicá un salón, una finca o un venue. Dejá claras la capacidad, las condiciones y cómo te contactan.',
      ctaLabel: 'Publicá tu propiedad',
      ctaHref: '/register',
    },
  ];

  return (
    <PublicSection background="white">
      <div className="text-center mb-16">
        <EditorialTitle
          as="h2"
          lead="Qué podés"
          emphasis="publicar"
          className="text-4xl md:text-5xl mb-4"
        />
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Una casa o un espacio para eventos. Las dos fichas viven en el mismo panel.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {offerings.map((offering) => (
          <div
            key={offering.title}
            className="bg-white dark:bg-gray-950 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full mb-6">
              {offering.icon}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {offering.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed flex-grow mb-6">
              {offering.description}
            </p>
            <Button
              as={Link}
              to={offering.ctaHref}
              color="green"
              className="w-full sm:w-auto rounded-full bg-green-600 hover:bg-green-700"
            >
              {offering.ctaLabel}
            </Button>
          </div>
        ))}
      </div>
    </PublicSection>
  );
}
