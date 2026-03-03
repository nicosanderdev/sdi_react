/**
 * Scheduled iCal Sync (Cron Job)
 *
 * Automatically syncs iCal feeds for all active iCal integrations.
 * Runs every 30 minutes as configured in Supabase dashboard.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createLogger } from '../_shared/logger.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const logger = createLogger('ical-scheduled-sync')

// Batch size for processing integrations
const BATCH_SIZE = 50

interface SyncResult {
  integrationId: string
  success: boolean
  eventsProcessed?: number
  blocksCreated?: number
  blocksUpdated?: number
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

/**
 * Sync a single iCal integration
 */
async function syncSingleIntegration(integrationId: string): Promise<SyncResult> {
  const startTime = Date.now()

  try {
    logger.info('sync_started', { integrationId })

    // Call the iCal import function
    const response = await fetch(`${supabaseUrl}/functions/v1/ical-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        integrationId,
        forceRefresh: false
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
      blocksCreated: result.blocksCreated,
      blocksUpdated: result.blocksUpdated,
      blocksDeleted: result.blocksDeleted,
      conflictsDetected: result.conflictsDetected,
      duration
    })

    return {
      integrationId,
      success: true,
      eventsProcessed: result.eventsProcessed || 0,
      blocksCreated: result.blocksCreated || 0,
      blocksUpdated: result.blocksUpdated || 0,
      blocksDeleted: result.blocksDeleted || 0,
      conflictsDetected: result.conflictsDetected || 0,
      duration
    }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('sync_failed', error.message, { integrationId, duration })

    return {
      integrationId,
      success: false,
      error: error.message,
      duration
    }
  }
}

/**
 * Get active iCal integrations that need syncing
 */
async function getIntegrationsToSync(): Promise<Array<{ id: string; platformType: number; lastSyncAt?: string }>> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('CalendarIntegrations')
    .select('Id, PlatformType, LastSyncAt')
    .eq('IsActive', true)
    .in('PlatformType', [2, 3, 4]) // iCal platform types only
    .eq('IsDeleted', false)
    .or(`LastSyncAt.is.null,LastSyncAt.lt.${thirtyMinutesAgo}`)
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

/**
 * Log cron job execution for monitoring
 */
async function logCronJobExecution(result: CronJobResult) {
  try {
    await supabase
      .from('AuditLogs')
      .insert({
        Action: 'ICAL_SCHEDULED_SYNC_EXECUTED',
        EntityType: 'System',
        EntityId: 'ical-scheduled-sync',
        Details: {
          success: result.success,
          integrationsProcessed: result.integrationsProcessed,
          successfulSyncs: result.successfulSyncs,
          failedSyncs: result.failedSyncs,
          totalEventsProcessed: result.totalEventsProcessed,
          totalDuration: result.totalDuration,
          // Log summary, not full results to avoid size limits
          resultsSummary: result.results.map(r => ({
            integrationId: r.integrationId,
            success: r.success,
            eventsProcessed: r.eventsProcessed,
            duration: r.duration,
            error: r.error ? r.error.substring(0, 100) : undefined
          }))
        },
        Created: new Date().toISOString()
      })

    // Alert on high failure rate
    if (result.integrationsProcessed > 0) {
      const failureRate = result.failedSyncs / result.integrationsProcessed
      if (failureRate > 0.5) {
        console.error(`ALERT: High iCal sync failure rate: ${failureRate * 100}% (${result.failedSyncs}/${result.integrationsProcessed})`)

        // Could send email alert here in production
        await supabase
          .from('AuditLogs')
          .insert({
            Action: 'ICAL_SYNC_ALERT',
            EntityType: 'System',
            EntityId: 'ical-scheduled-sync',
            Details: {
              alertType: 'HIGH_FAILURE_RATE',
              failureRate,
              failedSyncs: result.failedSyncs,
              totalSyncs: result.integrationsProcessed,
              results: result.results.filter(r => !r.success)
            },
            Created: new Date().toISOString()
          })
      }
    }

  } catch (error) {
    console.error('Failed to log cron job execution:', error)
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests (cron jobs use POST)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()
  logger.info('cron_job_started')

  try {
    // Get integrations that need syncing
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

      await logCronJobExecution(result)

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process integrations in parallel with concurrency control
    const syncPromises = integrations.map(integration =>
      syncSingleIntegration(integration.id)
    )

    const results = await Promise.allSettled(syncPromises)
    const syncResults: SyncResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        // Handle promise rejection
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
      }
    })

    // Calculate summary statistics
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
      failureRate: integrations.length > 0 ? ((integrations.length - successfulSyncs) / integrations.length) : 0
    })

    // Log execution for monitoring
    await logCronJobExecution(cronResult)

    return new Response(JSON.stringify(cronResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const totalDuration = Date.now() - startTime
    logger.error('cron_job_failed', error.message, { totalDuration })

    const errorResult: CronJobResult = {
      success: false,
      integrationsProcessed: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalEventsProcessed: 0,
      totalDuration,
      results: [],
      error: error.message
    }

    // Log the error
    await logCronJobExecution(errorResult)

    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})