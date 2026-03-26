import React from 'react';

/** Optional data for future wiring */
export interface TopViewedProperty {
  rank: number;
  name: string;
  visits: number;
}
export interface TopBookedProperty {
  rank: number;
  name: string;
  bookings: number;
}
export interface TopConversionProperty {
  rank: number;
  name: string;
  rate: string;
}
export interface TopTrafficSource {
  rank: number;
  source: string;
  sessions: number;
}

interface AdminTopMetricsTablesProps {
  topViewed?: TopViewedProperty[];
  topBooked?: TopBookedProperty[];
  topConversion?: TopConversionProperty[];
  topTraffic?: TopTrafficSource[];
  className?: string;
}

const placeholderViewed: TopViewedProperty[] = [
  { rank: 1, name: '—', visits: 0 },
  { rank: 2, name: '—', visits: 0 },
  { rank: 3, name: '—', visits: 0 }
];
const placeholderBooked: TopBookedProperty[] = [
  { rank: 1, name: '—', bookings: 0 },
  { rank: 2, name: '—', bookings: 0 },
  { rank: 3, name: '—', bookings: 0 }
];
const placeholderConversion: TopConversionProperty[] = [
  { rank: 1, name: '—', rate: '—' },
  { rank: 2, name: '—', rate: '—' },
  { rank: 3, name: '—', rate: '—' }
];
const placeholderTraffic: TopTrafficSource[] = [
  { rank: 1, source: '—', sessions: 0 },
  { rank: 2, source: '—', sessions: 0 },
  { rank: 3, source: '—', sessions: 0 }
];

export const AdminTopMetricsTables: React.FC<AdminTopMetricsTablesProps> = ({
  topViewed = placeholderViewed,
  topBooked = placeholderBooked,
  topConversion = placeholderConversion,
  topTraffic = placeholderTraffic,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${className}`}>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Propiedades más vistas
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Propiedad</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visitas</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {topViewed.slice(0, 3).map((row) => (
                <tr key={row.rank} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Propiedades más reservadas
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Propiedad</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reservas</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {topBooked.slice(0, 3).map((row) => (
                <tr key={row.rank} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Propiedades por tasa de conversión
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Propiedad</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tasa</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {topConversion.slice(0, 3).map((row) => (
                <tr key={row.rank} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Principales fuentes de tráfico
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fuente</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sesiones</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {topTraffic.slice(0, 3).map((row) => (
                <tr key={row.rank} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.source}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
