import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../../../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess } from '../../../_shared/auth.ts'
import { createLogger } from '../../../_shared/logger.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const logger = createLogger('sync-orchestrator')

// Rate limiting: max 100 sync operations per hour per integration
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

// Rate limiting for manual syncs: max 1 per 5 minutes per property
const MANUAL_SYNC_MAX = 1
const MANUAL_SYNC_WINDOW = 5 * 60 * 1000 // 5 minutes in milliseconds

// Rate limiting for automated syncs: max 1 per 15 minutes per integration
const AUTO_SYNC_MAX = 1
const AUTO_SYNC_WINDOW = 15 * 60 * 1000 // 15 minutes in milliseconds

interface SyncRequest {
  integrationId: string
  syncType?: 'inbound' | 'outbound' | 'bidirectional' // Default: bidirectional
}

interface BulkSyncRequest {
  propertyId: string
  syncType?: 'inbound' | 'outbound' | 'bidirectional'
}

interface SyncResponse {
  success: boolean
  jobIds: string[]
  message: string
}

interface SyncJob {
  id: string
  integrationId: string
  platformType: number
  syncType: string
}

/**
 * Sync iCal integration (helper function for iCal-specific logic)
 */
async function syncICalIntegration(integrationId: string): Promise<string> {
  // Get integration details
  const { data: integration, error } = await supabase
    .from('CalendarIntegrations')
    .select('PlatformType, IsActive, SyncStatus, EstatePropertyId')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (error || !integration) {
    throw new Error('Integration not found')
  }

  if (!integration.IsActive) {
    throw new Error('Integration is not active')
  }

  if (integration.SyncStatus === 1) { // Already syncing
    throw new Error('Sync already in progress')
  }

  // Check automated sync rate limiting
  const withinAutoLimit = await checkAutoSyncRateLimit(integrationId)
  if (!withinAutoLimit) {
    throw new Error('Automated sync rate limit exceeded. Please try again later.')
  }

  // Create sync job (automated/scheduled type)
  const jobId = await createSyncJob(integrationId, 1, 'inbound') // scheduled job

  try {
    // Call iCal import function
    const response = await fetch(`${supabaseUrl}/functions/v1/ical-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        integrationId,
        forceRefresh: false,
        jobId
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`iCal import service error: ${error}`)
    }

    return jobId
  } catch (error) {
    // Update job status to failed
    await supabase
      .from('SyncJobs')
      .update({
        Status: 3, // failed
        CompletedAt: new Date().toISOString(),
        Error: error.message
      })
      .eq('Id', jobId)

    throw error
  }
}

/**
 * Check rate limiting for an integration
 */
async function checkRateLimit(integrationId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW)

  const { count } = await supabase
    .from('SyncJobs')
    .select('*', { count: 'exact', head: true })
    .eq('CalendarIntegrationId', integrationId)
    .gte('Created', oneHourAgo.toISOString())

  return (count || 0) < RATE_LIMIT_MAX
}

/**
 * Check rate limiting for manual syncs per property
 */
async function checkManualSyncRateLimit(propertyId: string): Promise<boolean> {
  const fiveMinutesAgo = new Date(Date.now() - MANUAL_SYNC_WINDOW)

  const { count } = await supabase
    .from('SyncJobs')
    .select('*', { count: 'exact', head: true })
    .eq('JobType', 0) // Manual jobs only
    .gte('Created', fiveMinutesAgo.toISOString())
    .in('CalendarIntegrationId',
      // Subquery to get integration IDs for this property
      supabase.from('CalendarIntegrations')
        .select('Id')
        .eq('EstatePropertyId', propertyId)
        .eq('IsDeleted', false)
    )

  return (count || 0) < MANUAL_SYNC_MAX
}

/**
 * Check rate limiting for automated syncs per integration
 */
async function checkAutoSyncRateLimit(integrationId: string): Promise<boolean> {
  const fifteenMinutesAgo = new Date(Date.now() - AUTO_SYNC_WINDOW)

  const { count } = await supabase
    .from('SyncJobs')
    .select('*', { count: 'exact', head: true })
    .eq('CalendarIntegrationId', integrationId)
    .eq('JobType', 1) // Scheduled jobs only
    .gte('Created', fifteenMinutesAgo.toISOString())

  return (count || 0) < AUTO_SYNC_MAX
}

/**
 * Create sync job record
 */
async function createSyncJob(integrationId: string, jobType: number, syncType: string): Promise<string> {
  const { data, error } = await supabase
    .from('SyncJobs')
    .insert({
      CalendarIntegrationId: integrationId,
      JobType: jobType, // 0: manual, 1: scheduled, 2: webhook
      Status: 0, // pending
      CreatedBy: 'system'
    })
    .select('Id')
    .single()

  if (error) throw error
  return data.Id
}

/**
 * Trigger sync for a specific integration
 */
async function triggerSync(integrationId: string, syncType: string = 'bidirectional', jobType: number = 0): Promise<string> {
  // Get integration details to check property ID for manual sync rate limiting
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('EstatePropertyId')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (!integration) {
    throw new Error('Integration not found')
  }

  // Check rate limiting based on job type
  if (jobType === 0) { // Manual sync
    const withinManualLimit = await checkManualSyncRateLimit(integration.EstatePropertyId)
    if (!withinManualLimit) {
      throw new Error('Manual sync rate limit exceeded. Please try again later.')
    }
  } else if (jobType === 1) { // Automated sync
    const withinAutoLimit = await checkAutoSyncRateLimit(integrationId)
    if (!withinAutoLimit) {
      throw new Error('Automated sync rate limit exceeded. Please try again later.')
    }
  }

  // Check general rate limiting
  const withinGeneralLimit = await checkRateLimit(integrationId)
  if (!withinGeneralLimit) {
    throw new Error('Rate limit exceeded. Please try again later.')
  }

  // Get integration details
  const { data: integration, error } = await supabase
    .from('CalendarIntegrations')
    .select('PlatformType, IsActive, SyncStatus')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (error || !integration) {
    throw new Error('Integration not found')
  }

  if (!integration.IsActive) {
    throw new Error('Integration is not active')
  }

  if (integration.SyncStatus === 1) { // Already syncing
    throw new Error('Sync already in progress')
  }

  // Create sync job
  const jobId = await createSyncJob(integrationId, jobType, syncType)

  // Call appropriate sync service based on platform type
  let syncUrl: string
  let requestBody: any

  if (integration.PlatformType === 0) {
    // Google Calendar (OAuth)
    syncUrl = `${supabaseUrl}/functions/v1/calendar-sync/google-sync`
    requestBody = {
      integrationId,
      syncType,
      jobId
    }
  } else if (integration.PlatformType >= 2 && integration.PlatformType <= 4) {
    // iCal platforms (2=Airbnb, 3=Booking.com, 4=Other)
    syncUrl = `${supabaseUrl}/functions/v1/ical-import`
    requestBody = {
      integrationId,
      forceRefresh: false,
      jobId
    }
  } else if (integration.PlatformType === 1) {
    // Apple Calendar (legacy iCal sync - keep for backward compatibility)
    syncUrl = `${supabaseUrl}/functions/v1/calendar-sync/ical-sync`
    requestBody = {
      integrationId,
      action: 'import',
      jobId
    }
  } else {
    throw new Error(`Unsupported platform type: ${integration.PlatformType}`)
  }

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sync service error: ${error}`)
    }

    return jobId
  } catch (error) {
    // Update job status to failed
    await supabase
      .from('SyncJobs')
      .update({
        Status: 3, // failed
        CompletedAt: new Date().toISOString(),
        Error: error.message
      })
      .eq('Id', jobId)

    throw error
  }
}

