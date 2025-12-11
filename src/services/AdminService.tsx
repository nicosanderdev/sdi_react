// src/services/AdminService.ts
import apiClient from './AxiosClient';

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
    const queryParams = new URLSearchParams();

    if (params.range === 'custom' && params.startDate && params.endDate) {
      queryParams.set('startDate', params.startDate);
      queryParams.set('endDate', params.endDate);
    } else {
      queryParams.set('range', params.range);
    }

    return apiClient.get(`/admin/metrics/summary?${queryParams.toString()}`);
  }

  /**
   * Fetch admin metrics timeseries data
   */
  async getMetricsTimeseries(params: AdminMetricsParams): Promise<AdminMetricsTimeseries[]> {
    const queryParams = new URLSearchParams();

    if (params.range === 'custom' && params.startDate && params.endDate) {
      queryParams.set('startDate', params.startDate);
      queryParams.set('endDate', params.endDate);
    } else {
      queryParams.set('range', params.range);
    }

    return apiClient.get(`/admin/metrics/timeseries?${queryParams.toString()}`);
  }

  /**
   * Fetch admin activity data
   */
  async getActivityData(params: AdminActivityParams): Promise<AdminActivityData> {
    const queryParams = new URLSearchParams();

    if (params.range === 'custom' && params.startDate && params.endDate) {
      queryParams.set('startDate', params.startDate);
      queryParams.set('endDate', params.endDate);
    } else {
      queryParams.set('range', params.range);
    }

    if (params.type) {
      queryParams.set('type', params.type);
    }

    if (params.limit) {
      queryParams.set('limit', params.limit.toString());
    }

    return apiClient.get(`/admin/metrics/activity?${queryParams.toString()}`);
  }
}

const adminService = new AdminService();
export default adminService;
