// src/services/reportService.ts
import apiClient from './AxiosClient'; // Assuming AxiosClient is correctly set up

// --- Parameter Interface Definitions ---
export interface MonthlySummaryParams {
  year: number;
  month: number; // 1-12
}

export interface VisitsByPropertyParams {
  period: 'last7days' | 'last30days' | 'last90days' | 'thisyear' | string; // Allow custom string for flexibility
  limit?: number;
  page?: number;
}

export interface PropertySpecificReportParams {
  period: 'last7days' | 'last30days' | 'last90days' | 'thisyear' | string;
}

export interface DailyVisitsParams {
  period: 'last7days' | 'last30days' | 'last90days' | 'thisyear' | string;
}

export interface VisitsBySourceParams {
  period: 'last7days' | 'last30days' | 'last90days' | 'thisyear' | string;
}

// --- Response Data Interface Definitions ---
export interface DateCount {
  date: string; // "YYYY-MM-DD"
  count: number;
}

export interface MonthlySummaryData {
  visits: DateCount[];
  messages: DateCount[];
}

export interface GeneralTotalsData {
  totalProperties: number;
  totalVisitsLifetime: number;
  totalMessagesLifetime: number;
  // Add other totals if available, e.g., conversionRateLifetime
  activeListings?: number;
  averagePrice?: number;
}

export interface PropertyVisitStat {
  propertyId: string;
  propertyTitle: string;
  address?: string; // From your PropertiesPerformanceTable example
  visitCount: number;
  // For PropertiesPerformanceTable, we also need:
  price?: string;
  status?: string; // 'En venta', 'En alquiler', etc.
  messages?: number;
  messagesTrend?: 'up' | 'down' | 'flat';
  visitsTrend?: 'up' | 'down' | 'flat';
  conversion?: string; // e.g., '13%'
  conversionTrend?: 'up' | 'down' | 'flat';
}

export interface VisitsByPropertyData {
  data: PropertyVisitStat[];
  total: number;
  page: number;
  limit: number;
}

export interface PropertySpecificReportData {
  propertyDetails: {
    id: string;
    title: string;
    address: string;
    // ... other PropertyData fields
  };
  visitTrend: DateCount[];
  messageTrend: DateCount[];
  // other relevant stats for this property
  conversionRate?: number;
  averageTimeToRespond?: string; // e.g., "2 hours"
}

export interface DashboardSummaryStat {
  currentPeriod: number;
  percentageChange?: number; // Optional
  changeDirection?: 'increase' | 'decrease' | 'neutral'; // Optional
}
export interface DashboardSummaryData {
  propertiesNeedingAttention: any;
  visits: DashboardSummaryStat;
  messages: DashboardSummaryStat;
  totalProperties?: DashboardSummaryStat;
  conversionRate?: DashboardSummaryStat;
}

export interface DailyVisit {
  date: string; // "YYYY-MM-DD" or "DD/MM" for chart
  dayName?: string; // "Lun", "Mar", etc. (Optional, can be derived)
  visits: number;
}

export interface VisitSource {
  source: string;
  visits: number;
}

const ENDPOINTS = {
  MONTHLY_SUMMARY: '/reports/monthly-summary',
  GENERAL_TOTALS: '/reports/totals',
  VISITS_BY_PROPERTY: '/reports/property-visits',
  PROPERTY_SPECIFIC_REPORT: (propertyId: string) => `/reports/properties/${propertyId}`,
  DASHBOARD_SUMMARY: '/reports/dashboard-summary',
  DAILY_VISITS: '/reports/daily-visits',
  VISITS_BY_SOURCE: '/reports/visits-by-source',
};

// --- Service Functions (adapting params and return types) ---

const getMonthlySummary = async (params: MonthlySummaryParams): Promise<MonthlySummaryData> => {
  try {
    return await apiClient.get<MonthlySummaryData>(ENDPOINTS.MONTHLY_SUMMARY, { params });
  } catch (error: any) {
    console.error('Error fetching monthly summary report:', error.message);
    throw error;
  }
};

const getGeneralTotals = async (): Promise<GeneralTotalsData> => {
  try {
    return await apiClient.get<GeneralTotalsData>(ENDPOINTS.GENERAL_TOTALS);
  } catch (error: any) {
    console.error('Error fetching general totals report:', error.message);
    throw error;
  }
};

const getVisitsByProperty = async (params: VisitsByPropertyParams): Promise<VisitsByPropertyData> => {
  try {
    return await apiClient.get<VisitsByPropertyData>(ENDPOINTS.VISITS_BY_PROPERTY, { params });
  } catch (error: any) {
    console.error('Error fetching visits by property report:', error.message);
    throw error;
  }
};

const getPropertySpecificReport = async (propertyId: string, params: PropertySpecificReportParams): Promise<PropertySpecificReportData> => {
  try {
    return await apiClient.get<PropertySpecificReportData>(ENDPOINTS.PROPERTY_SPECIFIC_REPORT(propertyId), { params });
  } catch (error: any) {
    console.error(`Error fetching report for property ${propertyId}:`, error.message);
    throw error;
  }
};

const getDashboardSummary = async (params?: { period: string; companyId?: string }): Promise<DashboardSummaryData> => {
  try {
    return await apiClient.get<DashboardSummaryData>(ENDPOINTS.DASHBOARD_SUMMARY, { params });
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error.message);
    throw error;
  }
};

/*const getDashboardSummary = async (params?: { period: string }): Promise<DashboardSummaryData> => {
  try {
    const response = await apiClient.get<DashboardSummaryData>(ENDPOINTS.DASHBOARD_SUMMARY, { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error.response?.data?.message || error.message);
    throw error;
  }
};*/

const getDailyVisits = async (params: DailyVisitsParams & { companyId?: string }): Promise<DailyVisit[]> => {
  try {
    const response = await apiClient.get<DailyVisit[]>(ENDPOINTS.DAILY_VISITS, { params });
    return Array.isArray(response) ? response : [];
  } catch (error: any) {
    console.error('Error fetching daily visits:', error.message);
    throw error;
  }
};

const getVisitsBySource = async (params: VisitsBySourceParams & { companyId?: string }): Promise<VisitSource[]> => {
  try {
    const response = await apiClient.get<VisitSource[]>(ENDPOINTS.VISITS_BY_SOURCE, { params });
    return Array.isArray(response) ? response : [];
  } catch (error: any) {
    console.error('Error fetching visits by source:', error.message);
    throw error;
  }
};

const reportService = {
  getMonthlySummary,
  getGeneralTotals,
  getVisitsByProperty,
  getPropertySpecificReport,
  getDashboardSummary,
  getDailyVisits,
  getVisitsBySource,
};

export default reportService;