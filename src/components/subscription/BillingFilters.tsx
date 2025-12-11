import React from 'react';
import { Card, Button, Select, Datepicker } from 'flowbite-react';
import { Filter, X } from 'lucide-react';
import { BillingHistoryFilters } from '../../hooks/useBillingHistory';

interface BillingFiltersProps {
    filters: BillingHistoryFilters;
    onFiltersChange: (filters: BillingHistoryFilters) => void;
    onClearFilters: () => void;
}

export const BillingFilters: React.FC<BillingFiltersProps> = ({
    filters,
    onFiltersChange,
    onClearFilters
}) => {
    const handleStatusChange = (status: string) => {
        onFiltersChange({
            ...filters,
            status: status === 'all' ? undefined : status
        });
    };

    const handleDateFromChange = (date: Date | null) => {
        onFiltersChange({
            ...filters,
            dateFrom: date || undefined
        });
    };

    const handleDateToChange = (date: Date | null) => {
        onFiltersChange({
            ...filters,
            dateTo: date || undefined
        });
    };

    const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.status;

    return (
        <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h3 className="text-lg font-semibold">Filtros</h3>
                </div>
                {hasActiveFilters && (
                    <Button
                        size="sm"
                        color="light"
                        onClick={onClearFilters}
                        className="flex items-center space-x-2"
                    >
                        <X className="w-4 h-4" />
                        <span>Limpiar filtros</span>
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Estado
                    </label>
                    <Select
                        value={filters.status || 'all'}
                        onChange={(e) => handleStatusChange(e.target.value)}
                    >
                        <option value="all">Todos los estados</option>
                        <option value="0">Pagada</option>
                        <option value="1">Pendiente</option>
                        <option value="2">Fallida</option>
                    </Select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Desde
                    </label>
                    <Datepicker
                        value={filters.dateFrom}
                        onChange={handleDateFromChange}
                        placeholder="Seleccionar fecha"
                        language="es-ES"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Hasta
                    </label>
                    <Datepicker
                        value={filters.dateTo}
                        onChange={handleDateToChange}
                        placeholder="Seleccionar fecha"
                        language="es-ES"
                    />
                </div>
            </div>
        </Card>
    );
};
