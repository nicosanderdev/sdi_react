import { Button } from 'flowbite-react';
import { Link } from 'react-router-dom';

export type HeroSectionCtaProps = {
  contactLabel: string;
  contactTo: string;
  demoLabel: string;
};

export function HeroSection({ contactLabel, contactTo, demoLabel }: HeroSectionCtaProps) {
  return (
    <section className="relative min-h-[22rem] sm:min-h-[28rem] flex items-center py-20 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/hero-portals.jpg')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gray-900/65 dark:bg-gray-950/70" aria-hidden />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 drop-shadow-sm">
            Unifica la gestión de tus portales de alquiler
          </h1>
          <p className="text-xl text-gray-100 mb-8">
            Software para administrar propiedades de alquiler temporal y espacios para eventos desde un solo lugar.
          </p>
          <p className="text-lg text-gray-200 mb-12 max-w-2xl mx-auto">
            Publica, coordina reservas y comunica con tus clientes en dos verticales: viviendas por temporadas y venues.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              href={contactTo}
              color="green"
              size="xl"
            >
              {contactLabel}
            </Button>
            <Button
              type="button"
              color="alternative"
              size="xl"
            >
              {demoLabel}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
