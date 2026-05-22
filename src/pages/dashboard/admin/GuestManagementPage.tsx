import React from 'react';
import { Button, Card } from 'flowbite-react';
import { RefreshCwIcon } from 'lucide-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminGuests } from '../../../hooks/useAdminGuests';
import { GuestFilters } from '../../../components/admin/guests/GuestFilters';
import { GuestManagementTable } from '../../../components/admin/guests/GuestManagementTable';
import { GuestViewModal } from '../../../components/admin/guests/GuestViewModal';

const GuestManagementPage: React.FC = () => {
  const hook = useAdminGuests();
  const { guests, totalGuests, currentPage, pageSize, totalPages, loading, error, fetchGuests } =
    hook;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DashboardPageTitle
          title="Administración de invitados"
          subtitle="Consulta invitados registrados desde reservas del sitio público (solo lectura)"
        />

        <Button
          color="light"
          size="sm"
          onClick={() => void fetchGuests()}
          disabled={loading}
          className="flex items-center space-x-2"
        >
          <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
          </div>
        </Card>
      )}

      <GuestFilters hook={hook} />

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total de invitados</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalGuests.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Mostrando</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {guests.length} de {totalGuests}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Página {currentPage} de {totalPages}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{pageSize} por página</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Invitados registrados
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Solo consulta. Los datos se crean al confirmar reservas en el sitio de viajes.
          </p>
        </div>
        <GuestManagementTable hook={hook} />
      </Card>

      {totalPages > 1 && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <Button
                color="light"
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => hook.setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <Button
                color="light"
                size="sm"
                disabled={currentPage === totalPages || loading}
                onClick={() => hook.setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      )}

      <GuestViewModal hook={hook} />
    </div>
  );
};

export default GuestManagementPage;
