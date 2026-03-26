import React from 'react';
import { LucideIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from 'lucide-react';

export type DashboardStatCardDensity = 'default' | 'compact';

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
  density?: DashboardStatCardDensity;
}

export function DashboardStatCard({
  title,
  value,
  icon: Icon,
  trend,
  className = '',
  density = 'default'
}: DashboardStatCardProps) {
  const isCompact = density === 'compact';
  const trendIconSize = isCompact ? 'w-3 h-3' : 'w-4 h-4';

  const renderTrendIcon = () => {
    if (!trend) return null;

    switch (trend.direction) {
      case 'increase':
        return <TrendingUpIcon className={`${trendIconSize} text-green-600 dark:text-green-400`} />;
      case 'decrease':
        return <TrendingDownIcon className={`${trendIconSize} text-red-600 dark:text-red-400`} />;
      case 'neutral':
      default:
        return <MinusIcon className={`${trendIconSize} text-gray-600 dark:text-gray-400`} />;
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

  const cardPadding = isCompact ? 'p-3 md:p-4' : 'p-4 md:p-6';
  const headerMb = isCompact ? 'mb-2' : 'mb-4';
  const titleClass = isCompact
    ? 'text-sm md:text-base font-medium leading-snug text-gray-900 dark:text-gray-100'
    : 'text-lg font-medium text-gray-900 dark:text-gray-100';
  const iconBoxClass = isCompact
    ? 'p-1.5 bg-green-50 dark:bg-green-900/20 rounded-md shrink-0'
    : 'p-2 bg-green-50 dark:bg-green-900/20 rounded-lg shrink-0';
  const iconClass = isCompact
    ? 'w-5 h-5 text-green-600 dark:text-green-400'
    : 'w-6 h-6 text-green-600 dark:text-green-400';
  const valueMb = isCompact ? (trend ? 'mb-2' : 'mb-1') : 'mb-2';
  const valueExtra = isCompact ? 'leading-tight tracking-tight' : '';
  const trendTextClass = isCompact ? 'text-xs font-medium' : 'text-sm font-medium';
  const trendLabelClass = isCompact ? 'text-xs text-gray-500 dark:text-gray-400' : 'text-sm text-gray-500 dark:text-gray-400';

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm ${cardPadding} ${className}`}
    >
      <div className={`flex items-start justify-between gap-2 ${headerMb}`}>
        <div className="min-w-0 flex-1">
          <h3 className={titleClass}>{title}</h3>
        </div>
        <div className={iconBoxClass}>
          <Icon className={iconClass} />
        </div>
      </div>

      <div className={`text-3xl font-bold text-gray-900 dark:text-white ${valueMb} ${valueExtra}`}>
        {value}
      </div>

      {trend && (
        <div className="flex items-center space-x-1">
          {renderTrendIcon()}
          <span className={`${trendTextClass} ${getTrendColor()}`}>
            {trend.value > 0 ? '+' : ''}
            {trend.value.toFixed(1)}%
          </span>
          {trend.label && <span className={trendLabelClass}>{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
