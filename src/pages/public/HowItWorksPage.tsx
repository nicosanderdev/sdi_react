import { Button } from 'flowbite-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { HowToSection } from '../../components/public/HowToSection';
import { FaqSection } from '../../components/public/FaqSection';
import { PublicSection } from '../../components/public/PublicSection';

const PROPERTY_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdT72X21pMCIrJ3_u_YdDCmLJqAAtaIUs17PHt9lKTPipZmtw/viewform?usp=dialog';

export function HowItWorksPage() {
  return (
    <PublicLayout>
      <HowToSection />
      <PublicSection background="white">
        <div className="text-center">
          <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-8 max-w-2xl mx-auto">
            Podés empezar a llenar el formulario para crear una propiedad ahora
          </p>
          <div className="flex justify-center">
            <Button
              as="a"
              href={PROPERTY_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              color="green"
              className="w-auto"
            >
              Completar formulario
            </Button>
          </div>
        </div>
      </PublicSection>
      <FaqSection />
    </PublicLayout>
  );
}
