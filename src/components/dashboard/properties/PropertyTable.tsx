import { EyeIcon, Edit2Icon as EditIcon, TrashIcon, FileTextIcon, ImageIcon, AlertTriangleIcon } from 'lucide-react';
import { PropertyData } from '../../../services/PropertyService';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';

interface PropertyTableProps {
  properties: PropertyData[];
  onPrintProperty: (id: string) => void;
  onDeleteProperty: (property: PropertyData) => void;
}

export function PropertyTable({
  properties,
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

  const onViewProperty = (id: string) => {
    window.location.href = `/dashboard/property/${id}`;
  };

  const onEditProperty = (id: string) => {
    window.location.href = `/dashboard/property/${id}/edit`;
  };

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full">
        <TableHead>
          <TableRow>
            <TableHeadCell>
              Propiedad
            </TableHeadCell>
            <TableHeadCell>
              Estado/Pais
            </TableHeadCell>
            <TableHeadCell>
              Detalles
            </TableHeadCell>
            <TableHeadCell>
              Valor
            </TableHeadCell>
            <TableHeadCell>
              Estado
            </TableHeadCell>
            <TableHeadCell>
              Visitas
            </TableHeadCell>
            <TableHeadCell>
              Fecha
            </TableHeadCell>
            <TableHeadCell>
              Acciones
            </TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {properties.map(property => (
            <TableRow key={property.id}>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {/*<div className="flex-shrink-0 h-10 w-10 rounded bg-[#BEE9E8] flex items-center justify-center text-[#1B4965] overflow-hidden border border-gray-200">
                    {property.mainImageUrl ? (
                      <img src={property.mainImageUrl} alt={property.title || 'Property image'} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </div> */}
                  <div className="ml-4">
                    <div title={property.title}>
                      {property.title || 'N/A'}
                    </div>
                    <div title={property.streetName || ''}>
                      {property.streetName + " " + property.houseNumber || `${property.city || ''}, ${property.state || ''}`}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div>
                  {property.state  ? `${property.state}, ` : ''}
                  <span>{property.country ? `${property.country} ` : ''}</span>
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div>{property.type || 'N/A'}</div>
                <div>
                  {property.bedrooms ? `${property.bedrooms} hab, ` : ''} 
                  {property.bathrooms ? `${property.bathrooms} baños, ` : ''}
                  {property.areaValue || ''}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium">
                  ${property.salePrice || property.salePrice || '0'}
                </div>
              </TableCell>
              <TableCell>
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
                   (property.status || 'N/A').toString().charAt(0).toUpperCase() + (property.status || 'N/A').toString().slice(1)}
                </span>
              </TableCell>
              <TableCell>
                {property.rentPrice ?? '-'}
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap text-sm">
                { new Date(property.created).toLocaleDateString('es-UY', {}) }
              </TableCell>
              <TableCell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}