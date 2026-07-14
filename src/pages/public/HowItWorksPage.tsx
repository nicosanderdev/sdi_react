import { PublicLayout } from '../../components/layout/PublicLayout';
import { HowToSection } from '../../components/public/HowToSection';
import { FaqSection } from '../../components/public/FaqSection';

export function HowItWorksPage() {
  return (
    <PublicLayout>
      <HowToSection />
      <FaqSection />
    </PublicLayout>
  );
}
