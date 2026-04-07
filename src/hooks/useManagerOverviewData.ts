import { useQuery } from '@tanstack/react-query';
import reportService from '../services/ReportService';
import type { AdminActivityData } from '../services/AdminService';
import type {
  DashboardSummaryData,
  VisitsByPropertyData,
  VisitSource,
} from '../services/ReportService';

interface UseManagerOverviewDataReturn {
  summary: DashboardSummaryData | null;
  topProperties: VisitsByPropertyData['data'];
  topTrafficSources: VisitSource[];
  activity: AdminActivityData;
  isLoading: boolean;
  hasError: boolean;
}

export const useManagerOverviewData = (
  period: string,
): UseManagerOverviewDataReturn => {
  const summaryQuery = useQuery({
    queryKey: ['managerOverviewSummary', period],
    queryFn: () => reportService.getDashboardSummary({ period }),
  });

  const topPropertiesQuery = useQuery({
    queryKey: ['managerOverviewTopProperties', period],
    queryFn: async () => {
      const response = await reportService.getVisitsByProperty({
        period,
        page: 1,
        limit: 10,
      });
      return response.data ?? [];
    },
  });

  const sourcesQuery = useQuery({
    queryKey: ['managerOverviewSources', period],
    queryFn: async () => {
      try {
        return await reportService.getVisitsBySource({ period });
      } catch {
        // Some environments may not expose this RPC yet.
        return [];
      }
    },
  });

  const topProperties = topPropertiesQuery.data ?? [];
  const activity: AdminActivityData = {
    users: [],
    properties: topProperties.slice(0, 8).map((item) => ({
      id: item.propertyId,
      title: item.propertyTitle,
      updatedAt: new Date().toISOString(),
      status: item.status ?? 'Activa',
    })),
    flags: [],
  };

  return {
    summary: summaryQuery.data ?? null,
    topProperties,
    topTrafficSources: sourcesQuery.data ?? [],
    activity,
    isLoading:
      summaryQuery.isLoading ||
      topPropertiesQuery.isLoading ||
      sourcesQuery.isLoading,
    hasError:
      summaryQuery.isError || topPropertiesQuery.isError || sourcesQuery.isError,
  };
};
