import React from 'react';

interface DashboardPageTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

const DashboardPageTitle: React.FC<DashboardPageTitleProps> = ({ 
  title, 
  subtitle,
  className = "" 
}) => {
  return (
    <h1 className={`text-2xl font-bold text-primary-900 dark:text-primary-50 mb-3 ${className}`}>
      {title}
      {subtitle && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {subtitle}
        </p>
      )}
    </h1>
  );
};

export default DashboardPageTitle;
