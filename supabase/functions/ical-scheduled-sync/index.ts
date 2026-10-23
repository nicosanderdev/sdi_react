/**
 * Scheduled iCal Sync (Cron Job)
 *
 * Imports active iCal feeds. The Supabase dashboard schedule calls this with
 * Authorization: Bearer <service role key>. verify_jwt is off; the handler checks the token.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createLogger } from '../_shared/logger.ts'
import { logCronExecution } from '../_shared/adminActivityLog.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const logger = createLogger('ical-scheduled-sync')

const BATCH_SIZE = 50
const IMPORT_CONCURRENCY = 5
const SYNC_WINDOW_MS = 25 * 60 * 1000

interface SyncResult {
  integrationId: string
  success: boolean
  eventsProcessed?: number
  blocksUpserted?: number
  blocksDeleted?: number
  conflictsDetected?: number
  error?: string
  duration: number
}

interface CronJobResult {
  success: boolean
  integrationsProcessed: number
  successfulSyncs: number
  failedSyncs: number
  totalEventsProcessed: number
  totalDuration: number
  results: SyncResult[]
  error?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function bearerToken(req: Request): string {
  const header = req.headers.get('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function base64UrlBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const normalized = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** HS256 check for a project JWT. The service role key itself is matched separately. */
async function verifiedJwtRole(token: string): Promise<string | null> {
  const secret = Deno.env.get('SUPABASE_JWT_SECRET') ?? Deno.env.get('JWT_SECRET') ?? ''
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[0]))) as { alg?: string }
    if (header.alg !== 'HS256') return null
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    )
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[1]))) as { role?: unknown; exp?: unknown }
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

async function isAuthorizedCaller(req: Request): Promise<boolean> {
  const token = bearerToken(req)
  if (!token || !supabaseServiceKey) return false
  if (token === supabaseServiceKey) return true
  return (await verifiedJwtRole(token)) === 'service_role'
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index]) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

async function syncSingleIntegration(integrationId: string): Promise<SyncResult> {
  const startTime = Date.now()

  try {
    logger.info('sync_started', { integrationId })

    const response = await fetch(`${supabaseUrl}/functions/v1/calendar-sync/ical-sync/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        integrationId,
        action: 'import'
      })
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('sync_http_error', `HTTP ${response.status}: ${errorText}`, {
        integrationId,
        status: response.status,
        duration
      })

      return {
        integrationId,
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        duration
      }
    }

    const result = await response.json()
    logger.info('sync_completed', {
      integrationId,
      eventsProcessed: result.eventsProcessed,
      blocksUpserted: result.blocksUpserted,
      blocksDeleted: result.blocksDeleted,
      conflictsDetected: result.conflictsDetected,
      duration
    })

    return {
      integrationId,
      success: true,
      eventsProcessed: result.eventsProcessed || 0,
      blocksUpserted: result.blocksUpserted || 0,
      blocksDeleted: result.blocksDeleted || 0,
      conflictsDetected: result.conflictsDetected || 0,
      duration
    }
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('sync_failed', errorMessage(error), { integrationId, duration })

    return {
      integrationId,
      success: false,
      error: errorMessage(error),
      duration
    }
  }
}

async function getIntegrationsToSync(): Promise<Array<{ id: string; platformType: number; lastSyncAt?: string }>> {
  const cutoff = new Date(Date.now() - SYNC_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('CalendarIntegrations')
    .select('Id, PlatformType, LastSyncAt')
    .eq('IsActive', true)
    .in('PlatformType', [2, 3, 4])
    .eq('IsDeleted', false)
    .or(`LastSyncAt.is.null,LastSyncAt.lt.${cutoff}`)
    .order('LastSyncAt', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE)

  if (error) {
    throw new Error(`Failed to query integrations: ${error.message}`)
  }

  return (data || []).map(integration => ({
    id: integration.Id,
    platformType: integration.PlatformType,
    lastSyncAt: integration.LastSyncAt
  }))
}

function jsonResponse(body: CronJobResult, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!(await isAuthorizedCaller(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()
  logger.info('cron_job_started')

  try {
    const integrations = await getIntegrationsToSync()
    logger.info('integrations_found', { count: integrations.length })

    if (integrations.length === 0) {
      const result: CronJobResult = {
        success: true,
        integrationsProcessed: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        totalEventsProcessed: 0,
        totalDuration: Date.now() - startTime,
        results: []
      }

      await logCronExecution(req, 'ical-scheduled-sync', true, '0 integrations')
      return jsonResponse(result, 200)
    }

    const settled = await mapPool(integrations, IMPORT_CONCURRENCY, (integration) =>
      syncSingleIntegration(integration.id)
    )
    const syncResults: SyncResult[] = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value
      const integration = integrations[index]
      logger.error('promise_rejected', result.reason?.message || 'Promise rejected', {
        integrationId: integration.id
      })
      return {
        integrationId: integration.id,
        success: false,
        error: result.reason?.message || 'Promise rejected',
        duration: 0
      }
    })

    const successfulSyncs = syncResults.filter(r => r.success).length
    const failedSyncs = syncResults.filter(r => !r.success).length
    const totalEventsProcessed = syncResults.reduce((sum, r) => sum + (r.eventsProcessed || 0), 0)
    const totalDuration = Date.now() - startTime

    const cronResult: CronJobResult = {
      success: failedSyncs === 0,
      integrationsProcessed: integrations.length,
      successfulSyncs,
      failedSyncs,
      totalEventsProcessed,
      totalDuration,
      results: syncResults
    }

    logger.info('cron_job_completed', {
      successfulSyncs,
      totalSyncs: integrations.length,
      totalEventsProcessed,
      totalDuration,
      failureRate: integrations.length > 0 ? (failedSyncs / integrations.length) : 0
    })

    await logCronExecution(
      req,
      'ical-scheduled-sync',
      cronResult.success,
      cronResult.success
        ? `${cronResult.successfulSyncs}/${cronResult.integrationsProcessed} syncs`
        : `${cronResult.failedSyncs} failed`,
      {
        integrationsProcessed: cronResult.integrationsProcessed,
        successfulSyncs: cronResult.successfulSyncs,
        failedSyncs: cronResult.failedSyncs,
        totalEventsProcessed: cronResult.totalEventsProcessed,
      },
    )

    return jsonResponse(cronResult, cronResult.success ? 200 : 207)
  } catch (error) {
    const totalDuration = Date.now() - startTime
    const message = errorMessage(error)
    logger.error('cron_job_failed', message, { totalDuration })

    const errorResult: CronJobResult = {
      success: false,
      integrationsProcessed: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalEventsProcessed: 0,
      totalDuration,
      results: [],
      error: message
    }

    await logCronExecution(req, 'ical-scheduled-sync', false, message)
    return jsonResponse(errorResult, 500)
  }
})