/**
 * Trigger sync for all active integrations of a property
 */
async function triggerBulkSync(propertyId: string, syncType: string = 'bidirectional'): Promise<string[]> {
  // Get all active integrations for the property
  const { data: integrations, error } = await supabase
    .from('CalendarIntegrations')
    .select('Id, PlatformType')
    .eq('EstatePropertyId', propertyId)
    .eq('IsActive', true)
    .eq('IsDeleted', false)

  if (error) throw error

  const jobIds: string[] = []

  for (const integration of integrations || []) {
    try {
      const jobId = await triggerSync(integration.Id, syncType, 0) // manual job
      jobIds.push(jobId)
    } catch (error) {
      logger.error('trigger_sync_failed', error.message, { integrationId: integration.Id })
      // Continue with other integrations
    }
  }

  return jobIds
}

/**
 * Get sync status for integrations
 */
async function getSyncStatus(propertyId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('CalendarIntegrations')
    .select(`
      Id,
      PlatformType,
      ExternalCalendarName,
      IsActive,
      LastSyncAt,
      SyncStatus,
      SyncJobs!inner(
        Id,
        JobType,
        Status,
        StartedAt,
        CompletedAt,
        Error,
        EventsProcessed,
        Created
      )
    `)
    .eq('EstatePropertyId', propertyId)
    .eq('IsDeleted', false)
    .order('SyncJobs.Created', { ascending: false })

  if (error) throw error

  // Group by integration and get latest job
  const statusMap = new Map()

  for (const integration of data || []) {
    if (!statusMap.has(integration.Id)) {
      statusMap.set(integration.Id, {
        integrationId: integration.Id,
        platformType: integration.PlatformType,
        calendarName: integration.ExternalCalendarName,
        isActive: integration.IsActive,
        lastSyncAt: integration.LastSyncAt,
        syncStatus: integration.SyncStatus,
        latestJob: null
      })
    }

    // Update with latest job info
    if (integration.SyncJobs && integration.SyncJobs.length > 0) {
      const latestJob = integration.SyncJobs[0] // Already ordered by Created desc
      statusMap.get(integration.Id).latestJob = {
        id: latestJob.Id,
        jobType: latestJob.JobType,
        status: latestJob.Status,
        startedAt: latestJob.StartedAt,
        completedAt: latestJob.CompletedAt,
        error: latestJob.Error,
        eventsProcessed: latestJob.EventsProcessed,
        created: latestJob.Created
      }
    }
  }

  return Array.from(statusMap.values())
}

