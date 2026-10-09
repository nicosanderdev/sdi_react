import { Fragment } from 'react';
import { TrendingUpIcon, TrendingDownIcon, ArrowRightIcon } from 'lucide-react';
import { PropertyVisitStat } from '../../services/ReportService';
import { getListingTypeLabelEs } from '../../models/properties/propertyTypeLabels';

interface PropertiesPerformanceTableProps {
  properties: PropertyVisitStat[];
  /** When true, show per-site visit/holds/conversion breakdown under each property. */
  showBySite?: boolean;
}

export function PropertiesPerformanceTable({ properties, showBySite = false }: PropertiesPerformanceTableProps) {
  const getTrendIcon = (trend?: 'up' | 'down' | 'flat') => {
    if (trend === 'up') {
      return <TrendingUpIcon size={16} className="text-green-600" />;
    }
    if (trend === 'down') {
      return <TrendingDownIcon size={16} className="text-red-600" />;
    }
    if (trend === 'flat') {
      return <ArrowRightIcon size={16} className="text-yellow-600" />;
    }
    return <span className="text-gray-400">-</span>;
  };

  if (!properties || properties.length === 0) {
    return (
      <div
        data-testid="properties-performance-empty"
        className="text-center py-10 text-gray-500"
      >
        No hay datos de rendimiento de propiedades para mostrar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table data-testid="properties-performance-table" className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Propiedad
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Visitas
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Mensajes
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conversión
            </th>
          </tr>
        </thead>
        <tbody className="bg-[#FDFFFC] divide-y divide-gray-200">
          {properties.map(property => (
            <Fragment key={property.propertyId}>
              <tr
                data-testid={`property-performance-row-${property.propertyId}`}
                className="hover:bg-gray-50 transition-colors duration-150"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-[#1B4965] line-clamp-1" title={property.propertyTitle}>
                      {property.propertyTitle || 'N/A'}
                    </div>
                    {property.address && (
                      <div className="text-sm text-gray-500 line-clamp-1" title={property.address}>
                        {property.address}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {property.status ? (
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      property.status.toLowerCase().includes('venta') ? 'bg-[#5CA4B8] text-[#FDFFFC]' :
                      property.status.toLowerCase().includes('alquiler') ? 'bg-[#BEE9E8] text-[#1B4965]' :
                      property.status.toLowerCase().includes('reservada') ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {property.status}
                    </span>
                  ) : <span className="text-gray-400">-</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-[#1B4965]">
                    {property.price || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center">
                    <span className="text-sm font-medium text-[#1B4965] mr-2">
                      {property.visitCount ?? '-'}
                    </span>
                    {getTrendIcon(property.visitsTrend)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center">
                    <span className="text-sm font-medium text-[#1B4965] mr-2">
                      {property.messages ?? '-'}
                    </span>
                    {getTrendIcon(property.messagesTrend)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center">
                    <span className="text-sm font-medium text-[#1B4965] mr-2">
                      {property.conversion || '-'}
                    </span>
                    {getTrendIcon(property.conversionTrend)}
                  </div>
                </td>
              </tr>
              {showBySite && property.bySite && property.bySite.length > 0 && (
                <tr className="bg-gray-50/80">
                  <td colSpan={6} className="px-6 py-3">
                    <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                      {property.bySite.map((site) => (
                        <div
                          key={site.listingType}
                          className="inline-flex flex-col gap-0.5 rounded-md border border-gray-200 bg-white px-3 py-2"
                        >
                          <span className="font-semibold text-[#1B4965]">
                            {getListingTypeLabelEs(site.listingType)}
                          </span>
                          <span>Visitas: {site.visitCount}</span>
                          <span>Inicios de reserva: {site.holds}</span>
                          <span>Conversión: {site.conversion}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
