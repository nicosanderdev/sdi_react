import { useState, useMemo, memo } from 'react';
import { PlusIcon, RefreshCwIcon, Loader2Icon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AddPropertyForm } from './AddPropertyForm';
import subscriptionService from '../../services/SubscriptionService';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { Button, Card, Modal, ModalBody, ModalHeader } from 'flowbite-react';
import {
  CREATE_BLOCKED_NO_TYPES_MESSAGE,
  resolveCreatablePropertyTypesFromSubscription,
} from '../../models/properties/creatablePropertyTypes';
import { CompanySelector, COMPANY_SELECTOR_OPTIONS } from '../../components/dashboard/CompanySelector';
import { usePropertyQuota } from '../../hooks/usePropertyQuota';
import { useContactVerificationGate } from '../../hooks/useContactVerificationGate';
import { EditListingModal } from '../../components/dashboard/properties/EditListingModal';
import { ContactVerificationGateBanner } from '../../components/user/ContactVerificationGateBanner';
import { formatPlanLimit } from '../../models/subscriptions/PlanData';
import { useMemberProperties } from '../../hooks/useMemberProperties';
import { PropertyFilters } from '../../components/admin/properties/PropertyFilters';
import { PropertyManagementTable } from '../../components/admin/properties/PropertyManagementTable';
import { PropertyManagementToolbar } from '../../components/admin/properties/PropertyManagementToolbar';
import { PropertyStatistics } from '../../components/admin/properties/PropertyStatistics';
import { PropertyDetailModal } from '../../components/admin/properties/PropertyDetailModal';

const PropertiesManagerComponent = () => {
  const hook = useMemberProperties(COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES);
  const {
    totalProperties,
    currentPage,
    pageSize,
    totalPages,
    loading,
    error,
    actionError,
    actionLoading,
    fetchProperties,
    fetchStatistics,
    scope,
    setScope,
    editingListingPropertyId,
    setEditingListingPropertyId,
    deleteConfirmModalOpen,
    propertyToDelete,
    closeDeleteConfirmModal,
    confirmDeleteProperty,
  } = hook;

  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const { needsVerification } = useContactVerificationGate();
  const showVerificationBanner = needsVerification;

  const { data: subscription, isLoading: isSubscriptionLoading } = useQuery({
    queryKey: ['current-subscription'],
    queryFn: () => subscriptionService.getCurrentSubscription(),
  });
  const creatablePropertyTypes = useMemo(
    () => resolveCreatablePropertyTypesFromSubscription(subscription),
    [subscription]
  );
  const canCreateByPropertyType = creatablePropertyTypes.length > 0;

  const {
    hasPersonalSubscription,
    ownedCount,
    totalLimit,
    publishedLimit,
    isAtTotalLimit,
    isLoading: isQuotaLoading,
  } = usePropertyQuota();

  const handleRefresh = () => {
    void fetchProperties();
    void fetchStatistics();
  };

  const handleAddPropertyFormClose = () => {
    setShowAddProperty(false);
    void fetchProperties();
    void fetchStatistics();
  };

  const handleCreateClick = () => {
    if (needsVerification) {
      return;
    }
    if (!canCreateByPropertyType) {
      return;
    }
    if (isAtTotalLimit) {
      setShowLimitModal(true);
    } else {
      setShowAddProperty(true);
    }
  };

  if (showAddProperty) {
    return <AddPropertyForm onClose={handleAddPropertyFormClose} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <DashboardPageTitle title="Gestión de Propiedades" />
        <div className="flex flex-wrap items-center gap-2">
          <CompanySelector
            mode="all-options"
            value={scope}
            onChange={setScope}
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
      </div>

      {!canCreateByPropertyType && !isSubscriptionLoading && (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {CREATE_BLOCKED_NO_TYPES_MESSAGE}
        </p>
      )}

      {showVerificationBanner && (
        <ContactVerificationGateBanner id="onboarding-verification-gate" />
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-red-800 dark:text-red-200">
            <strong>Error: </strong> {error}
          </div>
        </Card>
      )}

      <PropertyStatistics
        hook={hook}
        totalDescription="Propiedades en la selección actual"
      />

      <PropertyFilters
        hook={hook}
        showOwnerId={false}
        defaultLocation=""
      />

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
              id="add-property-button"
              color="green"
              size="sm"
              onClick={handleCreateClick}
              disabled={isQuotaLoading || isSubscriptionLoading || !canCreateByPropertyType}
              title={!canCreateByPropertyType ? CREATE_BLOCKED_NO_TYPES_MESSAGE : undefined}
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

      <Card>
        <PropertyManagementToolbar
          hook={hook}
          editBlocked={needsVerification}
        />
        <PropertyManagementTable hook={hook} />
      </Card>

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

      <PropertyDetailModal hook={hook} showModerationActions={false} />

      <EditListingModal
        isOpen={!!editingListingPropertyId}
        propertyId={editingListingPropertyId}
        onClose={() => setEditingListingPropertyId(null)}
        onSaved={() => {
          void fetchProperties();
          void fetchStatistics();
        }}
      />

      <Modal show={showLimitModal} onClose={() => setShowLimitModal(false)} className="text-gray-800 dark:text-gray-50">
        <ModalHeader>
          <h3 className="text-xl font-semibold mb-2">Límite de Propiedades Alcanzado</h3>
        </ModalHeader>
        <ModalBody>
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl mb-2">🏠</div>
              <p className="text-lg mb-2">
                Has alcanzado el límite máximo de propiedades de tu plan
                ({formatPlanLimit(totalLimit)} totales, {formatPlanLimit(publishedLimit)} publicadas).
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Propiedades actuales:</span>
                <span className="font-semibold">{ownedCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Límite máximo:</span>
                <span className="font-semibold">{formatPlanLimit(totalLimit)}</span>
              </div>
            </div>

            <div className="flex justify-center gap-2 w-100">
              <Button color="alternative" onClick={() => setShowLimitModal(false)}>
                Entendido
              </Button>
              {!hasPersonalSubscription && (
                <Button
                  color="primary"
                  onClick={() => {
                    setShowLimitModal(false);
                    window.location.href = '/dashboard/subscription/plans';
                  }}
                >
                  Ver Planes
                </Button>
              )}
            </div>
          </div>
        </ModalBody>
      </Modal>

      {propertyToDelete && (
        <Modal
          show={deleteConfirmModalOpen}
          onClose={() => {
            closeDeleteConfirmModal();
          }}
          className="text-gray-800 dark:text-gray-50"
        >
          <ModalHeader>
            <h3 className="text-xl font-semibold mb-2">Confirmar Eliminación</h3>
          </ModalHeader>
          <ModalBody>
            <p className="mb-4 text-xl text-center">
              ¿Estás seguro de que quieres eliminar la propiedad: <br />
              <strong>{propertyToDelete.title}</strong>?
            </p>
            <p className="text-sm mb-8 text-center">Esta acción no se puede deshacer.</p>

            {actionError && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm mb-3"
                role="alert"
              >
                {actionError}
              </div>
            )}
            <div className="flex justify-end gap-2 w-100">
              <Button
                color="alternative"
                onClick={() => closeDeleteConfirmModal()}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button color="red" onClick={() => void confirmDeleteProperty()} disabled={actionLoading}>
                {actionLoading ? (
                  <>
                    <Loader2Icon size={16} className="animate-spin mr-2" />
                    Eliminando...
                  </>
                ) : (
                  'Eliminar'
                )}
              </Button>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
};

export const PropertiesManager = memo(PropertiesManagerComponent);
