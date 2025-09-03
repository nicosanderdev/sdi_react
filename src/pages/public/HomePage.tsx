import { PublicLayout } from '../../components/public/layout/PublicLayout';
import { HeroSection } from '../../components/public/home/HeroSection';
import { ServicesSection } from '../../components/public/home/ServicesSection';
import { ConnectSection } from '../../components/public/home/ConnectSection';
import { CTASection } from '../../components/public/home/CTASection';

export function HomePage() {
  return (<>
    <PublicLayout>
      <HeroSection />
      <ServicesSection />
      <ConnectSection />
      <CTASection />
    </PublicLayout>;
    </>)
}