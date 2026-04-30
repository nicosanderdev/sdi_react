// src/components/admin/properties/PropertyFilters.tsx
import React from 'react';
import { Button, Select, TextInput } from 'flowbite-react';
import { SearchIcon, XIcon } from 'lucide-react';
import {
  AdminPropertyOfferKind,
  DEFAULT_ADMIN_PROPERTY_LOCATION,
} from '../../../services/PropertyAdminService';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';

interface PropertyFiltersProps {
  hook: UseAdminPropertiesReturn;
}

export const PropertyFilters: React.FC<PropertyFiltersProps> = ({ hook }) => {
  const { filters, updateFilters, clearFilters } = hook;

  const handleSearchChange = (value: string) => {
    updateFilters({ search: value || undefined });
  };

  const handleOfferKindChange = (value: string) => {
    updateFilters({
      offerKind: value === 'all' ? undefined : (value as AdminPropertyOfferKind),
    });
  };

  const handleLocationChange = (value: string) => {
    updateFilters({ location: value || undefined });
  };

  const locationTrimmed = (filters.location ?? '').trim();
  const hasActiveFilters =
    Boolean(filters.search?.trim()) ||
    Boolean(filters.userId?.trim()) ||
    filters.offerKind != null ||
    locationTrimmed !== DEFAULT_ADMIN_PROPERTY_LOCATION;

  const offerKindOptions: { value: 'all' | AdminPropertyOfferKind; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'real_estate', label: 'En venta' },
    { value: 'annual_rent', label: 'En alquiler' },
    { value: 'summer_rent', label: 'Alquiler de temporada' },
    { value: 'event_venue', label: 'Eventos' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex flex-col space-y-4">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <TextInput
              type="text"
              placeholder="Buscar por título, nombre del propietario o ubicación..."
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              icon={SearchIcon}
              className="w-full"
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Offer kind (listing types + extensions) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de oferta
            </label>
            <Select
              value={filters.offerKind ?? 'all'}
              onChange={(e) => handleOfferKindChange(e.target.value)}
            >
              {offerKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ubicación
            </label>
            <TextInput
              type="text"
              placeholder="Ciudad, estado o país..."
              value={filters.location || ''}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Placeholder for future filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ID del propietario (avanzado)
            </label>
            <TextInput
              type="text"
              placeholder="Ingrese el ID del miembro propietario..."
              value={filters.userId || ''}
              onChange={(e) => updateFilters({ userId: e.target.value || undefined })}
              className="w-full"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button
              color="light"
              size="sm"
              onClick={clearFilters}
              className="text-gray-600 hover:text-gray-800"
            >
              <XIcon className="w-4 h-4 mr-2" />
              Limpiar todos los filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
