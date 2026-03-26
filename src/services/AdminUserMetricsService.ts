// src/services/AdminUserMetricsService.ts

export interface AdminUserMetrics {
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
}

export const AdminUserMetricsService = {
  async fetchUserMetrics(): Promise<AdminUserMetrics> {
    // Placeholder implementation – wire to Supabase RPC or edge function later.
    return {
      totalUsers: 0,
      activeUsers: 0,
      verifiedUsers: 0,
      unverifiedUsers: 0,
    };
  },
};

export default AdminUserMetricsService;

