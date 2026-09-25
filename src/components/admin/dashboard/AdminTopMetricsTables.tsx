import React from 'react';
import { getListingTypeLabelEs } from '../../../models/properties/propertyTypeLabels';
import type { GuestTrackedListingType } from '../../../types/guestVisitContract';

export interface TopViewedProperty {
  rank: number;
  name: string;
  visits: number;
  listingType?: GuestTrackedListingType | null;
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
  listingType?: GuestTrackedListingType | null;
}
interface AdminTopMetricsTablesProps {
  topViewed?: TopViewedProperty[];
  topBooked?: TopBookedProperty[];
  topConversion?: TopConversionProperty[];
  /** When true, append site label to property names that include listingType. */
  showSiteLabel?: boolean;
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
function formatPropertyName(
  name: string,
  listingType: GuestTrackedListingType | null | undefined,
  showSiteLabel: boolean
): string {
  if (!showSiteLabel || !listingType) return name;
  return `${name} (${getListingTypeLabelEs(listingType)})`;
}

export const AdminTopMetricsTables: React.FC<AdminTopMetricsTablesProps> = ({
  topViewed = placeholderViewed,
  topBooked = placeholderBooked,
  topConversion = placeholderConversion,
  showSiteLabel = false,
  className = ''
}) => {
  const viewedRows = topViewed.length > 0 ? topViewed : placeholderViewed;
  const conversionRows = topConversion.length > 0 ? topConversion : placeholderConversion;

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
              {viewedRows.slice(0, 3).map((row) => (
                <tr key={`${row.rank}-${row.listingType ?? ''}-${row.name}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatPropertyName(row.name, row.listingType, showSiteLabel)}
                  </td>
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
              {(topBooked.length > 0 ? topBooked : placeholderBooked).slice(0, 3).map((row) => (
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
              {conversionRows.slice(0, 3).map((row) => (
                <tr key={`${row.rank}-${row.listingType ?? ''}-${row.name}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rank}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatPropertyName(row.name, row.listingType, showSiteLabel)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{row.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
