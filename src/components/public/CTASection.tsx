import { Link } from 'react-router-dom';
import type { HeroSectionCtaProps } from './HeroSection';

export function CTASection({ contactLabel, contactTo, plansLabel, plansTo }: HeroSectionCtaProps) {
  return (
    <section className="bg-green-700 dark:bg-green-800 py-20 md:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-6">
          Tenés espacios o <span className="font-bold">casas?</span>
        </h2>
        <p className="text-xl mb-12 text-green-50 max-w-2xl mx-auto">
          Publicá la casa o el salón y seguí las reservas desde el panel.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to={contactTo}
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 font-semibold text-green-800 hover:bg-green-50"
          >
            {contactLabel}
          </Link>
          <Link
            to={plansTo}
            className="inline-flex items-center justify-center rounded-full border-2 border-white px-8 py-3 font-semibold text-white hover:bg-white hover:text-green-800"
          >
            {plansLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
