import React from 'react';
import { LucideIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from 'lucide-react';

interface DashboardStatCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'increase' | 'decrease' | 'neutral';
    label?: string;
  };
  className?: string;
}

export function DashboardStatCard({
  title,
  value,
  icon: Icon,
  trend,
  className = ''
}: DashboardStatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;

    switch (trend.direction) {
      case 'increase':
        return <TrendingUpIcon className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'decrease':
        return <TrendingDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'neutral':
      default:
        return <MinusIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';

    switch (trend.direction) {
      case 'increase':
        return 'text-green-600 dark:text-green-400';
      case 'decrease':
        return 'text-red-600 dark:text-red-400';
      case 'neutral':
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <Icon className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {value}
      </div>

      {trend && (
        <div className="flex items-center space-x-1">
          {getTrendIcon()}
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
          </span>
          {trend.label && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
