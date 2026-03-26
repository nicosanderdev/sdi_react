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
  /** Properties no longer have Created/LastModified on EstateProperties after listing refactor; use Listings. */
  private async countDistinctPropertiesWithListingsModifiedSince(sinceIso: string): Promise<number> {
    const { data, error } = await supabase
      .from('Listings')
      .select('EstatePropertyId')
      .eq('IsDeleted', false)
      .gte('LastModified', sinceIso);
    if (error) throw error;
    return new Set((data ?? []).map((r: { EstatePropertyId: string }) => r.EstatePropertyId)).size;
  }

  private async countDistinctPropertiesWithListingCreatedBetween(startIso: string, endIso: string): Promise<number> {
    const { data, error } = await supabase
      .from('Listings')
      .select('EstatePropertyId')
      .eq('IsDeleted', false)
      .gte('Created', startIso)
      .lte('Created', endIso);
    if (error) throw error;
    return new Set((data ?? []).map((r: { EstatePropertyId: string }) => r.EstatePropertyId)).size;
  }

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

      const activeProperties30d = await this.countDistinctPropertiesWithListingsModifiedSince(
        thirtyDaysAgo.toISOString()
      );
      const activeProperties7d = await this.countDistinctPropertiesWithListingsModifiedSince(
        sevenDaysAgo.toISOString()
      );

      // Get new users within the period
      const { count: newUsers } = await supabase
        .from('Members')
        .select('Id', { count: 'exact', head: true })
        .eq('IsDeleted', false)
        .gte('Created', startDate.toISOString())
        .lte('Created', endDate.toISOString());

      const newProperties = await this.countDistinctPropertiesWithListingCreatedBetween(
        startDate.toISOString(),
        endDate.toISOString()
      );

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
        newProperties,
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

      const { data: propertyData, error: propertyError } = await supabase
        .from('Listings')
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

      propertyData?.forEach(listing => {
        const date = new Date(listing.Created).toISOString().split('T')[0];
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
        const { data: listings, error: listingsError } = await supabase
          .from('Listings')
          .select('EstatePropertyId, Title, Created, LastModified')
          .eq('IsDeleted', false)
          .gte('Created', startDate.toISOString())
          .lte('Created', endDate.toISOString())
          .order('Created', { ascending: false })
          .limit(Math.max(limit * 4, 40));

        if (listingsError) throw listingsError;

        const seen = new Set<string>();
        const properties: AdminActivityItem[] = [];
        for (const row of listings ?? []) {
          const pid = row.EstatePropertyId as string;
          if (seen.has(pid)) continue;
          seen.add(pid);
          properties.push({
            id: pid,
            title: row.Title as string,
            createdAt: row.Created as string,
            updatedAt: row.LastModified as string,
            status: 'active'
          });
          if (properties.length >= limit) break;
        }
        activityData.properties = properties;
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
   * When get_admin_dashboard_stats RPC is missing or fails, compose KPIs from listing-aware metrics.
   */
  private async buildDashboardStatsFallback(): Promise<AdminDashboardStats> {
    const [summary30d, summary7d, usersHead, propsHead, active30Rpc] = await Promise.all([
      this.getMetricsSummary({ range: '30d' }),
      this.getMetricsSummary({ range: '7d' }),
      supabase.from('Members').select('Id', { count: 'exact', head: true }).eq('IsDeleted', false),
      supabase.from('EstateProperties').select('Id', { count: 'exact', head: true }).eq('IsDeleted', false),
      supabase.rpc('get_active_users_count', { days_back: 30 })
    ]);

    if (usersHead.error) throw usersHead.error;
    if (propsHead.error) throw propsHead.error;
    if (active30Rpc.error) throw active30Rpc.error;

    const usersCount = usersHead.count ?? 0;
    const propertiesCount = propsHead.count ?? 0;
    const activeUsers = (active30Rpc.data as number) ?? 0;
    const inactiveUsers = Math.max(0, usersCount - activeUsers);

    const { data: activeListRows, error: activeListErr } = await supabase
      .from('Listings')
      .select('EstatePropertyId')
      .eq('IsDeleted', false)
      .eq('IsActive', true)
      .eq('IsPropertyVisible', true);

    if (activeListErr) throw activeListErr;
    const activeProperties = new Set(
      (activeListRows ?? []).map((r: { EstatePropertyId: string }) => r.EstatePropertyId)
    ).size;
    const archivedProperties = Math.max(0, propertiesCount - activeProperties);
    const avgPU = usersCount > 0 ? propertiesCount / usersCount : 0;

    return {
      propertiesCount,
      usersCount,
      activeUsers,
      inactiveUsers,
      activeProperties,
      archivedProperties,
      subscriptionStats: { withoutSubscription: 0, active: 0, expired: 0 },
      mrr: 0,
      growth: {
        newUsers7d: summary7d.newUsers,
        newUsers30d: summary30d.newUsers,
        newProperties7d: summary7d.newProperties,
        newProperties30d: summary30d.newProperties
      },
      usageStats: {
        avgPropertiesPerUser: avgPU,
        usersWithoutProperties: 0
      }
    };
  }

  private mergeViewsSummary(
    stats: AdminDashboardStats,
    viewsSummary: unknown
  ): AdminDashboardStats {
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

  /**
   * Fetch admin dashboard stats for executive overview.
   * Merges in property views summary from get_admin_property_views_summary when available.
   */
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats', {
      period: '30d'
    });

    if (!error && data != null) {
      let stats = data as AdminDashboardStats;
      const { data: viewsSummary, error: viewsErr } = await supabase.rpc('get_admin_property_views_summary', {
        p_period_7d: 'last7days',
        p_period_30d: 'last30days'
      });
      if (!viewsErr) {
        stats = this.mergeViewsSummary(stats, viewsSummary);
      }
      return stats;
    }

    let stats = await this.buildDashboardStatsFallback();
    const { data: viewsSummary, error: viewsErr } = await supabase.rpc('get_admin_property_views_summary', {
      p_period_7d: 'last7days',
      p_period_30d: 'last30days'
    });
    if (!viewsErr) {
      stats = this.mergeViewsSummary(stats, viewsSummary);
    }
    return stats;
  }
}

const adminService = new AdminService();
export default adminService;
