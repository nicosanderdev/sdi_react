
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Badge, TableHead, TableHeadCell, TableBody, TableCell, TableRow } from 'flowbite-react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  EyeIcon,
  CalendarIcon,
  Loader2Icon,
  HomeIcon
} from 'lucide-react';
import { AdminPropertyListItem } from '../../../services/PropertyAdminService';
import { UseAdminPropertiesReturn, SortField } from '../../../hooks/useAdminProperties';
import { PropertyActionsMenu } from './PropertyActionsMenu';

interface PropertyManagementTableProps {
  hook: UseAdminPropertiesReturn;
}

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'sale': return 'success';
    case 'rent': return 'info';
    case 'reserved': return 'warning';
    case 'sold': return 'gray';
    case 'unavailable': return 'failure';
    default: return 'gray';
  }
};

const getVisibilityBadgeColor = (isVisible: boolean) => {
  return isVisible ? 'success' : 'failure';
};

const getActivityBadgeColor = (isActive: boolean) => {
  return isActive ? 'success' : 'warning';
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    sale: 'En venta',
    rent: 'En alquiler',
    reserved: 'Reservado',
    sold: 'Vendido',
    unavailable: 'No disponible',
  };
  return labels[status] ?? status;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Nunca';
  return new Date(dateString).toLocaleDateString();
};

export const PropertyManagementTable: React.FC<PropertyManagementTableProps> = ({ hook }) => {
  const navigate = useNavigate();
  const {
    properties,
    loading,
    sortConfig,
    setSorting,
    fetchPropertyDetail,
  } = hook;

  const handleSort = (field: SortField) => {
    setSorting(field);
  };

  const handleViewProperty = (property: AdminPropertyListItem) => {
    fetchPropertyDetail(property.id);
  };

  const SortableHeader: React.FC<{
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }> = ({ field, children, className = '' }) => (
    <TableHeadCell
      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortConfig.field === field && (
          sortConfig.direction === 'asc' ?
            <ChevronUpIcon className="w-4 h-4" /> :
            <ChevronDownIcon className="w-4 h-4" />
        )}
      </div>
    </TableHeadCell>
  );

  if (loading && properties.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2Icon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <HomeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No se encontraron propiedades con los filtros actuales.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table hoverable>
        <TableHead>
          <SortableHeader field="title">Título</SortableHeader>
          <SortableHeader field="ownerName">Propietario</SortableHeader>
          <SortableHeader field="status">Estado</SortableHeader>
          <SortableHeader field="city">Ubicación</SortableHeader>
          <TableHeadCell>Visibilidad</TableHeadCell>
          <TableHeadCell>Actividad</TableHeadCell>
          <SortableHeader field="createdAt">Creado</SortableHeader>
          <SortableHeader field="lastModified">Modificado</SortableHeader>
          <TableHeadCell>Acciones</TableHeadCell>
        </TableHead>
        <TableBody className="divide-y">
          {properties.map((property) => (
            <TableRow key={property.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {/* Title */}
              <TableCell className="font-medium text-gray-900 dark:text-white max-w-xs">
                <div className="truncate" title={property.title}>
                  {property.title}
                </div>
              </TableCell>

              {/* Owner */}
              <TableCell className="text-gray-600 dark:text-gray-300">
                <div className="space-y-1">
                  <div className="font-medium">{property.ownerName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={property.ownerEmail}>
                    {property.ownerEmail}
                  </div>
                </div>
              </TableCell>

              {/* Status */}
              <TableCell>
                <Badge
                  color={getStatusBadgeColor(property.status)}
                  size="sm"
                >
                  {getStatusLabel(property.status)}
                </Badge>
              </TableCell>

              {/* Location */}
              <TableCell className="text-gray-600 dark:text-gray-300">
                <div className="truncate" title={`${property.city}, ${property.state}`}>
                  {property.city}, {property.state}
                </div>
              </TableCell>

              {/* Visibility */}
              <TableCell>
                <Badge
                  color={getVisibilityBadgeColor(property.isPropertyVisible)}
                  size="sm"
                >
                  {property.isPropertyVisible ? 'Visible' : 'Oculto'}
                </Badge>
              </TableCell>

              {/* Activity */}
              <TableCell>
                <Badge
                  color={getActivityBadgeColor(property.isActive)}
                  size="sm"
                >
                  {property.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>

              {/* Created */}
              <TableCell className="text-gray-600 dark:text-gray-300 text-sm">
                {formatDate(property.createdAt)}
              </TableCell>

              {/* Modified */}
              <TableCell className="text-gray-600 dark:text-gray-300 text-sm">
                {formatDate(property.lastModified)}
              </TableCell>

              {/* Actions */}
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    color="light"
                    onClick={() => navigate(`/dashboard/property/${property.id}/bookings`)}
                    className="p-2"
                    title="Gestionar calendario"
                    aria-label="Gestionar calendario"
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    color="light"
                    onClick={() => handleViewProperty(property)}
                    className="p-2"
                    title="Ver propiedad"
                    aria-label="Ver propiedad"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </Button>
                  <PropertyActionsMenu property={property} hook={hook} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
