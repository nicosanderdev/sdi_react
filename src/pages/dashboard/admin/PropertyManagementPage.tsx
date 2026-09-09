// src/pages/dashboard/admin/PropertyManagementPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card } from 'flowbite-react';
import { BarChart3Icon, Loader2Icon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import propertyAdminService, { SearchScoringBatchResult } from '../../../services/PropertyAdminService';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminProperties } from '../../../hooks/useAdminProperties';
import { PropertyFilters } from '../../../components/admin/properties/PropertyFilters';
import { PropertyManagementTable } from '../../../components/admin/properties/PropertyManagementTable';
import { PropertyManagementToolbar } from '../../../components/admin/properties/PropertyManagementToolbar';
import { PropertyStatistics } from '../../../components/admin/properties/PropertyStatistics';
import { PropertyDetailModal } from '../../../components/admin/properties/PropertyDetailModal';
import { DeletePropertyConfirmModal } from '../../../components/admin/properties/DeletePropertyConfirmModal';
import { EditListingModal } from '../../../components/dashboard/properties/EditListingModal';

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
    editingListingPropertyId,
    setEditingListingPropertyId,
  } = hook;

  const [scoringRunning, setScoringRunning] = useState(false);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [scoringResult, setScoringResult] = useState<SearchScoringBatchResult | null>(null);

  const handleRefresh = () => {
    fetchProperties();
  };

  const handleRunScoring = async () => {
    const confirmed = window.confirm(
      '¿Recalcular las puntuaciones de búsqueda para todos los anuncios SummerRent y EventVenue visibles? ' +
        'El proceso puede tardar varios minutos.',
    );
    if (!confirmed) return;

    setScoringRunning(true);
    setScoringError(null);
    setScoringResult(null);

    try {
      const result = await propertyAdminService.runSearchScoringBatch();
      setScoringResult(result);
    } catch (e) {
      setScoringError(e instanceof Error ? e.message : 'Error al ejecutar el scoring.');
    } finally {
      setScoringRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <DashboardPageTitle
          title="Gestión de propiedades"
          subtitle="Supervisa y modera todos los anuncios de propiedades en la plataforma"
        />

        <div className="flex items-center gap-2">
          <Button
            color="light"
            size="sm"
            onClick={() => void handleRunScoring()}
            disabled={loading || scoringRunning}
            className="flex items-center space-x-2"
          >
            {scoringRunning ? (
              <Loader2Icon className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3Icon className="w-4 h-4" />
            )}
            <span>Ejecutar scoring</span>
          </Button>
          <Button
            color="light"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || scoringRunning}
            className="flex items-center space-x-2"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      {scoringError && (
        <Alert color="failure" onDismiss={() => setScoringError(null)}>
          <span className="font-medium">Scoring: </span>
          {scoringError}
        </Alert>
      )}

      {scoringResult && (
        <Alert
          color={scoringResult.errorCount > 0 ? 'warning' : 'success'}
          onDismiss={() => setScoringResult(null)}
        >
          <p className="font-medium">Scoring completado</p>
          <p className="text-sm mt-1">
            Procesados: {scoringResult.processed} · Correctos: {scoringResult.succeeded} · Omitidos:{' '}
            {scoringResult.skipped} · Errores: {scoringResult.errorCount} · Duración:{' '}
            {(scoringResult.durationMs / 1000).toFixed(1)} s
          </p>
          {scoringResult.errors.length > 0 && (
            <ul className="text-sm mt-2 list-disc list-inside max-h-32 overflow-y-auto">
              {scoringResult.errors.slice(0, 5).map((err) => (
                <li key={err}>{err}</li>
              ))}
              {scoringResult.errorCount > 5 && (
                <li>… y {scoringResult.errorCount - 5} más</li>
              )}
            </ul>
          )}
        </Alert>
      )}

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
        <PropertyManagementToolbar hook={hook} />
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
                      color={pageNum === currentPage ? 'green' : 'light'}
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
      <EditListingModal
        isOpen={!!editingListingPropertyId}
        propertyId={editingListingPropertyId}
        onClose={() => setEditingListingPropertyId(null)}
        onSaved={() => void fetchProperties()}
      />
    </div>
  );
};

export default PropertyManagementPage;
