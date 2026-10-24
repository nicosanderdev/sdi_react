import React from 'react';

interface PublicSectionProps {
  children: React.ReactNode;
  className?: string;
  background?: 'white' | 'gray' | 'gradient' | 'ink';
  id?: string;
}

export function PublicSection({ children, className = '', background = 'white', id }: PublicSectionProps) {
  const getBackgroundClasses = () => {
    switch (background) {
    case 'gray':
        return 'bg-gray-50 dark:bg-gray-950';
      case 'ink':
        return 'bg-gray-900 text-white dark:bg-gray-950';
      case 'gradient':
        return 'bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950';
      case 'white':
      default:
        return 'bg-white dark:bg-gray-900';
    }
  };

  return (
    <section id={id} className={`${getBackgroundClasses()} py-20 md:py-28 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  );
}
