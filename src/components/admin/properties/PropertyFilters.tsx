// src/components/admin/properties/PropertyFilters.tsx
import React from 'react';
import { Button, Select, TextInput } from 'flowbite-react';
import { SearchIcon, XIcon } from 'lucide-react';
import { PropertyStatus } from '../../../services/PropertyAdminService';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';

interface PropertyFiltersProps {
  hook: UseAdminPropertiesReturn;
}

export const PropertyFilters: React.FC<PropertyFiltersProps> = ({ hook }) => {
  const { filters, updateFilters, clearFilters } = hook;

  const handleSearchChange = (value: string) => {
    updateFilters({ search: value || undefined });
  };

  const handleStatusChange = (value: string) => {
    updateFilters({
      status: value === 'all' ? undefined : (value as PropertyStatus)
    });
  };

  const handleLocationChange = (value: string) => {
    updateFilters({ location: value || undefined });
  };

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.location;

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'sale', label: 'For Sale' },
    { value: 'rent', label: 'For Rent' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'sold', label: 'Sold' },
    { value: 'unavailable', label: 'Unavailable' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex flex-col space-y-4">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <TextInput
              type="text"
              placeholder="Search by title, owner name, or location..."
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              icon={SearchIcon}
              className="w-full"
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Property Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Property Status
            </label>
            <Select
              value={filters.status || 'all'}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <TextInput
              type="text"
              placeholder="City, State or Country..."
              value={filters.location || ''}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Placeholder for future filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Owner ID (Advanced)
            </label>
            <TextInput
              type="text"
              placeholder="Enter owner member ID..."
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
              Clear All Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
