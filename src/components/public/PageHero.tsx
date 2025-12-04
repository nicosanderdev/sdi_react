import React from 'react';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  primaryCta?: {
    text: string;
    href: string;
  };
  secondaryCta?: {
    text: string;
    href: string;
  };
  children?: React.ReactNode;
}

export function PageHero({ title, subtitle, primaryCta, secondaryCta, children }: PageHeroProps) {
  return (
    <section className="bg-white dark:bg-gray-900 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
        {(primaryCta || secondaryCta) && (
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            {primaryCta && (
              <a
                href={primaryCta.href}
                className="bg-green-600 text-white px-8 py-4 rounded-xl hover:bg-green-700 transition-colors text-lg font-semibold shadow-md"
              >
                {primaryCta.text}
              </a>
            )}
            {secondaryCta && (
              <a
                href={secondaryCta.href}
                className="border-2 border-green-600 text-green-600 dark:text-green-400 px-8 py-4 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-lg font-semibold"
              >
                {secondaryCta.text}
              </a>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
