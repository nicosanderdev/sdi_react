// src/services/AdminService.ts
import { supabase } from '../config/supabase';

// Time range options for admin metrics
export type TimeRange = '7d' | '30d' | '90d' | 'custom';

// Activity types for admin activity endpoint
export type ActivityType = 'users' | 'properties' | 'flags';

// Admin metrics interfaces
export interface AdminMetricsSummary {
  totalUsers: number;
  totalProperties: number;
  activeUsers7d: number;
  activeUsers30d: number;
  activeProperties7d: number;
  activeProperties30d: number;
  newUsers: number;
  newProperties: number;
  pendingApprovals: number;
  flagsOpen: number;
  failedJobs?: number;
}

export interface AdminMetricsTimeseries {
  date: string; // "YYYY-MM-DD"
  users: number;
  properties: number;
}

export interface AdminActivityItem {
  id: string;
  name?: string; // For users
  title?: string; // For properties
  createdAt?: string;
  updatedAt?: string;
  status?: string;
}

export interface AdminActivityData {
  users: AdminActivityItem[];
  properties: AdminActivityItem[];
  flags: AdminActivityItem[];
}

export interface AdminDashboardStats {
  propertiesCount: number;
  usersCount: number;
  activeUsers: number;
  inactiveUsers: number;
  activeProperties: number;
  archivedProperties: number;
  subscriptionStats: {
    withoutSubscription: number;
    active: number;
    expired: number;
  };
  mrr: number;
  growth: {
    newUsers7d: number;
    newUsers30d: number;
    newProperties7d: number;
    newProperties30d: number;
  };
  usageStats: {
    avgPropertiesPerUser: number;
    usersWithoutProperties: number;
  };
  /** Property page view counts (from PropertyVisitLogs). Populated when get_admin_property_views_summary RPC exists. */
  totalPropertyViews?: number;
  viewsLast7Days?: number;
  viewsLast30Days?: number;
}

// Request parameters
export interface AdminMetricsParams {
  range: TimeRange;
  startDate?: string; // For custom range
  endDate?: string;   // For custom range
}

export interface AdminActivityParams extends AdminMetricsParams {
  type?: ActivityType;
  limit?: number;
}

class AdminService {
  /**
   * Fetch admin metrics summary
   */
  async getMetricsSummary(params: AdminMetricsParams): Promise<AdminMetricsSummary> {
    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    if (params.range === 'custom' && params.startDate && params.endDate) {
      startDate = new Date(params.startDate);
      endDate = new Date(params.endDate);
    } else {
      switch (params.range) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Get total users and properties
      const [usersResult, propertiesResult] = await Promise.all([
        supabase.from('Members').select('Id', { count: 'exact', head: true }).eq('IsDeleted', false),
        supabase.from('EstateProperties').select('Id', { count: 'exact', head: true }).eq('IsDeleted', false)
      ]);

      // Get active users (those who signed in within the last 30 days)
      const { data: activeUsers30dData, error: activeUsers30dError } = await supabase
        .rpc('get_active_users_count', { days_back: 30 });

      if (activeUsers30dError) throw activeUsers30dError;

      // Get active users within 7 days
      const { data: activeUsers7dData, error: activeUsers7dError } = await supabase
        .rpc('get_active_users_count', { days_back: 7 });

      if (activeUsers7dError) throw activeUsers7dError;

      // Get active properties (created within last 30 days)
      const { count: activeProperties30d } = await supabase
        .from('EstateProperties')
        .select('Id', { count: 'exact', head: true })
        .eq('IsDeleted', false)
        .gte('LastModified', thirtyDaysAgo.toISOString());

      // Get active properties within 7 days
      const { count: activeProperties7d } = await supabase
        .from('EstateProperties')
        .select('Id', { count: 'exact', head: true })
        .eq('IsDeleted', false)
        .gte('LastModified', sevenDaysAgo.toISOString());

      // Get new users within the period
      const { count: newUsers } = await supabase
        .from('Members')
        .select('Id', { count: 'exact', head: true })
        .eq('IsDeleted', false)
        .gte('Created', startDate.toISOString())
        .lte('Created', endDate.toISOString());

      // Get new properties within the period
      const { count: newProperties } = await supabase
        .from('EstateProperties')
        .select('Id', { count: 'exact', head: true })
        .eq('IsDeleted', false)
        .gte('Created', startDate.toISOString())
        .lte('Created', endDate.toISOString());

      // For pending approvals and flags, we'll return 0 since these tables may not exist yet
      // These would need to be implemented based on the actual schema

      return {
        totalUsers: usersResult.count || 0,
        totalProperties: propertiesResult.count || 0,
        activeUsers7d: activeUsers7dData || 0,
        activeUsers30d: activeUsers30dData || 0,
        activeProperties7d: activeProperties7d || 0,
        activeProperties30d: activeProperties30d || 0,
        newUsers: newUsers || 0,
        newProperties: newProperties || 0,
        pendingApprovals: 0, // Placeholder
        flagsOpen: 0, // Placeholder
        failedJobs: 0 // Placeholder
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch admin metrics summary: ${error.message}`);
    }
  }

  /**
   * Fetch admin metrics timeseries data
   */
  async getMetricsTimeseries(params: AdminMetricsParams): Promise<AdminMetricsTimeseries[]> {
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    if (params.range === 'custom' && params.startDate && params.endDate) {
      startDate = new Date(params.startDate);
      endDate = new Date(params.endDate);
    } else {
      switch (params.range) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    try {
      // Get user registration data aggregated by date
      const { data: userData, error: userError } = await supabase
        .from('Members')
        .select('Created')
        .eq('IsDeleted', false)
        .gte('Created', startDate.toISOString())
        .lte('Created', endDate.toISOString());

      if (userError) throw userError;

      // Get property creation data aggregated by date
      const { data: propertyData, error: propertyError } = await supabase
        .from('EstateProperties')
        .select('Created')
        .eq('IsDeleted', false)
        .gte('Created', startDate.toISOString())
        .lte('Created', endDate.toISOString());

      if (propertyError) throw propertyError;

      // Aggregate data by date
      const dateMap = new Map<string, { users: number; properties: number }>();

      // Process user data
      userData?.forEach(user => {
        const date = new Date(user.Created).toISOString().split('T')[0]; // YYYY-MM-DD format
        const existing = dateMap.get(date) || { users: 0, properties: 0 };
        existing.users++;
        dateMap.set(date, existing);
      });

      // Process property data
      propertyData?.forEach(property => {
        const date = new Date(property.Created).toISOString().split('T')[0]; // YYYY-MM-DD format
        const existing = dateMap.get(date) || { users: 0, properties: 0 };
        existing.properties++;
        dateMap.set(date, existing);
      });

      // Fill in missing dates with zeros and convert to array
      const result: AdminMetricsTimeseries[] = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const data = dateMap.get(dateKey) || { users: 0, properties: 0 };
        result.push({
          date: dateKey,
          users: data.users,
          properties: data.properties
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to fetch admin metrics timeseries: ${error.message}`);
    }
  }

