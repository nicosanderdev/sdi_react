import React from 'react';

interface DashboardPageTitleProps {
  title: string;
  className?: string;
}

const DashboardPageTitle: React.FC<DashboardPageTitleProps> = ({ 
  title, 
  className = "" 
}) => {
  return (
    <h1 className={`text-2xl font-bold text-primary-900 dark:text-primary-50 mb-3 ${className}`}>
      {title}
    </h1>
  );
};

export default DashboardPageTitle;
