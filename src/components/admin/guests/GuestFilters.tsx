import React from 'react';
import { Button, TextInput } from 'flowbite-react';
import { SearchIcon } from 'lucide-react';
import { UseAdminGuestsReturn } from '../../../hooks/useAdminGuests';

interface GuestFiltersProps {
  hook: UseAdminGuestsReturn;
}

export const GuestFilters: React.FC<GuestFiltersProps> = ({ hook }) => {
  const { filters, updateFilters, clearFilters } = hook;

  const hasActiveFilters = Boolean(filters.search);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex flex-col space-y-4">
        <div className="flex-1 min-w-0">
          <TextInput
            type="text"
            placeholder="Buscar por nombre, correo o teléfono..."
            value={filters.search || ''}
            onChange={(e) => updateFilters({ search: e.target.value || undefined })}
            icon={SearchIcon}
            className="w-full"
          />
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button color="light" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
