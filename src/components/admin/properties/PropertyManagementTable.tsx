
import React, { useEffect, useMemo, useRef } from 'react';
import { Table, Badge, TableHead, TableHeadCell, TableBody, TableCell, TableRow } from 'flowbite-react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  Loader2Icon,
  HomeIcon,
} from 'lucide-react';
import { AdminPropertyListItem } from '../../../services/PropertyAdminService';
import { UseAdminPropertiesReturn, SortField } from '../../../hooks/useAdminProperties';

interface PropertyManagementTableProps {
  hook: UseAdminPropertiesReturn;
}

const getVisibilityBadgeColor = (isVisible: boolean) => {
  return isVisible ? 'success' : 'failure';
};

const getActivityBadgeColor = (isActive: boolean) => {
  return isActive ? 'success' : 'warning';
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Nunca';
  return new Date(dateString).toLocaleDateString();
};

const splitTypeSummary = (summary: string | null): string[] => {
  if (!summary?.trim()) return [];
  return summary
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

export const PropertyManagementTable: React.FC<PropertyManagementTableProps> = ({ hook }) => {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const {
    properties,
    loading,
    sortConfig,
    setSorting,
    fetchPropertyDetail,
    selectedPropertyIds,
    togglePropertySelection,
    toggleSelectAllOnPage,
  } = hook;

  const pageIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedPropertyIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedPropertyIds.includes(id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) {
      el.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const handleSort = (field: SortField) => {
    setSorting(field);
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
          <TableHeadCell className="w-12 p-4">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700"
              checked={allPageSelected}
              onChange={() => toggleSelectAllOnPage(pageIds)}
              aria-label="Seleccionar todas en esta página"
            />
          </TableHeadCell>
          <SortableHeader field="title">Título</SortableHeader>
          <SortableHeader field="ownerName">Propietario</SortableHeader>
          <TableHeadCell>Tipo</TableHeadCell>
          <SortableHeader field="city">Ubicación</SortableHeader>
          <TableHeadCell>Visibilidad</TableHeadCell>
          <TableHeadCell>Actividad</TableHeadCell>
          <SortableHeader field="createdAt">Creado</SortableHeader>
          <SortableHeader field="lastModified">Modificado</SortableHeader>
        </TableHead>
        <TableBody className="divide-y">
          {properties.map((property: AdminPropertyListItem) => (
            <TableRow key={property.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <TableCell className="p-4 w-12">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700"
                  checked={selectedPropertyIds.includes(property.id)}
                  onChange={() => togglePropertySelection(property.id)}
                  aria-label={`Seleccionar ${property.title}`}
                />
              </TableCell>

              <TableCell className="font-medium text-gray-900 dark:text-white max-w-xs">
                <button
                  type="button"
                  className="truncate text-left w-full hover:underline focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
                  title={property.title}
                  onClick={() => void fetchPropertyDetail(property.id)}
                >
                  {property.title}
                </button>
              </TableCell>

              <TableCell className="text-gray-600 dark:text-gray-300">
                <div className="space-y-1">
                  <div className="font-medium">{property.ownerName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={property.ownerEmail}>
                    {property.ownerEmail}
                  </div>
                </div>
              </TableCell>

              <TableCell className="max-w-xs">
                {(() => {
                  const labels = splitTypeSummary(property.propertyTypesSummary);
                  if (labels.length === 0) {
                    return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1">
                      {labels.map((label) => (
                        <Badge key={label} color="purple" size="sm">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  );
                })()}
              </TableCell>

              <TableCell className="text-gray-600 dark:text-gray-300">
                <div className="truncate" title={`${property.city}, ${property.state}`}>
                  {property.city}, {property.state}
                </div>
              </TableCell>

              <TableCell>
                <Badge
                  color={getVisibilityBadgeColor(property.isPropertyVisible)}
                  size="sm"
                >
                  {property.isPropertyVisible ? 'Visible' : 'Oculto'}
                </Badge>
              </TableCell>

              <TableCell>
                <Badge
                  color={getActivityBadgeColor(property.isActive)}
                  size="sm"
                >
                  {property.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>

              <TableCell className="text-gray-600 dark:text-gray-300 text-sm">
                {formatDate(property.createdAt)}
              </TableCell>

              <TableCell className="text-gray-600 dark:text-gray-300 text-sm">
                {formatDate(property.lastModified)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
