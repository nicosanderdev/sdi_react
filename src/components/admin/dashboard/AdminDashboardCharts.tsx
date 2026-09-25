import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardChartCard } from '../../dashboard/DashboardChartCard';
import type { AdminDashboardCharts as DashboardChartData } from '../../../services/AdminService';
import type { GuestSiteFilterValue } from '../../dashboard/GuestSiteFilter';
import { getListingTypeLabelEs } from '../../../models/properties/propertyTypeLabels';
import {
  GUEST_CONTENT_PAGE_LABELS_ES,
  GUEST_TRAFFIC_SOURCES,
  getGuestTrafficSourceLabelEs,
  type GuestTrackedListingType,
} from '../../../types/guestVisitContract';

const SITE_ORDER: readonly GuestTrackedListingType[] = ['SummerRent', 'EventVenue'];
const SITE_COLOR: Record<GuestTrackedListingType, string> = {
  SummerRent: '#1B4965',
  EventVenue: '#62B6CB',
};
const SINGLE_BAR_COLOR = '#1B4965';

interface AdminDashboardChartsProps {
  data: DashboardChartData | null;
  loading?: boolean;
  listingType?: GuestSiteFilterValue;
  className?: string;
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-80 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      No se pudieron cargar los datos
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-80 animate-pulse">
      <div className="flex justify-between items-end h-full space-x-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-gray-200 dark:bg-gray-700 rounded-t flex-1"
            style={{ height: `${40 + (index % 3) * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryBars({
  data,
  series,
  layout = 'horizontal',
  tiltLabels = false,
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ dataKey: string; name: string; color: string }>;
  layout?: 'horizontal' | 'vertical';
  tiltLabels?: boolean;
}) {
  const horizontalBars = layout === 'vertical';
  const height = horizontalBars ? Math.max(280, data.length * 36 + 24) : 320;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontalBars ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, left: horizontalBars ? 8 : 0, bottom: tiltLabels ? 24 : 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          {horizontalBars ? (
            <>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis
                type="category"
                dataKey="label"
                width={128}
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                interval={0}
                angle={tiltLabels ? -25 : 0}
                textAnchor={tiltLabels ? 'end' : 'middle'}
                height={tiltLabels ? 56 : 30}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
            </>
          )}
          <Tooltip content={<ChartTooltip />} />
          {series.length > 1 && (
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
          )}
          {series.map((item) => (
            <Bar
              key={item.dataKey}
              dataKey={item.dataKey}
              name={item.name}
              fill={item.color}
              maxBarSize={48}
              radius={horizontalBars ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const AdminDashboardCharts: React.FC<AdminDashboardChartsProps> = ({
  data,
  loading = false,
  listingType = null,
  className = '',
}) => {
  const visitSites = useMemo(
    () => (listingType == null ? [...SITE_ORDER] : [listingType]),
    [listingType]
  );

  const planData = useMemo(
    () => (data?.plans ?? []).map((plan) => ({ label: plan.name, value: plan.users })),
    [data]
  );

  const propertyData = useMemo(
    () =>
      SITE_ORDER.map((site) => ({
        label: getListingTypeLabelEs(site),
        value: data?.properties[site] ?? 0,
      })),
    [data]
  );

  const propertyViewData = useMemo(
    () =>
      visitSites.map((site) => ({
        label: getListingTypeLabelEs(site),
        value: data?.propertyViewsBySite[site] ?? 0,
      })),
    [data, visitSites]
  );

  const pageViewData = useMemo(
    () =>
      (data?.pageViews ?? []).map((page) => {
        const row: Record<string, string | number> = {
          label: GUEST_CONTENT_PAGE_LABELS_ES[page.pageKey],
        };
        for (const site of visitSites) {
          row[site] = page[site] ?? 0;
        }
        return row;
      }),
    [data, visitSites]
  );

  const trafficData = useMemo(
    () =>
      GUEST_TRAFFIC_SOURCES.map((source) => ({
        label: getGuestTrafficSourceLabelEs(source),
        value: data?.traffic[source] ?? 0,
      })),
    [data]
  );

  const siteSeries = visitSites.map((site) => ({
    dataKey: site,
    name: getListingTypeLabelEs(site),
    color: SITE_COLOR[site],
  }));

  const countSeries = (name: string) => [
    { dataKey: 'value', name, color: SINGLE_BAR_COLOR },
  ];

  const cards: Array<{ id: string; title: string; body: React.ReactNode }> = [
    {
      id: 'plans',
      title: 'Usuarios por plan',
      body: loading ? <ChartSkeleton /> : data ? (
        <CategoryBars data={planData} series={countSeries('Usuarios')} layout="vertical" />
      ) : <EmptyChart />,
    },
    {
      id: 'properties',
      title: 'Propiedades por tipo',
      body: loading ? <ChartSkeleton /> : data ? (
        <CategoryBars data={propertyData} series={countSeries('Propiedades')} />
      ) : <EmptyChart />,
    },
    {
      id: 'property-views',
      title: 'Vistas de propiedades por sitio',
      body: loading ? <ChartSkeleton /> : data ? (
        <CategoryBars data={propertyViewData} series={countSeries('Vistas')} />
      ) : <EmptyChart />,
    },
    {
      id: 'page-views',
      title: 'Vistas de páginas por sitio',
      body: loading ? <ChartSkeleton /> : data ? (
        <CategoryBars data={pageViewData} series={siteSeries} tiltLabels />
      ) : <EmptyChart />,
    },
    {
      id: 'traffic',
      title: 'Origen del tráfico',
      body: loading ? <ChartSkeleton /> : data ? (
        <CategoryBars data={trafficData} series={countSeries('Vistas')} tiltLabels />
      ) : <EmptyChart />,
    },
  ];

  return (
    <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${className}`}>
      {cards.map((card) => (
        <div key={card.id} data-testid={`admin-chart-${card.id}`}>
          <DashboardChartCard title={card.title}>{card.body}</DashboardChartCard>
        </div>
      ))}
    </div>
  );
};
