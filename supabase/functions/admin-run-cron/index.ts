/**
 * Admin-only dispatcher for scheduled Edge Functions.
 * GET: catalog. POST { job }: proxy to the existing function with the service role.
 * Cron endpoints are unchanged; this is the dashboard auth door.
 */

import { corsHeaders } from '../_shared/cors.ts'
import {
  authenticateUser,
  createForbiddenResponse,
  createUnauthorizedResponse,
  isAdmin,
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

async function requireAdmin(req: Request): Promise<Response | null> {
  const authResult = await authenticateUser(req)
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed')
  }
  if (!isAdmin(authResult.user)) {
    return createForbiddenResponse('Admin only')
  }
  return null
}

async function proxyJob(jobId: string): Promise<Response> {
  const response = await fetch(`${supabaseUrl}/functions/v1/${jobId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
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

  const denied = await requireAdmin(req)
  if (denied) return denied

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

  try {
    return await proxyJob(jobId)
  } catch (error) {
    return jsonResponse(502, {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invoke job',
    })
  }
})
