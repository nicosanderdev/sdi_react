// src/components/PropertyTable.tsx
import { EyeIcon, Edit2Icon as EditIcon, TrashIcon, FileTextIcon, ImageIcon, AlertTriangleIcon } from 'lucide-react'; // Assuming Edit2Icon as EditIcon
import { PropertyData } from '../../services/PropertyService'; // Adjust path as needed

interface PropertyTableProps {
  properties: PropertyData[];
  onViewProperty: (id: string) => void;
  onEditProperty: (id: string) => void;
  onPrintProperty: (id: string) => void;
  onDeleteProperty: (property: PropertyData) => void;
}

export function PropertyTable({
  properties,
  onViewProperty,
  onEditProperty,
  onPrintProperty,
  onDeleteProperty,
}: PropertyTableProps) {

  if (!properties || properties.length === 0) {
    return (
      <div className="text-center py-10">
        <AlertTriangleIcon size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No properties found matching your criteria.</p>
      </div>
    );
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
              Detalles
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Visitas
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-[#FDFFFC] divide-y divide-gray-200">
          {properties.map(property => (
            <tr key={property.id} className="hover:bg-gray-50 transition-colors duration-150">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 rounded bg-[#BEE9E8] flex items-center justify-center text-[#1B4965] overflow-hidden border border-gray-200">
                    {property.mainImageUrl ? (
                      <img src={property.mainImageUrl} alt={property.title || 'Property image'} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-[#1B4965] line-clamp-2" title={property.title}>
                      {property.title || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500 line-clamp-1" title={property.address || ''}>
                      {property.address || `${property.city || ''}, ${property.state || ''}`}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{property.type || 'N/A'}</div>
                <div className="text-sm text-gray-500">
                  {property.bedrooms ? `${property.bedrooms} hab, ` : ''} 
                  {property.bathrooms ? `${property.bathrooms} baños, ` : ''}
                  {property.area || ''}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-[#1B4965]">
                  {property.price || 'N/A'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    property.status === 'sale' ? 'bg-[#5CA4B8] text-[#FDFFFC]' : 
                    property.status === 'rent' ? 'bg-[#BEE9E8] text-[#1B4965]' : 
                    property.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' :
                    property.status === 'sold' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                }`}>
                  {property.status === 'sale' ? 'En Venta' :
                   property.status === 'rent' ? 'En Alquiler' :
                   property.status === 'reserved' ? 'Reservada' :
                   property.status === 'sold' ? 'Vendida' :
                   (property.status || 'N/A').toString().charAt(0).toUpperCase() + (property.status || 'N/A').toString().slice(1)
                  }
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                {property.visits ?? '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {property.created || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-1 md:space-x-2">
                  <button 
                    onClick={() => onViewProperty(property.id)}
                    className="p-1.5 text-[#62B6CB] hover:text-[#1B4965] transition-colors rounded-md hover:bg-gray-100"
                    title="Ver Propiedad"
                  >
                    <EyeIcon size={18} />
                  </button>
                  <button 
                    onClick={() => onEditProperty(property.id)}
                    className="p-1.5 text-[#62B6CB] hover:text-[#1B4965] transition-colors rounded-md hover:bg-gray-100"
                    title="Editar Propiedad"
                  >
                    <EditIcon size={18} />
                  </button>
                  <button 
                    onClick={() => onPrintProperty(property.id)} // Does nothing for now
                    className="p-1.5 text-[#62B6CB] hover:text-[#1B4965] transition-colors rounded-md hover:bg-gray-100"
                    title="Imprimir Ficha (Próximamente)"
                  >
                    <FileTextIcon size={18} />
                  </button>
                  <button 
                    onClick={() => onDeleteProperty(property)}
                    className="p-1.5 text-red-500 hover:text-red-700 transition-colors rounded-md hover:bg-red-50"
                    title="Eliminar Propiedad"
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}