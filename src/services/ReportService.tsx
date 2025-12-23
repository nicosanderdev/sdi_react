// src/services/reportService.ts
import { supabase } from '../config/supabase';
import {
  getCurrentUserId,
  parsePeriod,
  fillDateRange
} from './SupabaseHelpers';

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


// --- Service Functions (adapting params and return types) ---

const getMonthlySummary = async (params: MonthlySummaryParams): Promise<MonthlySummaryData> => {
  try {
    const userId = await getCurrentUserId();

    // Calculate date range for the month
    const startDate = new Date(params.year, params.month - 1, 1);
    const endDate = new Date(params.year, params.month, 0, 23, 59, 59);

    // Get accessible company IDs for filtering
    const { data: userCompanies } = await supabase
      .from('UserCompanies')
      .select('CompanyId')
      .eq('MemberId', (await supabase.from('Members').select('Id').eq('UserId', userId).single()).data?.Id)
      .eq('IsDeleted', false);

    const companyIds = userCompanies?.map(uc => uc.CompanyId) || [];

    // Query visits grouped by date
    const { data: visitsData, error: visitsError } = await supabase
      .from('PropertyVisitLogs')
      .select(`
        VisitedOnUtc,
        EstateProperties!inner(
          OwnerId,
          Owners!inner(OwnerType, CompanyId)
        )
      `)
      .gte('VisitedOnUtc', startDate.toISOString())
      .lte('VisitedOnUtc', endDate.toISOString())
      .eq('EstateProperties.Owners.OwnerType', 'company')
      .in('EstateProperties.Owners.CompanyId', companyIds);

    if (visitsError) throw visitsError;

    // Query messages grouped by date
    const { data: messagesData, error: messagesError } = await supabase
      .from('PropertyMessageLogs')
      .select(`
        SentOnUtc,
        EstateProperties!inner(
          OwnerId,
          Owners!inner(OwnerType, CompanyId)
        )
      `)
      .gte('SentOnUtc', startDate.toISOString())
      .lte('SentOnUtc', endDate.toISOString())
      .eq('EstateProperties.Owners.OwnerType', 'company')
      .in('EstateProperties.Owners.CompanyId', companyIds);

    if (messagesError) throw messagesError;

    // Group visits by date
    const visitsByDate = (visitsData || []).reduce((acc, visit) => {
      const date = new Date(visit.VisitedOnUtc).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group messages by date
    const messagesByDate = (messagesData || []).reduce((acc, message) => {
      const date = new Date(message.SentOnUtc).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Fill missing dates for visits
    const visitsArray = fillDateRange(
      startDate,
      endDate,
      (date) => date.toISOString().split('T')[0],
      Object.entries(visitsByDate).map(([date, count]) => ({ date, count }))
    );

    // Fill missing dates for messages
    const messagesArray = fillDateRange(
      startDate,
      endDate,
      (date) => date.toISOString().split('T')[0],
      Object.entries(messagesByDate).map(([date, count]) => ({ date, count }))
    );

    return {
      visits: visitsArray,
      messages: messagesArray
    };

  } catch (error: any) {
    console.error('Error fetching monthly summary report:', error.message);
    throw error;
  }
};

const getGeneralTotals = async (): Promise<GeneralTotalsData> => {
  try {
    const userId = await getCurrentUserId();

    // Get accessible company IDs for filtering
    const { data: userCompanies } = await supabase
      .from('UserCompanies')
      .select('CompanyId')
      .eq('MemberId', (await supabase.from('Members').select('Id').eq('UserId', userId).single()).data?.Id)
      .eq('IsDeleted', false);

    const companyIds = userCompanies?.map(uc => uc.CompanyId) || [];

    // Get total properties
    const { count: totalProperties, error: propertiesError } = await supabase
      .from('EstateProperties')
      .select('*, Owners!inner(OwnerType, CompanyId)', { count: 'exact', head: true })
      .eq('Owners.OwnerType', 'company')
      .in('Owners.CompanyId', companyIds);

    if (propertiesError) throw propertiesError;

    // Get total visits
    const { count: totalVisitsLifetime, error: visitsError } = await supabase
      .from('PropertyVisitLogs')
      .select(`
        *,
        EstateProperties!inner(
          OwnerId,
          Owners!inner(OwnerType, CompanyId)
        )
      `, { count: 'exact', head: true })
      .eq('EstateProperties.Owners.OwnerType', 'company')
      .in('EstateProperties.Owners.CompanyId', companyIds);

    if (visitsError) throw visitsError;

    // Get total messages
    const { count: totalMessagesLifetime, error: messagesError } = await supabase
      .from('PropertyMessageLogs')
      .select(`
        *,
        EstateProperties!inner(
          OwnerId,
          Owners!inner(OwnerType, CompanyId)
        )
      `, { count: 'exact', head: true })
      .eq('EstateProperties.Owners.OwnerType', 'company')
      .in('EstateProperties.Owners.CompanyId', companyIds);

    if (messagesError) throw messagesError;

    // Get active listings (Sale or Rent status with visible properties)
    const { count: activeListings, error: activeError } = await supabase
      .from('EstatePropertyValues')
      .select(`
        *,
        EstateProperties!inner(
          OwnerId,
          Owners!inner(OwnerType, CompanyId)
        )
      `, { count: 'exact', head: true })
      .eq('IsPropertyVisible', true)
      .eq('IsDeleted', false)
      .eq('IsFeatured', true)
      .in('Status', [0, 1]) // Sale or Rent
      .eq('EstateProperties.Owners.OwnerType', 'company')
      .in('EstateProperties.Owners.CompanyId', companyIds);

    if (activeError) throw activeError;

    // For now, average price calculation is commented out as it requires more complex logic
    const averagePrice = undefined;

    return {
      totalProperties: totalProperties || 0,
      totalVisitsLifetime: totalVisitsLifetime || 0,
      totalMessagesLifetime: totalMessagesLifetime || 0,
      activeListings: activeListings || 0,
      averagePrice
    };

  } catch (error: any) {
    console.error('Error fetching general totals report:', error.message);
    throw error;
  }
};

const getVisitsByProperty = async (params: VisitsByPropertyParams): Promise<VisitsByPropertyData> => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('get_visits_by_property', {
      p_period: params.period || 'last30days',
      p_page: params.page || 1,
      p_limit: params.limit || 10,
      p_company_id: null, // Will be passed from component if needed
      p_user_id: userId
    });

    if (error) throw error;

    return data as VisitsByPropertyData;

  } catch (error: any) {
    console.error('Error fetching visits by property report:', error.message);
    throw error;
  }
};

const getPropertySpecificReport = async (propertyId: string, params: PropertySpecificReportParams): Promise<PropertySpecificReportData> => {
  try {
    const { startDate, endDate } = parsePeriod(params.period || 'last30days');

    // Get property details
    const { data: propertyData, error: propertyError } = await supabase
      .from('EstateProperties')
      .select(`
        Id, Title, StreetName, HouseNumber, City, State, ZipCode, Country,
        EstatePropertyValues!inner(
          Description,
          AvailableFrom,
          Capacity,
          SalePrice,
          RentPrice,
          HasCommonExpenses,
          CommonExpensesValue,
          IsElectricityIncluded,
          IsWaterIncluded,
          Status
        )
      `)
      .eq('Id', propertyId)
      .eq('IsDeleted', false)
      .eq('EstatePropertyValues.IsDeleted', false)
      .eq('EstatePropertyValues.IsFeatured', true)
      .single();

    if (propertyError) throw propertyError;
    if (!propertyData) throw new Error('Property not found');

    // Get visit trend
    const { data: visitData, error: visitError } = await supabase
      .from('PropertyVisitLogs')
      .select('VisitedOnUtc')
      .eq('PropertyId', propertyId)
      .gte('VisitedOnUtc', startDate.toISOString())
      .lte('VisitedOnUtc', endDate.toISOString());

    if (visitError) throw visitError;

    // Get message trend
    const { data: messageData, error: messageError } = await supabase
      .from('PropertyMessageLogs')
      .select('SentOnUtc')
      .eq('PropertyId', propertyId)
      .gte('SentOnUtc', startDate.toISOString())
      .lte('SentOnUtc', endDate.toISOString());

    if (messageError) throw messageError;

    // Group visits by date
    const visitTrendMap = (visitData || []).reduce((acc, visit) => {
      const date = new Date(visit.VisitedOnUtc).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group messages by date
    const messageTrendMap = (messageData || []).reduce((acc, message) => {
      const date = new Date(message.SentOnUtc).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Fill missing dates for visit trend
    const visitTrend = fillDateRange(
      startDate,
      endDate,
      (date) => date.toISOString().split('T')[0],
      Object.entries(visitTrendMap).map(([date, count]) => ({ date, count }))
    );

    // Fill missing dates for message trend
    const messageTrend = fillDateRange(
      startDate,
      endDate,
      (date) => date.toISOString().split('T')[0],
      Object.entries(messageTrendMap).map(([date, count]) => ({ date, count }))
    );

    // Calculate conversion rate
    const totalVisits = visitTrend.reduce((sum, item) => sum + item.count, 0);
    const totalMessages = messageTrend.reduce((sum, item) => sum + item.count, 0);
    const conversionRate = totalVisits > 0 ? totalMessages / totalVisits : undefined;

    return {
      propertyDetails: {
        id: propertyData.Id,
        title: propertyData.Title,
        address: `${propertyData.StreetName} ${propertyData.HouseNumber}, ${propertyData.City}, ${propertyData.State}`
      },
      visitTrend,
      messageTrend,
      conversionRate,
      averageTimeToRespond: 'N/A' // Placeholder
    };

  } catch (error: any) {
    console.error(`Error fetching report for property ${propertyId}:`, error.message);
    throw error;
  }
};

const getDashboardSummary = async (params?: { period: string; companyId?: string }): Promise<DashboardSummaryData> => {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('get_dashboard_summary', {
      p_period: params?.period || 'last30days',
      p_company_id: params?.companyId ? params.companyId : null,
      p_user_id: userId
    });

    if (error) throw error;

    return data as DashboardSummaryData;

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
    const userId = await getCurrentUserId();
    const { startDate, endDate } = parsePeriod(params.period || 'last7days');

    // Get accessible company IDs for filtering
    let companyIds: string[] = [];
    if (params.companyId) {
      // If specific company requested, validate user has access
      const { data: userCompany } = await supabase
        .from('UserCompanies')
        .select('CompanyId')
        .eq('MemberId', (await supabase.from('Members').select('Id').eq('UserId', userId).single()).data?.Id)
        .eq('CompanyId', params.companyId)
        .eq('IsDeleted', false)
        .single();

      if (userCompany) {
        companyIds = [userCompany.CompanyId];
      }
    } else {
      // Get all accessible companies for the user
      const { data: userCompanies } = await supabase
        .from('UserCompanies')
        .select('CompanyId')
        .eq('MemberId', (await supabase.from('Members').select('Id').eq('UserId', userId).single()).data?.Id)
        .eq('IsDeleted', false);

      companyIds = userCompanies?.map(uc => uc.CompanyId) || [];
    }

    // Query visits grouped by date
    const { data: visitsData, error } = await supabase
      .from('PropertyVisitLogs')
      .select(`
        VisitedOnUtc,
        EstateProperties!inner(
          OwnerId,
          Owners!inner(OwnerType, CompanyId)
        )
      `)
      .gte('VisitedOnUtc', startDate.toISOString())
      .lte('VisitedOnUtc', endDate.toISOString())
      .eq('EstateProperties.Owners.OwnerType', 'company')
      .in('EstateProperties.Owners.CompanyId', companyIds);

    if (error) throw error;

    // Group visits by date
    const visitsByDate = (visitsData || []).reduce((acc, visit) => {
      const date = new Date(visit.VisitedOnUtc);
      const dateKey = date.toISOString().split('T')[0];
      acc[dateKey] = (acc[dateKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Fill missing dates and format for chart
    const filledData = fillDateRange(
      startDate,
      endDate,
      (date) => date.toISOString().split('T')[0],
      Object.entries(visitsByDate).map(([date, visits]) => ({ date, count: visits }))
    );

    return filledData.map(item => ({
      date: item.date,
      dayName: new Date(item.date).toLocaleDateString('es-ES', { weekday: 'short' }), // Spanish day names like "lun", "mar"
      visits: item.count
    }));

  } catch (error: any) {
    console.error('Error fetching daily visits:', error.message);
    throw error;
  }
};

const getVisitsBySource = async (params: VisitsBySourceParams & { companyId?: string }): Promise<VisitSource[]> => {
  try {
    const userId = await getCurrentUserId();
    const { startDate, endDate } = parsePeriod(params.period || 'last30days');

    // Get accessible company IDs for filtering
    let companyIds: string[] = [];
    if (params.companyId) {
      // If specific company requested, validate user has access
      const { data: userCompany } = await supabase
        .from('UserCompanies')
        .select('CompanyId')
        .eq('MemberId', (await supabase.from('Members').select('Id').eq('UserId', userId).single()).data?.Id)
        .eq('CompanyId', params.companyId)
        .eq('IsDeleted', false)
        .single();

      if (userCompany) {
        companyIds = [userCompany.CompanyId];
      }
    } else {
      // Get all accessible companies for the user
      const { data: userCompanies } = await supabase
        .from('UserCompanies')
        .select('CompanyId')
        .eq('MemberId', (await supabase.from('Members').select('Id').eq('UserId', userId).single()).data?.Id)
        .eq('IsDeleted', false);

      companyIds = userCompanies?.map(uc => uc.CompanyId) || [];
    }

    // Query visits grouped by source
    const { data: visitsData, error } = await supabase
      .from('PropertyVisitLogs')
      .select(`
        Source,
        EstateProperties!inner(
          OwnerId,
          Owners!inner(OwnerType, CompanyId)
        )
      `)
      .gte('VisitedOnUtc', startDate.toISOString())
      .lte('VisitedOnUtc', endDate.toISOString())
      .not('Source', 'is', null)
      .eq('EstateProperties.Owners.OwnerType', 'company')
      .in('EstateProperties.Owners.CompanyId', companyIds);

    if (error) throw error;

    // Group by source and count
    const sourceCounts = (visitsData || []).reduce((acc, visit) => {
      const source = visit.Source || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort by visits descending
    const result: VisitSource[] = Object.entries(sourceCounts)
      .map(([source, visits]) => ({ source, visits }))
      .sort((a, b) => b.visits - a.visits);

    return result;

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