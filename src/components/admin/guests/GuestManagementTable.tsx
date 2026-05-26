import React from 'react';
import { Table, TableHead, TableHeadCell, TableBody, TableCell, TableRow } from 'flowbite-react';
import { ChevronUpIcon, ChevronDownIcon, Loader2Icon } from 'lucide-react';
import { GuestListItem } from '../../../services/GuestAdminService';
import { GuestSortField, UseAdminGuestsReturn } from '../../../hooks/useAdminGuests';

interface GuestManagementTableProps {
  hook: UseAdminGuestsReturn;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString();
};

const getFullName = (guest: GuestListItem): string => {
  return `${guest.firstName} ${guest.lastName}`.trim() || 'Invitado desconocido';
};

export const GuestManagementTable: React.FC<GuestManagementTableProps> = ({ hook }) => {
  const { guests, loading, sortConfig, setSorting, openGuestView } = hook;

  const SortableHeader: React.FC<{
    field: GuestSortField;
    children: React.ReactNode;
    className?: string;
  }> = ({ field, children, className = '' }) => (
    <TableHeadCell
      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${className}`}
      onClick={() => setSorting(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortConfig.field === field &&
          (sortConfig.direction === 'asc' ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          ))}
      </div>
    </TableHeadCell>
  );

  if (loading && guests.length === 0) {
    return (
      <div className="flex justify-center items-center py-12" data-testid="admin-guests-table">
        <Loader2Icon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (guests.length === 0) {
    return (
      <div className="text-center py-12" data-testid="admin-guests-table">
        <p className="text-gray-500 dark:text-gray-400">
          No se encontraron invitados con los filtros actuales.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="admin-guests-table">
      <Table hoverable>
        <TableHead>
          <SortableHeader field="name">Nombre</SortableHeader>
          <SortableHeader field="email">Correo</SortableHeader>
          <SortableHeader field="phone">Teléfono</SortableHeader>
          <SortableHeader field="created">Registrado</SortableHeader>
          <TableHeadCell>Reservas</TableHeadCell>
        </TableHead>
        <TableBody className="divide-y">
          {guests.map((guest) => (
            <TableRow key={guest.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <TableCell className="font-medium text-gray-900 dark:text-white max-w-xs">
                <button
                  type="button"
                  className="truncate text-left w-full hover:underline focus:outline-none focus:ring-2 focus:ring-green-500 rounded"
                  title={getFullName(guest)}
                  onClick={() => void openGuestView(guest.id)}
                >
                  {getFullName(guest)}
                </button>
              </TableCell>
              <TableCell className="text-gray-600 dark:text-gray-300">{guest.email}</TableCell>
              <TableCell className="text-gray-600 dark:text-gray-300">{guest.phoneNumber}</TableCell>
              <TableCell className="text-gray-600 dark:text-gray-300">
                {formatDate(guest.created)}
              </TableCell>
              <TableCell className="text-gray-600 dark:text-gray-300">
                {guest.bookingsCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
