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
  // Handle null data case
  if (!data) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
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
    {
      title: 'Total Properties',
      value: formatNumber(data.propertiesCount),
      icon: Building,
      trend: undefined
    },
    {
      title: 'Total Users',
      value: formatNumber(data.usersCount),
      icon: Users,
      trend: undefined
    },
    {
      title: 'Active Users (30d)',
      value: formatNumber(data.activeUsers),
      icon: UserCheck,
      trend: undefined
    },
    {
      title: 'Inactive Users',
      value: formatNumber(data.inactiveUsers),
      icon: UserCheck,
      trend: undefined
    },
    {
      title: 'Active Properties',
      value: formatNumber(data.activeProperties),
      icon: Building2,
      trend: undefined
    },
    {
      title: 'Archived Properties',
      value: formatNumber(data.archivedProperties),
      icon: Archive,
      trend: undefined
    },
    {
      title: 'New Users (7d)',
      value: formatNumber(data.growth.newUsers7d),
      icon: UserPlus,
      trend: undefined
    },
    {
      title: 'New Users (30d)',
      value: formatNumber(data.growth.newUsers30d),
      icon: UserPlus,
      trend: undefined
    },
    {
      title: 'New Properties (7d)',
      value: formatNumber(data.growth.newProperties7d),
      icon: Plus,
      trend: undefined
    },
    {
      title: 'New Properties (30d)',
      value: formatNumber(data.growth.newProperties30d),
      icon: Plus,
      trend: undefined
    },
    {
      title: 'Avg Properties/User',
      value: data.usageStats.avgPropertiesPerUser.toFixed(1),
      icon: BarChart3,
      trend: undefined
    },
    {
      title: 'Users Without Properties',
      value: formatNumber(data.usageStats.usersWithoutProperties),
      icon: AlertTriangle,
      trend: undefined
    }
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
