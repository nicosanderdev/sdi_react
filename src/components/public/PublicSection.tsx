import React from 'react';

interface PublicSectionProps {
  children: React.ReactNode;
  className?: string;
  background?: 'white' | 'gray' | 'gradient';
}

export function PublicSection({ children, className = '', background = 'white' }: PublicSectionProps) {
  const getBackgroundClasses = () => {
    switch (background) {
    case 'gray':
        return 'bg-gray-50 dark:bg-gray-800';
      case 'gradient':
        return 'bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800';
      case 'white':
      default:
        return 'bg-white dark:bg-gray-900';
    }
  };

  return (
    <section className={`${getBackgroundClasses()} py-16 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </section>
  );
}
