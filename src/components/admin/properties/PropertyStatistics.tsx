// src/components/admin/properties/PropertyStatistics.tsx
import React from 'react';
import { HomeIcon, EyeIcon, EyeOffIcon, ArchiveIcon, AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';

interface PropertyStatisticsProps {
  hook: UseAdminPropertiesReturn;
}

interface StatCardProps {
  title: string;
  value: number | null;
  description: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  color,
  loading = false
}) => {
  const getBgColor = (colorName: string) => {
    switch (colorName) {
      case 'blue': return 'bg-blue-50 dark:bg-blue-900/20';
      case 'green': return 'bg-green-50 dark:bg-green-900/20';
      case 'yellow': return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'red': return 'bg-red-50 dark:bg-red-900/20';
      case 'gray': return 'bg-gray-50 dark:bg-gray-900/20';
      default: return 'bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getTextColor = (colorName: string) => {
    switch (colorName) {
      case 'blue': return 'text-blue-600 dark:text-blue-400';
      case 'green': return 'text-green-600 dark:text-green-400';
      case 'yellow': return 'text-yellow-600 dark:text-yellow-400';
      case 'red': return 'text-red-600 dark:text-red-400';
      case 'gray': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </p>
        </div>
        <div className={`p-2 ${getBgColor(color)} rounded-lg`}>
          {loading ? (
            <Loader2Icon className={`w-6 h-6 ${getTextColor(color)} animate-spin`} />
          ) : (
            <div className={getTextColor(color)}>
              {icon}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {loading ? '...' : (value ?? 0).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export const PropertyStatistics: React.FC<PropertyStatisticsProps> = ({ hook }) => {
  const { statistics, statisticsLoading } = hook;

  const statCards = [
    {
      title: 'Total Properties',
      value: statistics?.totalProperties ?? null,
      description: 'All properties in system',
      icon: <HomeIcon className="w-6 h-6" />,
      color: 'blue',
    },
    {
      title: 'Active Properties',
      value: statistics?.activeProperties ?? null,
      description: 'Visible and active listings',
      icon: <EyeIcon className="w-6 h-6" />,
      color: 'green',
    },
    {
      title: 'Incomplete Properties',
      value: statistics?.incompleteProperties ?? null,
      description: 'Not yet activated',
      icon: <AlertTriangleIcon className="w-6 h-6" />,
      color: 'yellow',
    },
    {
      title: 'Never Published',
      value: statistics?.neverPublished ?? null,
      description: 'Hidden from public view',
      icon: <EyeOffIcon className="w-6 h-6" />,
      color: 'red',
    },
    {
      title: 'Archived Properties',
      value: statistics?.archivedProperties ?? null,
      description: 'Inactive and hidden',
      icon: <ArchiveIcon className="w-6 h-6" />,
      color: 'gray',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {statCards.map((card, index) => (
        <StatCard
          key={index}
          title={card.title}
          value={card.value}
          description={card.description}
          icon={card.icon}
          color={card.color}
          loading={statisticsLoading}
        />
      ))}
    </div>
  );
};
