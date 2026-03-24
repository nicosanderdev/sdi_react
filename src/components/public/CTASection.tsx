import { Link } from 'react-router-dom';
import { PublicSection } from './PublicSection';
import { Button } from 'flowbite-react';
import type { HeroSectionCtaProps } from './HeroSection';

export function CTASection({ contactLabel, contactTo, demoLabel }: HeroSectionCtaProps) {
  return (
    <PublicSection background="gray">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-6">¿Gestionas portales de alquiler?</h2>
        <p className="text-xl mb-12 text-gray-800 dark:text-gray-600 max-w-2xl mx-auto">
          Encuentra en un solo software la base para administrar viviendas temporales y espacios para eventos, con el
          mismo rigor operativo para ambos.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button as={Link} to={contactTo} color="green">
            {contactLabel}
          </Button>
          <Button type="button" color="alternative">
            {demoLabel}
          </Button>
        </div>
      </div>
    </PublicSection>
  );
}
