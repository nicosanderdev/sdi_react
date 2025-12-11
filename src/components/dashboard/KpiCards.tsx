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
  Flag,
  AlertCircle
} from 'lucide-react';
import { AdminMetricsSummary } from '../../services/AdminService';

interface KpiCardsProps {
  data: AdminMetricsSummary;
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

// Helper to get trend direction based on comparison
const getTrendDirection = (current: number, previous?: number): 'increase' | 'decrease' | 'neutral' => {
  if (!previous || previous === 0) return 'neutral';
  const change = ((current - previous) / previous) * 100;
  if (change > 5) return 'increase';
  if (change < -5) return 'decrease';
  return 'neutral';
};

export const KpiCards: React.FC<KpiCardsProps> = ({
  data,
  loading = false,
  className = ''
}) => {
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
      title: 'Total Users',
      value: formatNumber(data.totalUsers),
      icon: Users,
      // For now, showing neutral trend - in real implementation, would compare with previous period
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'vs last period'
      }
    },
    {
      title: 'Total Properties',
      value: formatNumber(data.totalProperties),
      icon: Building,
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'vs last period'
      }
    },
    {
      title: 'Active Users (7d)',
      value: formatNumber(data.activeUsers7d),
      icon: UserCheck,
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'vs prev 7d'
      }
    },
    {
      title: 'Active Users (30d)',
      value: formatNumber(data.activeUsers30d),
      icon: UserCheck,
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'vs prev 30d'
      }
    },
    {
      title: 'Active Properties (7d)',
      value: formatNumber(data.activeProperties7d),
      icon: Building2,
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'vs prev 7d'
      }
    },
    {
      title: 'Active Properties (30d)',
      value: formatNumber(data.activeProperties30d),
      icon: Building2,
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'vs prev 30d'
      }
    },
    {
      title: 'New Users',
      value: formatNumber(data.newUsers),
      icon: UserPlus,
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'this period'
      }
    },
    {
      title: 'New Properties',
      value: formatNumber(data.newProperties),
      icon: Plus,
      trend: {
        value: 0,
        direction: 'neutral' as const,
        label: 'this period'
      }
    },
    {
      title: 'Pending Approvals',
      value: formatNumber(data.pendingApprovals),
      icon: AlertTriangle,
      trend: undefined // Operational metrics might not have trends
    },
    {
      title: 'Open Flags',
      value: formatNumber(data.flagsOpen),
      icon: Flag,
      trend: undefined
    },
    ...(data.failedJobs !== undefined ? [{
      title: 'Failed Jobs',
      value: formatNumber(data.failedJobs),
      icon: AlertCircle,
      trend: undefined
    }] : [])
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
