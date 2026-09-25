/**
 * Admin-only dispatcher for scheduled Edge Functions.
 * GET: catalog. POST { job }: proxy to the existing function with the service role.
 * Cron endpoints are unchanged; this is the dashboard auth door.
 * Passes x-admin-activity-actor so jobs attribute the run to the admin.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { CRON_ACTOR_HEADER } from '../_shared/adminActivityLog.ts'
import {
  authenticateUser,
  createForbiddenResponse,
  createUnauthorizedResponse,
  isAdmin,
  type AuthUser,
} from '../_shared/auth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const JOBS = [
  {
    id: 'receipts-generate',
    label: 'Generación de facturas',
    description:
      'Crea facturas de ciclos flexibles listos y puede enviar el email. Efecto real.',
  },
  {
    id: 'flexible-invoice-overdue-unpublish',
    label: 'Despublicar por facturas vencidas',
    description:
      'Despublica anuncios de sujetos con facturas vencidas (gracia incluida). Efecto real.',
  },
  {
    id: 'daily-property-search-scores',
    label: 'Scoring de búsqueda',
    description:
      'Recalcula puntuaciones de búsqueda de anuncios visibles. Puede tardar varios minutos.',
  },
  {
    id: 'ical-scheduled-sync',
    label: 'Sincronización iCal',
    description:
      'Importa iCal de integraciones activas que no se sincronizaron en los últimos 30 minutos (igual que el cron). Cero procesadas no es un fallo si se sincronizaron hace poco.',
  },
] as const

const ALLOWED_JOB_IDS = new Set<string>(JOBS.map((job) => job.id))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function requireAdmin(req: Request): Promise<{ error: Response } | { user: AuthUser }> {
  const authResult = await authenticateUser(req)
  if (authResult.error || !authResult.user) {
    return { error: createUnauthorizedResponse(authResult.error ?? 'Authentication failed') }
  }
  if (!isAdmin(authResult.user)) {
    return { error: createForbiddenResponse('Admin only') }
  }
  return { user: authResult.user }
}

async function memberIdForUser(userId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data } = await supabase
    .from('Members')
    .select('Id')
    .eq('UserId', userId)
    .eq('IsDeleted', false)
    .limit(1)
    .maybeSingle()
  return data?.Id ?? null
}

async function proxyJob(jobId: string, actorHeader: string): Promise<Response> {
  const response = await fetch(`${supabaseUrl}/functions/v1/${jobId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      [CRON_ACTOR_HEADER]: actorHeader,
    },
    body: JSON.stringify({}),
  })

  const text = await response.text()
  try {
    const parsed = JSON.parse(text) as unknown
    return jsonResponse(response.status, parsed)
  } catch {
    return jsonResponse(response.status || 502, {
      success: false,
      error: text.slice(0, 500) || `HTTP ${response.status}`,
    })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  if (req.method === 'GET') {
    return jsonResponse(200, { jobs: JOBS })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const payload = (await req.json().catch(() => ({}))) as { job?: unknown }
  const jobId = typeof payload.job === 'string' ? payload.job.trim() : ''

  if (!jobId) {
    return jsonResponse(400, { error: 'job is required' })
  }
  if (!ALLOWED_JOB_IDS.has(jobId)) {
    return jsonResponse(400, { error: 'Unknown job' })
  }

  const memberId = await memberIdForUser(auth.user.id)
  const actorHeader = memberId ? `member:${memberId}` : (auth.user.email || auth.user.id)

  try {
    return await proxyJob(jobId, actorHeader)
  } catch (error) {
    return jsonResponse(502, {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invoke job',
    })
  }
})
