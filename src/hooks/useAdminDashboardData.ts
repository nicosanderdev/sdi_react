import { useState, useEffect, useCallback } from 'react';
import adminService, {
  TimeRange,
  AdminMetricsSummary,
  AdminActivityData,
  AdminActivityParams,
  AdminDashboardStats,
  AdminDashboardCharts
} from '../services/AdminService';
import type { AdminGuestVisitOverview } from '../types/guestVisitContract';
import type { GuestSiteFilterValue } from '../components/dashboard/GuestSiteFilter';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

interface UseAdminDashboardDataReturn {
  summary: AdminMetricsSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;

  charts: AdminDashboardCharts | null;
  chartsLoading: boolean;
  chartsError: string | null;

  activity: AdminActivityData | null;
  activityLoading: boolean;
  activityError: string | null;

  dashboardStats: AdminDashboardStats | null;
  dashboardStatsLoading: boolean;
  dashboardStatsError: string | null;

  guestOverview: AdminGuestVisitOverview | null;
  guestOverviewLoading: boolean;
  guestOverviewError: string | null;

  listingType: GuestSiteFilterValue;
  setListingType: (value: GuestSiteFilterValue) => void;
  analyticsPeriod: AnalyticsPeriod;
  setAnalyticsPeriod: (period: AnalyticsPeriod) => void;

  isLoading: boolean;
  hasError: boolean;

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

  const [listingType, setListingType] = useState<GuestSiteFilterValue>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('30d');

  const [summary, setSummary] = useState<AdminMetricsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [charts, setCharts] = useState<AdminDashboardCharts | null>(null);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState<string | null>(null);

  const [activity, setActivity] = useState<AdminActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats | null>(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false);
  const [dashboardStatsError, setDashboardStatsError] = useState<string | null>(null);

  const [guestOverview, setGuestOverview] = useState<AdminGuestVisitOverview | null>(null);
  const [guestOverviewLoading, setGuestOverviewLoading] = useState(false);
  const [guestOverviewError, setGuestOverviewError] = useState<string | null>(null);

  const activityParams: AdminActivityParams = {
    range: timeRange,
    ...(timeRange === 'custom' && startDate && endDate && { startDate, endDate }),
    limit: 20
  };

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await adminService.getMetricsSummary({ range: timeRange });
      setSummary(data);
    } catch (error: any) {
      setSummaryError(error.message || 'Failed to fetch summary data');
    } finally {
      setSummaryLoading(false);
    }
  }, [timeRange]);

  const fetchCharts = useCallback(async () => {
    setChartsLoading(true);
    setChartsError(null);
    try {
      const data = await adminService.getDashboardCharts(analyticsPeriod, listingType);
      setCharts(data);
    } catch (error: any) {
      setChartsError(error.message || 'Failed to fetch dashboard charts');
    } finally {
      setChartsLoading(false);
    }
  }, [analyticsPeriod, listingType]);

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

  const fetchGuestOverview = useCallback(async () => {
    setGuestOverviewLoading(true);
    setGuestOverviewError(null);
    try {
      const data = await adminService.getGuestVisitOverview(analyticsPeriod, listingType);
      setGuestOverview(data);
      setGuestOverviewError(null);
    } catch (error: any) {
      setGuestOverviewError(error.message || 'Failed to fetch guest visit overview');
    } finally {
      setGuestOverviewLoading(false);
    }
  }, [analyticsPeriod, listingType]);

  const fetchAll = useCallback(() => {
    fetchSummary();
    fetchCharts();
    fetchActivity();
    fetchDashboardStats();
    fetchGuestOverview();
  }, [fetchSummary, fetchCharts, fetchActivity, fetchDashboardStats, fetchGuestOverview]);

  const setTimeRange = useCallback((range: TimeRange, start?: string, end?: string) => {
    setTimeRangeState(range);
    setStartDate(start);
    setEndDate(end);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const isLoading =
    summaryLoading ||
    chartsLoading ||
    activityLoading ||
    dashboardStatsLoading ||
    guestOverviewLoading;
  const hasError = !!(
    summaryError ||
    chartsError ||
    activityError ||
    dashboardStatsError ||
    guestOverviewError
  );

  return {
    summary,
    summaryLoading,
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

    refetch: fetchAll,
    setTimeRange
  };
};
