import { HeroSection } from '../../components/public/HeroSection';
import { ServicesSection } from '../../components/public/ServicesSection';
import { ConnectSection } from '../../components/public/ConnectSection';
import { CTASection } from '../../components/public/CTASection';
import { PublicLayout } from '../../components/layout/PublicLayout';

export function HomePage() {
  return (
    <PublicLayout>
      <HeroSection />
      <ServicesSection />
      <ConnectSection />
      <CTASection />
    </PublicLayout>
  );
}