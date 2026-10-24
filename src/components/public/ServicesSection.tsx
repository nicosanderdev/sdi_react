import { Building2, CalendarDays, ImageIcon, MessageCircle } from 'lucide-react';
import { FeatureCard } from './FeatureCard';
import { PublicSection } from './PublicSection';
import { EditorialTitle } from './EditorialTitle';

export function ServicesSection() {
  const services = [
    {
      icon: <Building2 className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'La ficha de tu lugar',
      description:
        'Fotos, condiciones, ubicación y reglas de uso, para una casa o para un espacio de eventos.',
    },
    {
      icon: <CalendarDays className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Tu calendario',
      description:
        'Marcá disponibilidad y tarifas sin repetir el mismo dato en varias planillas.',
    },
    {
      icon: <ImageIcon className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Publicación clara',
      description:
        'Quien busca una estadía o un salón ve lo que ofrecés, con la información que vos cargaste.',
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: 'Reservas y mensajes',
      description:
        'Seguí consultas y reservas de cada propiedad desde el mismo panel.',
    },
  ];

  return (
    <PublicSection background="gray">
      <div className="text-center mb-16">
        <EditorialTitle
          as="h2"
          lead="Todo lo que necesitás para"
          emphasis="publicar"
          className="text-4xl md:text-5xl mb-4"
        />
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          El panel reúne la ficha, el calendario y las reservas de tus alquileres.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {services.map((service) => (
          <FeatureCard
            key={service.title}
            icon={service.icon}
            title={service.title}
            description={service.description}
          />
        ))}
      </div>
    </PublicSection>
  );
}
