// src/pages/dashboard/admin/PropertyManagementPage.tsx
import React from 'react';
import { Button, Card } from 'flowbite-react';
import { RefreshCwIcon, HomeIcon } from 'lucide-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminProperties } from '../../../hooks/useAdminProperties';
import { PropertyFilters } from '../../../components/admin/properties/PropertyFilters';
import { PropertyManagementTable } from '../../../components/admin/properties/PropertyManagementTable';
import { PropertyStatistics } from '../../../components/admin/properties/PropertyStatistics';
import { PropertyDetailModal } from '../../../components/admin/properties/PropertyDetailModal';
import { DeletePropertyConfirmModal } from '../../../components/admin/properties/DeletePropertyConfirmModal';

const PropertyManagementPage: React.FC = () => {
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <DashboardPageTitle
          title="Property Management"
          subtitle="Monitor and moderate all property listings in the platform"
        />

        <Button
          color="light"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center space-x-2"
        >
          <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Properties</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalProperties.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Showing Page</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentPage} of {totalPages}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pageSize} per page
            </p>
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
                Page {currentPage} of {totalPages}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                color="light"
                size="sm"
                disabled={currentPage === 1 || loading}
                onClick={() => hook.setPage(currentPage - 1)}
              >
                Previous
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
                Next
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
