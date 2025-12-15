import React from 'react';
import AccessGuard from '../../../components/auth/AccessGuard';
import { KpiCards } from '../../../components/dashboard/KpiCards';
import { TrendChart } from '../../../components/dashboard/TrendChart';
import { AdminActivityTable } from '../../../components/dashboard/AdminActivityTable';
import { SubscriptionBreakdownCard } from '../../../components/admin/dashboard/SubscriptionBreakdownCard';
import { MrrCard } from '../../../components/admin/dashboard/MrrCard';
import { useAdminDashboardData } from '../../../hooks/useAdminDashboardData';
import { Download, AlertCircle } from 'lucide-react';

const AdminDashboardPage: React.FC = () => {
  const {
    summary,
    summaryLoading,
    summaryError,
    timeseries,
    timeseriesLoading,
    timeseriesError,
    activity,
    activityLoading,
    activityError,
    dashboardStats,
    dashboardStatsLoading,
    dashboardStatsError,
    isLoading,
    hasError,
    refetch
  } = useAdminDashboardData();


  const handleExport = () => {
    // Basic export functionality - in a real implementation, this would generate CSV/PDF
    const data = {
      dashboardStats,
      summary,
      timeseries,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-dashboard-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ErrorAlert = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
      <div className="flex">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Error loading dashboard data
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
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AccessGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Global Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Platform-wide metrics and operational health
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-[#62B6CB] text-white rounded-md text-sm hover:bg-[#5ca4b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Error States */}
        {summaryError && <ErrorAlert error={summaryError} onRetry={refetch} />}
        {timeseriesError && <ErrorAlert error={timeseriesError} onRetry={refetch} />}
        {activityError && <ErrorAlert error={activityError} onRetry={refetch} />}
        {dashboardStatsError && <ErrorAlert error={dashboardStatsError} onRetry={refetch} />}

        {/* Task 2: Executive Overview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <MrrCard
            mrr={dashboardStats?.mrr || 0}
            currency="USD"
          />
          <SubscriptionBreakdownCard
            subscriptionStats={dashboardStats?.subscriptionStats || {
              withoutSubscription: 0,
              active: 0,
              expired: 0
            }}
          />
        </div>

        {/* KPI Cards */}
        <KpiCards
          data={dashboardStats || undefined}
          loading={dashboardStatsLoading}
          className="mb-8"
        />

        {/* Charts and Tables Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {/* Trend Chart */}
          <TrendChart
            data={timeseries}
            loading={timeseriesLoading}
          />

          {/* Activity Table */}
          <AdminActivityTable
            data={activity}
            loading={activityLoading}
          />
        </div>

        {/* Loading Overlay for Initial Load */}
        {isLoading && !hasError && (
          <div className="fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#1B4965] mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
            </div>
          </div>
        )}
      </div>
    </AccessGuard>
  );
};

export default AdminDashboardPage;