/**
 * Retry failed sync jobs
 */
async function retryFailedJobs(propertyId: string): Promise<string[]> {
  // Get failed jobs from the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const { data: failedJobs, error } = await supabase
    .from('SyncJobs')
    .select(`
      Id,
      CalendarIntegrationId,
      CalendarIntegrations!inner(
        EstatePropertyId,
        PlatformType,
        IsActive
      )
    `)
    .eq('Status', 3) // failed
    .gte('Created', yesterday.toISOString())
    .eq('CalendarIntegrations.IsActive', true)
    .eq('CalendarIntegrations.IsDeleted', false)

  if (error) throw error

  // Filter for the requested property
  const relevantJobs = (failedJobs || []).filter(job =>
    job.CalendarIntegrations.EstatePropertyId === propertyId
  )

  const jobIds: string[] = []

  for (const job of relevantJobs) {
    try {
      // Create new sync job for retry
      const newJobId = await triggerSync(job.CalendarIntegrationId, 'bidirectional')
      jobIds.push(newJobId)
    } catch (error) {
      logger.error('retry_job_failed', error.message, { jobId: job.Id })
    }
  }

  return jobIds
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // Authenticate user for all endpoints
    const authResult = await authenticateUser(req)
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (path) {
      case 'sync': {
        // Trigger sync for specific integration
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body: SyncRequest = await req.json()
        const { integrationId, syncType = 'bidirectional' } = body

        // Verify user has access to the integration
        const { data: integration } = await supabase
          .from('CalendarIntegrations')
          .select('EstatePropertyId')
          .eq('Id', integrationId)
          .eq('IsDeleted', false)
          .single()

        if (!integration) {
          return new Response(JSON.stringify({ error: 'Integration not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const hasAccess = await hasPropertyAccess(authResult.user, integration.EstatePropertyId)
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const jobId = await triggerSync(integrationId, syncType, 0) // manual job

        return new Response(JSON.stringify({
          success: true,
          jobId,
          message: 'Sync triggered successfully'
        } as SyncResponse), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'bulk-sync': {
        // Trigger sync for all integrations of a property
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body: BulkSyncRequest = await req.json()
        const { propertyId, syncType = 'bidirectional' } = body

        // Verify user has access to the property
        const hasAccess = await hasPropertyAccess(authResult.user, propertyId)
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const jobIds = await triggerBulkSync(propertyId, syncType)

        return new Response(JSON.stringify({
          success: true,
          jobIds,
          message: `Triggered sync for ${jobIds.length} integration(s)`
        } as SyncResponse), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'status': {
        // Get sync status for property integrations
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const propertyId = url.searchParams.get('propertyId')
        if (!propertyId) {
          return new Response(JSON.stringify({ error: 'Property ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Verify user has access to the property
        const hasAccess = await hasPropertyAccess(authResult.user, propertyId)
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const status = await getSyncStatus(propertyId)

        return new Response(JSON.stringify({
          success: true,
          status
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'retry': {
        // Retry failed sync jobs
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body = await req.json()
        const { propertyId } = body

        // Verify user has access to the property
        const hasAccess = await hasPropertyAccess(authResult.user, propertyId)
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const jobIds = await retryFailedJobs(propertyId)

        return new Response(JSON.stringify({
          success: true,
          jobIds,
          message: `Retried ${jobIds.length} failed job(s)`
        } as SyncResponse), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    logger.error('function_error', error.message)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
