import React, { useState } from 'react';
import AccessGuard from '../../../components/auth/AccessGuard';
import { KpiCards } from '../../../components/dashboard/KpiCards';
import { TrendChart } from '../../../components/dashboard/TrendChart';
import { AdminActivityTable } from '../../../components/dashboard/AdminActivityTable';
import { useAdminDashboardData } from '../../../hooks/useAdminDashboardData';
import { TimeRange } from '../../../services/AdminService';
import { Download, Calendar, AlertCircle } from 'lucide-react';

const AdminDashboardPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

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
    isLoading,
    hasError,
    refetch,
    setTimeRange: updateTimeRange
  } = useAdminDashboardData(timeRange);

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' }
  ];

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
    if (newRange === 'custom' && customStartDate && customEndDate) {
      updateTimeRange(newRange, customStartDate, customEndDate);
    } else {
      updateTimeRange(newRange);
    }
  };

  const handleCustomDateChange = () => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      updateTimeRange(timeRange, customStartDate, customEndDate);
    }
  };

  const handleExport = () => {
    // Basic export functionality - in a real implementation, this would generate CSV/PDF
    const data = {
      summary,
      timeseries,
      exportedAt: new Date().toISOString(),
      timeRange
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-dashboard-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
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
            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#1B4965] focus:border-transparent"
              >
                {timeRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Inputs */}
            {timeRange === 'custom' && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Start date"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="End date"
                />
                <button
                  onClick={handleCustomDateChange}
                  className="px-3 py-2 bg-[#1B4965] text-white rounded-md text-sm hover:bg-[#2c5f75] transition-colors"
                >
                  Apply
                </button>
              </div>
            )}

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

        {/* KPI Cards */}
        <KpiCards
          data={summary}
          loading={summaryLoading}
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
