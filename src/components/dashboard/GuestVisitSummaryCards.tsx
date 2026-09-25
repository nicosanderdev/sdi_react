import { Eye, FileText, Percent, Share2 } from 'lucide-react';
import { DashboardStatCard } from './DashboardStatCard';
import {
  GUEST_TRAFFIC_SOURCES,
  getGuestTrafficSourceLabelEs,
  type GuestTrafficSource,
} from '../../types/guestVisitContract';

export type GuestVisitSummaryMode = 'admin' | 'owner';

export interface GuestVisitSummaryData {
  propertyViews?: number | null;
  pageViews?: number | null;
  conversionRate?: number | null;
  traffic?: Partial<Record<GuestTrafficSource, number>> | null;
}

interface GuestVisitSummaryCardsProps {
  mode: GuestVisitSummaryMode;
  data?: GuestVisitSummaryData | null;
  loading?: boolean;
  className?: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('es-ES');
};

export function GuestVisitSummaryCards({
  mode,
  data,
  loading = false,
  className = '',
}: GuestVisitSummaryCardsProps) {
  const dash = '—';

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: mode === 'admin' ? 4 : 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Vistas de propiedades',
      value:
        data?.propertyViews != null ? formatNumber(data.propertyViews) : dash,
      icon: Eye,
      show: true,
    },
    {
      title: 'Vistas de páginas',
      value: data?.pageViews != null ? formatNumber(data.pageViews) : dash,
      icon: FileText,
      show: mode === 'admin',
    },
    {
      title: 'Tasa de conversión',
      value:
        data?.conversionRate != null
          ? `${Number(data.conversionRate).toFixed(1)}%`
          : dash,
      icon: Percent,
      show: true,
    },
  ];

  const traffic = data?.traffic;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {cards
        .filter((c) => c.show)
        .map((card) => {
          const Icon = card.icon;
          return (
            <DashboardStatCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={Icon}
            />
          );
        })}

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
          {GUEST_TRAFFIC_SOURCES.map((source) => {
            const value = traffic?.[source];
            return (
              <div key={source} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {getGuestTrafficSourceLabelEs(source)}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {value != null ? formatNumber(value) : dash}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
