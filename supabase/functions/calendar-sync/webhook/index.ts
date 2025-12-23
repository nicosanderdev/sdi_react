import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../../../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface GoogleCalendarWebhookPayload {
  id?: string
  summary?: string
  updated?: string
  nextSyncToken?: string
}

interface WebhookHeaders {
  'x-goog-channel-id': string
  'x-goog-channel-token'?: string
  'x-goog-channel-expiration'?: string
  'x-goog-resource-id': string
  'x-goog-resource-uri': string
  'x-goog-resource-state': string
  'x-goog-message-number': string
}

/**
 * Validate Google webhook signature (basic validation)
 * In production, you should implement proper signature verification
 */
function validateWebhook(headers: Headers): boolean {
  // Google doesn't send signatures by default, but you can configure it
  // For now, we'll do basic validation
  const channelId = headers.get('x-goog-channel-id')
  const resourceState = headers.get('x-goog-resource-state')

  if (!channelId) {
    console.error('Missing channel ID in webhook headers')
    return false
  }

  // Accept sync, exists, or not_exists states
  if (!['sync', 'exists', 'not_exists'].includes(resourceState || '')) {
    console.error('Invalid resource state:', resourceState)
    return false
  }

  return true
}

/**
 * Find integration by webhook channel information
 */
async function findIntegrationByChannel(channelId: string, resourceId: string): Promise<string | null> {
  const { data: integration, error } = await supabase
    .from('CalendarIntegrations')
    .select('Id')
    .eq('WebhookChannelId', channelId)
    .eq('WebhookResourceId', resourceId)
    .eq('IsActive', true)
    .eq('IsDeleted', false)
    .single()

  if (error || !integration) {
    console.error('Integration not found for webhook:', { channelId, resourceId, error })
    return null
  }

  return integration.Id
}

/**
 * Create webhook-triggered sync job
 */
async function createWebhookSyncJob(integrationId: string): Promise<string> {
  const { data, error } = await supabase
    .from('SyncJobs')
    .insert({
      CalendarIntegrationId: integrationId,
      JobType: 2, // webhook
      Status: 0, // pending
      CreatedBy: 'webhook'
    })
    .select('Id')
    .single()

  if (error) throw error
  return data.Id
}

/**
 * Process webhook notification
 */
async function processWebhook(channelId: string, resourceId: string, resourceState: string): Promise<void> {
  // Find the integration
  const integrationId = await findIntegrationByChannel(channelId, resourceId)
  if (!integrationId) {
    console.error('No integration found for webhook')
    return
  }

  // Skip if this is just a sync notification (initial setup)
  if (resourceState === 'sync') {
    console.log('Received sync notification, skipping sync operation')
    return
  }

  // Create sync job
  const jobId = await createWebhookSyncJob(integrationId)

  // Trigger inbound sync (since external calendar changed)
  const syncUrl = `${supabaseUrl}/functions/v1/calendar-sync/google-sync`

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        integrationId,
        syncType: 'inbound',
        jobId
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sync failed: ${error}`)
    }

    console.log(`Webhook sync completed for integration ${integrationId}`)
  } catch (error) {
    console.error('Webhook sync error:', error)

    // Update job status to failed
    await supabase
      .from('SyncJobs')
      .update({
        Status: 3, // failed
        CompletedAt: new Date().toISOString(),
        Error: error.message
      })
      .eq('Id', jobId)
  }
}

/**
 * Handle webhook channel expiration
 */
async function handleChannelExpiration(channelId: string): Promise<void> {
  console.log(`Webhook channel expired: ${channelId}`)

  // Mark the integration as needing webhook renewal
  await supabase
    .from('CalendarIntegrations')
    .update({
      WebhookChannelId: null,
      WebhookResourceId: null,
      LastModified: new Date().toISOString()
    })
    .eq('WebhookChannelId', channelId)

  // You could trigger webhook renewal here, but for now we'll let the periodic job handle it
}

/**
 * Handle webhook channel deletion
 */
async function handleChannelDeletion(channelId: string): Promise<void> {
  console.log(`Webhook channel deleted: ${channelId}`)

  // Clean up webhook information
  await supabase
    .from('CalendarIntegrations')
    .update({
      WebhookChannelId: null,
      WebhookResourceId: null,
      LastModified: new Date().toISOString()
    })
    .eq('WebhookChannelId', channelId)
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate webhook
    if (!validateWebhook(req.headers)) {
      return new Response(JSON.stringify({ error: 'Invalid webhook' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extract webhook headers
    const channelId = req.headers.get('x-goog-channel-id')!
    const resourceId = req.headers.get('x-goog-resource-id')!
    const resourceState = req.headers.get('x-goog-resource-state')!
    const channelExpiration = req.headers.get('x-goog-channel-expiration')

    // Log webhook details for debugging
    console.log('Received Google Calendar webhook:', {
      channelId,
      resourceId,
      resourceState,
      channelExpiration,
      timestamp: new Date().toISOString()
    })

    // Handle different webhook states
    switch (resourceState) {
      case 'sync':
        // Initial sync notification - no action needed
        break

      case 'exists':
        // Resource exists/changed - trigger sync
        await processWebhook(channelId, resourceId, resourceState)
        break

      case 'not_exists':
        // Resource was deleted - trigger sync to handle deletion
        await processWebhook(channelId, resourceId, resourceState)
        break
    }

    // Check if channel is about to expire
    if (channelExpiration) {
      const expirationTime = new Date(channelExpiration)
      const now = new Date()
      const timeUntilExpiration = expirationTime.getTime() - now.getTime()

      // If expires within 24 hours, log for monitoring
      if (timeUntilExpiration < 24 * 60 * 60 * 1000) {
        console.warn(`Webhook channel ${channelId} expires soon: ${expirationTime.toISOString()}`)
      }
    }

    // Google expects a 200 response for successful webhook processing
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
