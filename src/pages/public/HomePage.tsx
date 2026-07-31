import { HeroSection } from '../../components/public/HeroSection';
import { PortalsSection } from '../../components/public/PortalsSection';
import { ServicesSection } from '../../components/public/ServicesSection';
import { ConnectSection } from '../../components/public/ConnectSection';
import { CTASection } from '../../components/public/CTASection';
import { PublicLayout } from '../../components/layout/PublicLayout';

const homeCtas = {
  contactLabel: 'Contacto',
  contactTo: '/contact',
  demoLabel: 'Cómo funciona',
  demoTo: '/how-it-works',
} as const;

export function HomePage() {
  return (
    <PublicLayout>
      <HeroSection {...homeCtas} />
      <PortalsSection />
      <ServicesSection />
      <ConnectSection />
      <CTASection {...homeCtas} />
    </PublicLayout>
  );
}