  /**
   * Fetch admin activity data
   */
  async getActivityData(params: AdminActivityParams): Promise<AdminActivityData> {
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    if (params.range === 'custom' && params.startDate && params.endDate) {
      startDate = new Date(params.startDate);
      endDate = new Date(params.endDate);
    } else {
      switch (params.range) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    const limit = params.limit || 20;

    try {
      const activityData: AdminActivityData = {
        users: [],
        properties: [],
        flags: []
      };

      // Only fetch requested activity types or all if none specified
      const typesToFetch = params.type ? [params.type] : ['users', 'properties', 'flags'];

      if (typesToFetch.includes('users')) {
        // Get recent users
        const { data: users, error: usersError } = await supabase
          .from('Members')
          .select('Id, FirstName, LastName, Created, LastModified')
          .eq('IsDeleted', false)
          .gte('Created', startDate.toISOString())
          .lte('Created', endDate.toISOString())
          .order('Created', { ascending: false })
          .limit(limit);

        if (usersError) throw usersError;

        activityData.users = users?.map(user => ({
          id: user.Id,
          name: `${user.FirstName || ''} ${user.LastName || ''}`.trim() || 'Unknown User',
          createdAt: user.Created,
          updatedAt: user.LastModified,
          status: 'active' // All users from this query are active
        })) || [];
      }

      if (typesToFetch.includes('properties')) {
        // Get recent properties
        const { data: properties, error: propertiesError } = await supabase
          .from('EstateProperties')
          .select('Id, Title, Created, LastModified')
          .eq('IsDeleted', false)
          .gte('Created', startDate.toISOString())
          .lte('Created', endDate.toISOString())
          .order('Created', { ascending: false })
          .limit(limit);

        if (propertiesError) throw propertiesError;

        activityData.properties = properties?.map(property => ({
          id: property.Id,
          title: property.Title,
          createdAt: property.Created,
          updatedAt: property.LastModified,
          status: 'active' // All properties from this query are active
        })) || [];
      }

      if (typesToFetch.includes('flags')) {
        // For flags, we don't have a flags table yet, so return empty array
        activityData.flags = [];
      }

      return activityData;
    } catch (error: any) {
      throw new Error(`Failed to fetch admin activity data: ${error.message}`);
    }
  }

  /**
   * Fetch admin dashboard stats for executive overview.
   * Merges in property views summary from get_admin_property_views_summary when available.
   */
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats', {
      period: '30d'
    });

    if (error) {
      throw new Error(`Failed to fetch admin dashboard stats: ${error.message}`);
    }

    const stats = data as AdminDashboardStats;

    const { data: viewsSummary } = await supabase.rpc('get_admin_property_views_summary', {
      p_period_7d: 'last7days',
      p_period_30d: 'last30days'
    });

    if (viewsSummary && typeof viewsSummary === 'object') {
      const v = viewsSummary as { totalPropertyViews?: number; viewsLast7Days?: number; viewsLast30Days?: number };
      return {
        ...stats,
        totalPropertyViews: v.totalPropertyViews ?? stats.totalPropertyViews,
        viewsLast7Days: v.viewsLast7Days ?? stats.viewsLast7Days,
        viewsLast30Days: v.viewsLast30Days ?? stats.viewsLast30Days
      };
    }

    return stats;
  }
}

const adminService = new AdminService();
export default adminService;
