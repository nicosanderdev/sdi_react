import React from 'react';
import { Building2Icon, EyeOffIcon, UsersIcon } from 'lucide-react';
import type { AdminCompanyDetailStatistics } from '../../../services/CompanyService';

interface CompanyEditStatisticsProps {
  statistics: AdminCompanyDetailStatistics | null;
  loading?: boolean;
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
  loading = false,
}) => {
  const getBgColor = (colorName: string) => {
    switch (colorName) {
      case 'blue':
        return 'bg-blue-50 dark:bg-blue-900/20';
      case 'green':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'yellow':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getTextColor = (colorName: string) => {
    switch (colorName) {
      case 'blue':
        return 'text-blue-600 dark:text-blue-400';
      case 'green':
        return 'text-green-600 dark:text-green-400';
      case 'yellow':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
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
          <div className={getTextColor(color)}>
            {icon}
          </div>
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

export const CompanyEditStatistics: React.FC<CompanyEditStatisticsProps> = ({
  statistics,
  loading = false,
}) => {
  const statCards = [
    {
      title: 'Propiedades activas',
      value: statistics?.activeOwnedProperties ?? null,
      description: 'Listados visibles y activos a nombre de la compañía',
      icon: <Building2Icon className="w-6 h-6" />,
      color: 'green',
    },
    {
      title: 'Usuarios vinculados',
      value: statistics?.linkedUsers ?? null,
      description: 'Miembros asociados a esta compañía',
      icon: <UsersIcon className="w-6 h-6" />,
      color: 'blue',
    },
    {
      title: 'Sin publicación activa',
      value: statistics?.unpublishedOrInactive ?? null,
      description: 'Inventario de la compañía que no está activo y visible',
      icon: <EyeOffIcon className="w-6 h-6" />,
      color: 'yellow',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {statCards.map((card, index) => (
        <StatCard
          key={index}
          title={card.title}
          value={card.value}
          description={card.description}
          icon={card.icon}
          color={card.color}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default CompanyEditStatistics;
