import { Button } from 'flowbite-react';
import { Link } from 'react-router-dom';
import { EditorialTitle } from './EditorialTitle';

export type HeroSectionCtaProps = {
  contactLabel: string;
  contactTo: string;
  demoLabel: string;
  demoTo: string;
  publishLabel: string;
  publishTo: string;
  plansLabel: string;
  plansTo: string;
};

const TRUST = ['Calendario en un solo lugar', 'Fotos, precios y reglas', 'Casas y espacios para eventos'];

export function HeroSection({ publishLabel, publishTo, demoLabel, demoTo }: HeroSectionCtaProps) {
  return (
    <section className="relative overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center py-12 lg:py-16 lg:min-h-[min(100svh,42rem)]">
          <div className="lg:hidden relative -mx-6 md:-mx-8 aspect-[5/4] overflow-hidden">
            <img
              src="/images/hero-portals.jpg"
              alt="Casa con espacio al aire libre"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>

          <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center">
            <p className="m-0 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-green-700 dark:text-green-400">
              <span className="inline-block h-px w-8 bg-green-600 dark:bg-green-400" aria-hidden />
              Para dueños
            </p>
            <EditorialTitle
              as="h1"
              lead="Publicá"
              emphasis="tu casa"
              trail=" o tu espacio"
              className="mt-4 text-[clamp(2.1rem,4.2vw,3.75rem)] leading-[1.08] max-w-[14ch]"
            />
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-md">
              Cargá fotos, precios y disponibilidad, y seguí las reservas de tu alquiler desde un solo panel.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-4">
              <Button as={Link} to={publishTo} color="green" size="xl" className="rounded-full">
                {publishLabel}
              </Button>
              <Button as={Link} to={demoTo} color="alternative" size="xl" className="rounded-full dark:bg-gray-950! dark:hover:bg-green-800!">
                {demoLabel}
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 list-none p-0 m-0">
              {TRUST.map((item) => (
                <li key={item} className="text-sm font-medium text-gray-700 dark:text-gray-300 before:content-['✓'] before:text-green-600 before:mr-2 before:font-bold dark:before:text-green-400">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden lg:block lg:col-span-6 xl:col-span-7 relative h-[min(32rem,62vh)]">
            <div className="absolute right-0 top-0 bottom-6 w-[88%] overflow-hidden rounded-bl-[2.5rem]">
              <img
                src="/images/hero-portals.jpg"
                alt="Casa con espacio al aire libre"
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
