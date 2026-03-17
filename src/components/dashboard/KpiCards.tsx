import React from 'react';
import { DashboardStatCard } from './DashboardStatCard';
import {
  Users,
  Building,
  UserCheck,
  Building2,
  UserPlus,
  Plus,
  AlertTriangle,
  Archive,
  BarChart3
} from 'lucide-react';
import { AdminDashboardStats } from '../../services/AdminService';

interface KpiCardsProps {
  data: AdminDashboardStats | null | undefined;
  loading?: boolean;
  className?: string;
}

// Helper to format numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};


export const KpiCards: React.FC<KpiCardsProps> = ({
  data,
  loading = false,
  className = ''
}) => {
  // Don't render empty cards when there is no data
  if (!data) {
    return null;
  }

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  const kpiCards = [
    { title: 'Propiedades totales', value: formatNumber(data.propertiesCount), icon: Building, trend: undefined },
    { title: 'Usuarios totales', value: formatNumber(data.usersCount), icon: Users, trend: undefined },
    { title: 'Usuarios activos (30 d)', value: formatNumber(data.activeUsers), icon: UserCheck, trend: undefined },
    { title: 'Usuarios inactivos', value: formatNumber(data.inactiveUsers), icon: UserCheck, trend: undefined },
    { title: 'Propiedades activas', value: formatNumber(data.activeProperties), icon: Building2, trend: undefined },
    { title: 'Propiedades archivadas', value: formatNumber(data.archivedProperties), icon: Archive, trend: undefined },
    { title: 'Nuevos usuarios (7 d)', value: formatNumber(data.growth.newUsers7d), icon: UserPlus, trend: undefined },
    { title: 'Nuevos usuarios (30 d)', value: formatNumber(data.growth.newUsers30d), icon: UserPlus, trend: undefined },
    { title: 'Nuevas propiedades (7 d)', value: formatNumber(data.growth.newProperties7d), icon: Plus, trend: undefined },
    { title: 'Nuevas propiedades (30 d)', value: formatNumber(data.growth.newProperties30d), icon: Plus, trend: undefined },
    { title: 'Prom. propiedades por usuario', value: data.usageStats.avgPropertiesPerUser.toFixed(1), icon: BarChart3, trend: undefined },
    { title: 'Usuarios sin propiedades', value: formatNumber(data.usageStats.usersWithoutProperties), icon: AlertTriangle, trend: undefined }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
      {kpiCards.map((card, index) => (
        <DashboardStatCard
          key={index}
          title={card.title}
          value={card.value}
          icon={card.icon}
          trend={card.trend}
        />
      ))}
    </div>
  );
};
