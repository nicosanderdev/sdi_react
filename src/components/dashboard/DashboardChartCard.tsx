import React from 'react';

interface DashboardChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardChartCard({
  title,
  children,
  className = ''
}: DashboardChartCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">{title}</h3>
      {children}
    </div>
  );
}
