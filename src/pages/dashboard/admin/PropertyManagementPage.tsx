// src/pages/dashboard/admin/PropertyManagementPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from 'flowbite-react';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminProperties } from '../../../hooks/useAdminProperties';
import { PropertyFilters } from '../../../components/admin/properties/PropertyFilters';
import { PropertyManagementTable } from '../../../components/admin/properties/PropertyManagementTable';
import { PropertyStatistics } from '../../../components/admin/properties/PropertyStatistics';
import { PropertyDetailModal } from '../../../components/admin/properties/PropertyDetailModal';
import { DeletePropertyConfirmModal } from '../../../components/admin/properties/DeletePropertyConfirmModal';

const PropertyManagementPage = () => {
  const navigate = useNavigate();
  const hook = useAdminProperties();
  const {
    totalProperties,
    currentPage,
    pageSize,
    totalPages,
    loading,
    error,
    fetchProperties,
  } = hook;

  const handleRefresh = () => {
    fetchProperties();
  };

  // #region agent log
  fetch('http://127.0.0.1:7410/ingest/8cfc8ae1-a75f-4ac9-842a-c9e78ca77428', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '200f5b',
    },
    body: JSON.stringify({
      sessionId: '200f5b',
      runId: 'admin-prop-pre-fix-2',
      hypothesisId: 'H-component-types',
      location: 'PropertyManagementPage.tsx:33',
      message: 'Component types in PropertyManagementPage render',
      data: {
        PropertyStatisticsType: typeof PropertyStatistics,
        PropertyFiltersType: typeof PropertyFilters,
        PropertyManagementTableType: typeof PropertyManagementTable,
        PropertyDetailModalType: typeof PropertyDetailModal,
        DeletePropertyConfirmModalType: typeof DeletePropertyConfirmModal,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <DashboardPageTitle
          title="Gestión de propiedades"
          subtitle="Supervisa y modera todos los anuncios de propiedades en la plataforma"
        />

        <Button
          color="light"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center space-x-2"
        >
          <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-red-800 dark:text-red-200">
            <strong>Error: </strong> {error}
          </div>
        </Card>
      )}

      {/* Statistics */}
      <PropertyStatistics hook={hook} />

      {/* Filters */}
      <PropertyFilters hook={hook} />

      {/* Results Summary */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total de propiedades</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalProperties.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Página mostrada</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentPage} de {totalPages}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              color="green"
              size="sm"
              onClick={() => navigate('/dashboard/admin/properties/create')}
              className="flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Crear propiedad</span>
            </Button>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Página {currentPage} de {totalPages}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pageSize} por página
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Properties Table */}
      <Card>
        <PropertyManagementTable hook={hook} />
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Página {currentPage} de {totalPages}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                color="light"
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => hook.setPage(currentPage - 1)}
              >
                Anterior
              </Button>

              {/* Page numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNum}
                      color={pageNum === currentPage ? 'blue' : 'light'}
                      size="sm"
                      disabled={loading}
                      onClick={() => hook.setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

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

      {/* Modals */}
      <PropertyDetailModal hook={hook} />
      <DeletePropertyConfirmModal hook={hook} />
    </div>
  );
};

export default PropertyManagementPage;
