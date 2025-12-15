import { useState, useEffect, useCallback, useMemo } from 'react';
import adminService, {
  TimeRange,
  AdminMetricsSummary,
  AdminMetricsTimeseries,
  AdminActivityData,
  AdminMetricsParams,
  AdminActivityParams,
  AdminDashboardStats
} from '../services/AdminService';

interface UseAdminDashboardDataReturn {
  // Summary data
  summary: AdminMetricsSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;

  // Timeseries data
  timeseries: AdminMetricsTimeseries[];
  timeseriesLoading: boolean;
  timeseriesError: string | null;

  // Activity data
  activity: AdminActivityData | null;
  activityLoading: boolean;
  activityError: string | null;

  // Dashboard stats (Task 2)
  dashboardStats: AdminDashboardStats | null;
  dashboardStatsLoading: boolean;
  dashboardStatsError: string | null;

  // General state
  isLoading: boolean;
  hasError: boolean;

  // Actions
  refetch: () => void;
  setTimeRange: (range: TimeRange, startDate?: string, endDate?: string) => void;
}

/**
 * Hook to fetch and manage admin dashboard data
 */
export const useAdminDashboardData = (
  initialRange: TimeRange = '30d'
): UseAdminDashboardDataReturn => {
  const [timeRange, setTimeRangeState] = useState<TimeRange>(initialRange);
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();

  // Summary state
  const [summary, setSummary] = useState<AdminMetricsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Timeseries state
  const [timeseries, setTimeseries] = useState<AdminMetricsTimeseries[]>([]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [timeseriesError, setTimeseriesError] = useState<string | null>(null);

  // Activity state
  const [activity, setActivity] = useState<AdminActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Dashboard stats state (Task 2)
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats | null>(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false);
  const [dashboardStatsError, setDashboardStatsError] = useState<string | null>(null);

  const baseParams: AdminMetricsParams = useMemo(() => ({
    range: timeRange,
    ...(timeRange === 'custom' && startDate && endDate && { startDate, endDate })
  }), [timeRange, startDate, endDate]);

  const activityParams: AdminActivityParams = {
    ...baseParams,
    limit: 20 // Default limit for activity items
  };

  // Fetch summary data
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await adminService.getMetricsSummary(baseParams);
      setSummary(data);
    } catch (error: any) {
      setSummaryError(error.message || 'Failed to fetch summary data');
    } finally {
      setSummaryLoading(false);
    }
  }, [baseParams.range, baseParams.startDate, baseParams.endDate]);

  // Fetch timeseries data
  const fetchTimeseries = useCallback(async () => {
    setTimeseriesLoading(true);
    setTimeseriesError(null);
    try {
      const data = await adminService.getMetricsTimeseries(baseParams);
      setTimeseries(data);
    } catch (error: any) {
      setTimeseriesError(error.message || 'Failed to fetch timeseries data');
    } finally {
      setTimeseriesLoading(false);
    }
  }, [baseParams.range, baseParams.startDate, baseParams.endDate]);

  // Fetch activity data
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const data = await adminService.getActivityData(activityParams);
      setActivity(data);
    } catch (error: any) {
      setActivityError(error.message || 'Failed to fetch activity data');
    } finally {
      setActivityLoading(false);
    }
  }, [activityParams.range, activityParams.startDate, activityParams.endDate, activityParams.limit]);

  // Fetch dashboard stats data (Task 2)
  const fetchDashboardStats = useCallback(async () => {
    setDashboardStatsLoading(true);
    setDashboardStatsError(null);
    try {
      const data = await adminService.getDashboardStats();
      setDashboardStats(data);
    } catch (error: any) {
      setDashboardStatsError(error.message || 'Failed to fetch dashboard stats');
    } finally {
      setDashboardStatsLoading(false);
    }
  }, []);

  // Fetch all data
  const fetchAll = useCallback(() => {
    fetchSummary();
    fetchTimeseries();
    fetchActivity();
    fetchDashboardStats();
  }, [fetchSummary, fetchTimeseries, fetchActivity, fetchDashboardStats]);

  // Set time range and update data
  const setTimeRange = useCallback((range: TimeRange, start?: string, end?: string) => {
    setTimeRangeState(range);
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Initial fetch and refetch when time range changes
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const isLoading = summaryLoading || timeseriesLoading || activityLoading || dashboardStatsLoading;
  const hasError = !!(summaryError || timeseriesError || activityError || dashboardStatsError);

  return {
    // Summary data
    summary,
    summaryLoading,
    summaryError,

    // Timeseries data
    timeseries,
    timeseriesLoading,
    timeseriesError,

    // Activity data
    activity,
    activityLoading,
    activityError,

    // Dashboard stats (Task 2)
    dashboardStats,
    dashboardStatsLoading,
    dashboardStatsError,

    // General state
    isLoading,
    hasError,

    // Actions
    refetch: fetchAll,
    setTimeRange
  };
};
