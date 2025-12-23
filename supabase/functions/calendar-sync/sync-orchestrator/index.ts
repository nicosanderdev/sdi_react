import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../../../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess } from '../../../_shared/auth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Rate limiting: max 100 sync operations per hour per integration
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

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
async function triggerSync(integrationId: string, syncType: string = 'bidirectional'): Promise<string> {
  // Check rate limiting
  const withinLimit = await checkRateLimit(integrationId)
  if (!withinLimit) {
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
  const jobId = await createSyncJob(integrationId, 0, syncType) // manual job

  // Call appropriate sync service
  const syncUrl = `${supabaseUrl}/functions/v1/calendar-sync/${
    integration.PlatformType === 0 ? 'google-sync' : 'ical-sync'
  }`

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        integrationId,
        syncType,
        jobId
      })
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
      const jobId = await triggerSync(integration.Id, syncType)
      jobIds.push(jobId)
    } catch (error) {
      console.error(`Failed to trigger sync for integration ${integration.Id}:`, error)
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
      console.error(`Failed to retry job ${job.Id}:`, error)
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

        const jobId = await triggerSync(integrationId, syncType)

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
    console.error('Sync orchestrator error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
