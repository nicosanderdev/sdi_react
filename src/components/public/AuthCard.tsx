import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function AuthCard({ children, title, subtitle, icon }: AuthCardProps) {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-white dark:bg-gray-900 py-16 flex items-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-8">
            {icon && (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full mb-6">
                {icon}
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-600 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
