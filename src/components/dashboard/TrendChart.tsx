import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DashboardChartCard } from './DashboardChartCard';
import { AdminMetricsTimeseries } from '../../services/AdminService';

/** Extended point for optional sessions/bookings (for future wiring) */
export type TrendChartDataPoint = AdminMetricsTimeseries & { sessions?: number; bookings?: number };

interface TrendChartProps {
  data: TrendChartDataPoint[];
  loading?: boolean;
  className?: string;
}

const CHART_TITLE = 'Tendencias de usuarios y propiedades';

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  loading = false,
  className = ''
}) => {
  if (loading) {
    return (
      <DashboardChartCard title={CHART_TITLE} className={className}>
        <div className="h-80 animate-pulse">
          <div className="flex justify-between items-end h-full space-x-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="bg-gray-200 dark:bg-gray-700 rounded-t flex-1"
                style={{ height: `${Math.random() * 60 + 20}%` }}
              />
            ))}
          </div>
        </div>
      </DashboardChartCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <DashboardChartCard title={CHART_TITLE} className={className}>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="text-lg font-medium mb-2">Sin datos disponibles</div>
            <div className="text-sm">Los datos del gráfico aparecerán cuando se recopilen métricas</div>
          </div>
        </div>
      </DashboardChartCard>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    sessions: item.sessions ?? 0,
    bookings: item.bookings ?? 0,
    dateLabel: new Date(item.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    }),
    fullDate: new Date(item.date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            {payload[0]?.payload?.fullDate}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <DashboardChartCard title={CHART_TITLE} className={className}>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '12px' }}
            />
            <Line
              type="monotone"
              dataKey="users"
              name="Usuarios"
              stroke="#1B4965"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#1B4965', strokeWidth: 1, stroke: '#FDFFFC' }}
              activeDot={{ r: 5, fill: '#1B4965', strokeWidth: 2, stroke: '#FDFFFC' }}
            />
            <Line
              type="monotone"
              dataKey="properties"
              name="Propiedades"
              stroke="#62B6CB"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#62B6CB', strokeWidth: 1, stroke: '#FDFFFC' }}
              activeDot={{ r: 5, fill: '#62B6CB', strokeWidth: 2, stroke: '#FDFFFC' }}
            />
            <Line
              type="monotone"
              dataKey="sessions"
              name="Sesiones"
              stroke="#B565A7"
              strokeWidth={2}
              dot={{ r: 2, fill: '#B565A7', strokeWidth: 1, stroke: '#FDFFFC' }}
              activeDot={{ r: 4, fill: '#B565A7', strokeWidth: 2, stroke: '#FDFFFC' }}
            />
            <Line
              type="monotone"
              dataKey="bookings"
              name="Reservas"
              stroke="#5FA8D3"
              strokeWidth={2}
              dot={{ r: 2, fill: '#5FA8D3', strokeWidth: 1, stroke: '#FDFFFC' }}
              activeDot={{ r: 4, fill: '#5FA8D3', strokeWidth: 2, stroke: '#FDFFFC' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardChartCard>
  );
};
