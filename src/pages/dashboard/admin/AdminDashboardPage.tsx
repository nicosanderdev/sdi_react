import React, { useMemo } from 'react';
import AccessGuard from '../../../components/auth/AccessGuard';
import { KpiCards } from '../../../components/dashboard/KpiCards';
import { AdminActivityTable } from '../../../components/dashboard/AdminActivityTable';
import { AdminDashboardCharts } from '../../../components/admin/dashboard/AdminDashboardCharts';
import { AdminTopMetricsTables } from '../../../components/admin/dashboard/AdminTopMetricsTables';
import { GuestSiteFilter } from '../../../components/dashboard/GuestSiteFilter';
import { GuestVisitSummaryCards } from '../../../components/dashboard/GuestVisitSummaryCards';
import { useAdminDashboardData, type AnalyticsPeriod } from '../../../hooks/useAdminDashboardData';
import { AlertCircle } from 'lucide-react';
import { Dropdown, DropdownItem } from 'flowbite-react';

const ANALYTICS_PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: '90d', label: 'Últimos 90 días' },
];

const AdminDashboardPage: React.FC = () => {
  const {
    summaryError,
    charts,
    chartsLoading,
    chartsError,
    activity,
    activityLoading,
    activityError,
    dashboardStats,
    dashboardStatsLoading,
    dashboardStatsError,
    guestOverview,
    guestOverviewLoading,
    guestOverviewError,
    listingType,
    setListingType,
    analyticsPeriod,
    setAnalyticsPeriod,
    isLoading,
    hasError,
    refetch
  } = useAdminDashboardData();

  const ErrorAlert = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
      <div className="flex">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Error al cargar el panel
          </h3>
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className="bg-red-100 dark:bg-red-800 px-3 py-1 rounded-md text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const topViewed = useMemo(
    () =>
      (guestOverview?.topViewed ?? []).map((row) => ({
        rank: row.rank,
        name: row.name,
        visits: row.visits,
        listingType: row.listingType,
      })),
    [guestOverview]
  );

  const topConversion = useMemo(
    () =>
      (guestOverview?.topConversion ?? []).map((row) => ({
        rank: row.rank,
        name: row.name,
        rate: `${Number(row.rate).toFixed(1)}%`,
        listingType: row.listingType,
      })),
    [guestOverview]
  );

  return (
    <AccessGuard>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Panel de administración global
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Métricas de la plataforma y estado operativo
            </p>
          </div>
        </div>

        {summaryError && <ErrorAlert error={summaryError} onRetry={refetch} />}
        {chartsError && <ErrorAlert error={chartsError} onRetry={refetch} />}
        {activityError && <ErrorAlert error={activityError} onRetry={refetch} />}
        {dashboardStatsError && <ErrorAlert error={dashboardStatsError} onRetry={refetch} />}
        {guestOverviewError && <ErrorAlert error={guestOverviewError} onRetry={refetch} />}

        <KpiCards
          data={dashboardStats || undefined}
          loading={dashboardStatsLoading}
          className="mb-8"
        />

        <div className="flex flex-wrap justify-end gap-2">
          <GuestSiteFilter value={listingType} onChange={setListingType} />
          <Dropdown
            dismissOnClick={true}
            label={ANALYTICS_PERIODS.find((p) => p.id === analyticsPeriod)?.label}
          >
            {ANALYTICS_PERIODS.map((p) => (
              <DropdownItem key={p.id} onClick={() => setAnalyticsPeriod(p.id)}>
                {p.label}
              </DropdownItem>
            ))}
          </Dropdown>
        </div>

        <GuestVisitSummaryCards
          mode="admin"
          loading={guestOverviewLoading}
          data={
            guestOverview
              ? {
                  propertyViews: guestOverview.propertyViews,
                  pageViews: guestOverview.pageViews,
                  conversionRate: guestOverview.conversionRate,
                  traffic: guestOverview.traffic,
                }
              : null
          }
          className="mb-8"
        />

        <AdminDashboardCharts
          data={charts}
          loading={chartsLoading}
          listingType={listingType}
          className="mb-8"
        />

        <AdminActivityTable
          data={activity}
          loading={activityLoading}
          className="mb-8"
        />

        <AdminTopMetricsTables
          className="mb-8"
          topViewed={topViewed}
          topConversion={topConversion}
          showSiteLabel={listingType == null}
        />

        {isLoading && !hasError && (
          <div className="fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#1B4965] mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Cargando panel...</p>
            </div>
          </div>
        )}
      </div>
    </AccessGuard>
  );
};

export default AdminDashboardPage;
