import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AdminActivityEventType = 'user' | 'property' | 'booking' | 'company' | 'system'

export interface LogAdminActivityInput {
  eventType: AdminActivityEventType
  action: string
  targetId?: string | null
  targetDisplay: string
  performedBy?: string | null
  performedByDisplay?: string | null
  details?: Record<string, unknown> | null
}

function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Insert one AdminActivityLog row via SECURITY DEFINER RPC. */
export async function logAdminActivity(
  input: LogAdminActivityInput,
  client: SupabaseClient = serviceClient(),
): Promise<void> {
  const { error } = await client.rpc('log_admin_activity', {
    p_event_type: input.eventType,
    p_action: input.action,
    p_target_id: input.targetId ?? null,
    p_target_display: input.targetDisplay,
    p_performed_by: input.performedBy ?? null,
    p_performed_by_display: input.performedByDisplay ?? null,
    p_details: input.details ?? null,
  })
  if (error) {
    console.error('log_admin_activity failed:', error.message)
  }
}

export const CRON_ACTOR_HEADER = 'x-admin-activity-actor'

/** Parse optional actor header from admin-run-cron: `member:<uuid>` or display name. */
export function cronActorFromRequest(req: Request): {
  performedBy: string | null
  performedByDisplay: string
} {
  const raw = req.headers.get(CRON_ACTOR_HEADER)?.trim() ?? ''
  if (raw.startsWith('member:')) {
    const id = raw.slice('member:'.length).trim()
    if (id) return { performedBy: id, performedByDisplay: '' }
  }
  if (raw) return { performedBy: null, performedByDisplay: raw }
  return { performedBy: null, performedByDisplay: 'Cron' }
}

export async function logCronExecution(
  req: Request,
  jobId: string,
  ok: boolean,
  summary: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const actor = cronActorFromRequest(req)
  const targetDisplay = ok
    ? `${jobId}: ok${summary ? ` — ${summary}` : ''}`
    : `${jobId}: error — ${summary.slice(0, 200)}`
  await logAdminActivity({
    eventType: 'system',
    action: 'cron_execution',
    targetId: null,
    targetDisplay,
    performedBy: actor.performedBy,
    performedByDisplay: actor.performedByDisplay || (actor.performedBy ? null : 'Cron'),
    details: { jobId, success: ok, ...(details ?? {}) },
  })
}
