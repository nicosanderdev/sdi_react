import { supabase } from '../config/supabase';

export type AdminLogEventType = 'user' | 'property' | 'booking';

export interface AdminLogEntry {
  event_type: AdminLogEventType;
  action: string;
  at: string;
  target_id: string | null;
  target_display: string;
  performed_by_display: string;
  details: Record<string, unknown> | null;
}

/**
 * Fetches admin audit events for a given date from the get_admin_logs_for_date RPC.
 * Returns user actions (MemberActionHistory), property moderation (PropertyModerationActions),
 * and booking created/updated events. Requires admin role (RLS on underlying tables).
 */
export async function getLogsForDate(date: Date): Promise<AdminLogEntry[]> {
  const dateStr = date.toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc('get_admin_logs_for_date', {
    p_date: dateStr,
  });

  if (error) {
    throw new Error(`Failed to fetch admin logs: ${error.message}`);
  }

  return (data ?? []) as AdminLogEntry[];
}
