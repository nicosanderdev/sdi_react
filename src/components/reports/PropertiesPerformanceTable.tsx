// src/components/PropertiesPerformanceTable.tsx
import { DownloadIcon, TrendingUpIcon, TrendingDownIcon, ArrowRightIcon } from 'lucide-react';
import { PropertyVisitStat } from '../../services/ReportService'; // Adjust path

interface PropertiesPerformanceTableProps {
  properties: PropertyVisitStat[];
}

export function PropertiesPerformanceTable({ properties }: PropertiesPerformanceTableProps) {
  
  const getTrendIcon = (trend?: 'up' | 'down' | 'flat') => {
    if (trend === 'up') {
      return <TrendingUpIcon size={16} className="text-green-600" />;
    } else if (trend === 'down') {
      return <TrendingDownIcon size={16} className="text-red-600" />;
    } else if (trend === 'flat') {
      return <ArrowRightIcon size={16} className="text-yellow-600" />;
    }
    return <span className="text-gray-400">-</span>; // No trend data
  };

  if (!properties || properties.length === 0) {
    return <div className="text-center py-10 text-gray-500">No hay datos de rendimiento de propiedades para mostrar.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
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
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-[#FDFFFC] divide-y divide-gray-200">
          {properties.map(property => (
            <tr key={property.propertyId} className="hover:bg-gray-50 transition-colors duration-150">
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
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button 
                    onClick={() => alert(`Ver informe detallado para propiedad ID: ${property.propertyId} (pendiente)`)}
                    className="flex items-center text-[#62B6CB] hover:opacity-80 transition-opacity text-xs px-2 py-1 border border-[#62B6CB] rounded-md ml-auto"
                >
                  <DownloadIcon size={14} className="mr-1" />
                  <span>Detalle</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}