import React from 'react';
import { DashboardStatCard } from '../../dashboard/DashboardStatCard';
import {
  User,
  Activity,
  CalendarCheck,
  UserPlus,
  Repeat,
  Percent,
  Share2,
  Smartphone,
  Clock,
  MousePointer,
  BarChart3
} from 'lucide-react';

/** Optional data shape for future wiring - all optional for placeholder mode */
export interface AdminAnalyticsData {
  uniqueUsers?: number;
  totalSessions?: number;
  totalBookings?: number;
  newUsers?: number;
  returningUsers?: number;
  conversionRate?: number;
  trafficBySource?: { organic: number; direct: number; social: number; referral: number };
  deviceType?: { mobile: number; desktop: number; tablet: number };
  avgTimeSpentPerPropertyMinutes?: number;
  bounceRatePercent?: number;
  bookingsPer1000Users?: number;
}

interface AdminAnalyticsCardsProps {
  data?: AdminAnalyticsData | null;
  className?: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const AdminAnalyticsCards: React.FC<AdminAnalyticsCardsProps> = ({
  data,
  className = ''
}) => {
  const dash = '—';

  const singleCards = [
    {
      title: 'Usuarios únicos',
      value: data?.uniqueUsers != null ? formatNumber(data.uniqueUsers) : dash,
      icon: User
    },
    {
      title: 'Sesiones totales',
      value: data?.totalSessions != null ? formatNumber(data.totalSessions) : dash,
      icon: Activity
    },
    {
      title: 'Reservas totales',
      value: data?.totalBookings != null ? formatNumber(data.totalBookings) : dash,
      icon: CalendarCheck
    },
    {
      title: 'Usuarios nuevos',
      value: data?.newUsers != null ? formatNumber(data.newUsers) : dash,
      icon: UserPlus
    },
    {
      title: 'Usuarios recurrentes',
      value: data?.returningUsers != null ? formatNumber(data.returningUsers) : dash,
      icon: Repeat
    },
    {
      title: 'Tasa de conversión (reservas)',
      value: data?.conversionRate != null ? `${data.conversionRate.toFixed(1)}%` : dash,
      icon: Percent
    },
    {
      title: 'Tiempo medio por propiedad',
      value:
        data?.avgTimeSpentPerPropertyMinutes != null
          ? `${data.avgTimeSpentPerPropertyMinutes} min`
          : dash,
      icon: Clock
    },
    {
      title: 'Tasa de rebote (páginas de propiedad)',
      value: data?.bounceRatePercent != null ? `${data.bounceRatePercent.toFixed(1)}%` : dash,
      icon: MousePointer
    },
    {
      title: 'Reservas por 1000 usuarios',
      value: data?.bookingsPer1000Users != null ? data.bookingsPer1000Users.toFixed(1) : dash,
      icon: BarChart3
    }
  ];

  const traffic = data?.trafficBySource;
  const device = data?.deviceType;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}>
      {singleCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <DashboardStatCard
            key={index}
            title={card.title}
            value={card.value}
            icon={Icon}
          />
        );
      })}

      {/* Traffic by Source */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Tráfico por fuente
          </h3>
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Share2 className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Orgánico', value: traffic?.organic },
            { label: 'Directo', value: traffic?.direct },
            { label: 'Social', value: traffic?.social },
            { label: 'Referido', value: traffic?.referral }
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{label}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {value != null ? formatNumber(value) : dash}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Device Type */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Dispositivo
          </h3>
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Smartphone className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Móvil', value: device?.mobile },
            { label: 'Escritorio', value: device?.desktop },
            { label: 'Tablet', value: device?.tablet }
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{label}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {value != null ? formatNumber(value) : dash}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
