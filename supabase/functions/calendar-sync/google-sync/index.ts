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

interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  token_type: string
}

interface SyncRequest {
  integrationId: string
  syncType: 'inbound' | 'outbound' | 'bidirectional'
  jobId?: string
}

interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  status: string
  transparency?: string // 'transparent' means free, 'opaque' means busy
}

interface GoogleEventListResponse {
  items: GoogleCalendarEvent[]
  nextPageToken?: string
}

/**
 * Decrypt OAuth tokens from storage
 */
function decryptTokens(encryptedTokens: string): OAuthTokens {
  try {
    const tokenString = atob(encryptedTokens)
    return JSON.parse(tokenString)
  } catch (error) {
    throw new Error('Failed to decrypt tokens')
  }
}

/**
 * Get valid OAuth tokens for Google API calls
 */
async function getValidTokens(integrationId: string): Promise<OAuthTokens> {
  const { data: integration, error } = await supabase
    .from('CalendarIntegrations')
    .select('AccessToken, RefreshToken, TokenExpiresAt')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (error || !integration) {
    throw new Error('Calendar integration not found')
  }

  let tokens = decryptTokens(integration.AccessToken)

  // Check if token is expired or will expire in next 5 minutes
  if (tokens.expires_at < (Date.now() + 5 * 60 * 1000)) {
    if (!integration.RefreshToken || !tokens.refresh_token) {
      throw new Error('Token expired and no refresh token available')
    }

    // Refresh the token
    const refreshToken = decryptTokens(integration.RefreshToken).access_token
    tokens = await refreshAccessToken(refreshToken)

    // Update stored tokens
    const encryptedAccessToken = btoa(JSON.stringify(tokens))
    const { error: updateError } = await supabase
      .from('CalendarIntegrations')
      .update({
        AccessToken: encryptedAccessToken,
        TokenExpiresAt: new Date(tokens.expires_at).toISOString(),
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    if (updateError) {
      console.error('Failed to update refreshed tokens:', updateError)
    }
  }

  return tokens
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`)
  }

  const data = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + (data.expires_in * 1000),
    token_type: data.token_type
  }
}

/**
 * Make authenticated request to Google Calendar API
 */
async function makeGoogleAPIRequest(url: string, tokens: OAuthTokens, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication failed - token may be expired')
    }
    const error = await response.text()
    throw new Error(`Google API error: ${response.status} - ${error}`)
  }

  return response.json()
}

/**
 * Fetch events from Google Calendar
 */
async function fetchGoogleCalendarEvents(calendarId: string, tokens: OAuthTokens, since?: Date): Promise<GoogleCalendarEvent[]> {
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  const params = new URLSearchParams({
    singleEvents: 'true', // Expand recurring events
    orderBy: 'startTime',
    maxResults: '2500' // Google API limit
  })

  if (since) {
    params.set('updatedMin', since.toISOString())
  }

  const url = `${baseUrl}?${params.toString()}`
  const response: GoogleEventListResponse = await makeGoogleAPIRequest(url, tokens)

  return response.items || []
}

/**
 * Create or update availability block from Google Calendar event
 */
async function processGoogleEvent(integrationId: string, event: GoogleCalendarEvent): Promise<void> {
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('EstatePropertyId')
    .eq('Id', integrationId)
    .single()

  if (!integration) return

  const propertyId = integration.EstatePropertyId

  // Parse event dates
  let startDate: Date
  let endDate: Date
  let isAllDay = false

  if (event.start.dateTime) {
    startDate = new Date(event.start.dateTime)
    endDate = new Date(event.end.dateTime || event.start.dateTime)
  } else if (event.start.date) {
    // All-day event
    startDate = new Date(event.start.date + 'T00:00:00')
    endDate = new Date(event.end.date + 'T23:59:59')
    isAllDay = true
  } else {
    return // Invalid event
  }

  // Skip cancelled events
  if (event.status === 'cancelled') {
    // Remove existing block if it exists
    await supabase
      .from('AvailabilityBlocks')
      .update({ IsDeleted: true, LastModified: new Date().toISOString() })
      .eq('EstatePropertyId', propertyId)
      .eq('ExternalEventId', event.id)
      .eq('Source', 'google_calendar')
      .eq('IsDeleted', false)
    return
  }

  // Check if this is a busy (booked) event
  const isBusy = event.transparency !== 'transparent'

  // Check for conflicts with internal bookings before creating external block
  const { data: conflicts } = await supabase.rpc('detect_availability_conflicts', {
    property_id: propertyId,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString()
  })

  const hasConflict = conflicts && conflicts.length > 0

  // Create or update availability block
  const blockData = {
    EstatePropertyId: propertyId,
    IsAvailable: !isBusy,
    StartDate: startDate.toISOString(),
    EndDate: endDate.toISOString(),
    BlockType: 3, // external_block
    Source: 'google_calendar',
    ExternalEventId: event.id,
    Title: event.summary || 'Google Calendar Event',
    Description: event.description,
    IsReadOnly: true,
    ConflictFlagged: hasConflict,
    LastModified: new Date().toISOString()
  }

  // Check if block already exists
  const { data: existingBlock } = await supabase
    .from('AvailabilityBlocks')
    .select('Id')
    .eq('EstatePropertyId', propertyId)
    .eq('ExternalEventId', event.id)
    .eq('Source', 'google_calendar')
    .eq('IsDeleted', false)
    .single()

  if (existingBlock) {
    // Update existing block
    await supabase
      .from('AvailabilityBlocks')
      .update(blockData)
      .eq('Id', existingBlock.Id)
  } else {
    // Create new block
    await supabase
      .from('AvailabilityBlocks')
      .insert(blockData)
  }

  // Also update/create external calendar event record
  const externalEventData = {
    CalendarIntegrationId: integrationId,
    ExternalEventId: event.id,
    ExternalEventData: event,
    Title: event.summary,
    Description: event.description,
    StartDate: startDate.toISOString(),
    EndDate: endDate.toISOString(),
    IsAllDay: isAllDay,
    LastSyncedAt: new Date().toISOString(),
    LastModified: new Date().toISOString()
  }

  await supabase
    .from('ExternalCalendarEvents')
    .upsert(externalEventData, {
      onConflict: 'CalendarIntegrationId,ExternalEventId'
    })
}

/**
 * Push internal bookings to Google Calendar
 */
async function pushInternalBookings(integrationId: string, calendarId: string, tokens: OAuthTokens): Promise<void> {
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('EstatePropertyId')
    .eq('Id', integrationId)
    .single()

  if (!integration) return

  const propertyId = integration.EstatePropertyId

  // Get bookings that need to be synced (confirmed bookings and owner blocks)
  const { data: bookings } = await supabase
    .from('Bookings')
    .select('*')
    .eq('EstatePropertyId', propertyId)
    .eq('IsDeleted', false)
    .in('Status', [1]) // Confirmed bookings
    .gte('CheckOutDate', new Date().toISOString().split('T')[0]) // Future bookings only

  if (!bookings) return

  for (const booking of bookings) {
    const eventId = `booking_${booking.Id}`

    // Check if event already exists in Google Calendar
    try {
      await makeGoogleAPIRequest(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        tokens
      )
      // Event exists, skip creation
      continue
    } catch (error) {
      // Event doesn't exist, create it
    }

    const eventData = {
      id: eventId,
      summary: `Booking: ${booking.GuestCount} guests`,
      description: `Booking from ${booking.CheckInDate} to ${booking.CheckOutDate}\nStatus: Confirmed\n${booking.Notes || ''}`,
      start: {
        date: booking.CheckInDate
      },
      end: {
        date: booking.CheckOutDate
      },
      transparency: 'opaque' // Busy event
    }

    try {
      await makeGoogleAPIRequest(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        tokens,
        {
          method: 'POST',
          body: JSON.stringify(eventData)
        }
      )
    } catch (error) {
      console.error(`Failed to create Google Calendar event for booking ${booking.Id}:`, error)
    }
  }
}

/**
 * Register webhook channel for real-time updates
 */
async function registerWebhookChannel(integrationId: string, calendarId: string, tokens: OAuthTokens): Promise<void> {
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-sync/webhook`

  const channelData = {
    id: `channel_${integrationId}_${Date.now()}`,
    type: 'web_hook',
    address: webhookUrl,
    params: {
      integrationId: integrationId
    }
  }

  await makeGoogleAPIRequest(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    tokens,
    {
      method: 'POST',
      body: JSON.stringify(channelData)
    }
  )

  // Store webhook channel info
  await supabase
    .from('CalendarIntegrations')
    .update({
      WebhookChannelId: channelData.id,
      WebhookResourceId: calendarId,
      LastModified: new Date().toISOString()
    })
    .eq('Id', integrationId)
}

/**
 * Perform inbound sync (pull from Google Calendar)
 */
async function performInboundSync(integrationId: string, jobId?: string): Promise<number> {
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('*')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (!integration) {
    throw new Error('Integration not found')
  }

  // Update job status to running
  if (jobId) {
    await supabase
      .from('SyncJobs')
      .update({
        Status: 1, // running
        StartedAt: new Date().toISOString()
      })
      .eq('Id', jobId)
  }

  try {
    const tokens = await getValidTokens(integrationId)
    const events = await fetchGoogleCalendarEvents(
      integration.ExternalCalendarId,
      tokens,
      integration.LastSyncAt ? new Date(integration.LastSyncAt) : undefined
    )

    let processedCount = 0
    for (const event of events) {
      await processGoogleEvent(integrationId, event)
      processedCount++
    }

    // Update integration sync status
    await supabase
      .from('CalendarIntegrations')
      .update({
        LastSyncAt: new Date().toISOString(),
        SyncStatus: 0, // idle
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    // Update job status to completed
    if (jobId) {
      await supabase
        .from('SyncJobs')
        .update({
          Status: 2, // completed
          CompletedAt: new Date().toISOString(),
          EventsProcessed: processedCount
        })
        .eq('Id', jobId)
    }

    return processedCount
  } catch (error) {
    // Update job status to failed
    if (jobId) {
      await supabase
        .from('SyncJobs')
        .update({
          Status: 3, // failed
          CompletedAt: new Date().toISOString(),
          Error: error.message
        })
        .eq('Id', jobId)
    }

    // Update integration sync status
    await supabase
      .from('CalendarIntegrations')
      .update({
        SyncStatus: 2, // error
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    throw error
  }
}

/**
 * Perform outbound sync (push to Google Calendar)
 */
async function performOutboundSync(integrationId: string, jobId?: string): Promise<number> {
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('*')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (!integration) {
    throw new Error('Integration not found')
  }

  // Update job status to running
  if (jobId) {
    await supabase
      .from('SyncJobs')
      .update({
        Status: 1, // running
        StartedAt: new Date().toISOString()
      })
      .eq('Id', jobId)
  }

  try {
    const tokens = await getValidTokens(integrationId)
    await pushInternalBookings(integrationId, integration.ExternalCalendarId, tokens)

    // Register webhook if not already registered
    if (!integration.WebhookChannelId) {
      await registerWebhookChannel(integrationId, integration.ExternalCalendarId, tokens)
    }

    // Update integration sync status
    await supabase
      .from('CalendarIntegrations')
      .update({
        LastSyncAt: new Date().toISOString(),
        SyncStatus: 0, // idle
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    // Update job status to completed
    if (jobId) {
      await supabase
        .from('SyncJobs')
        .update({
          Status: 2, // completed
          CompletedAt: new Date().toISOString(),
          EventsProcessed: 1 // Simplified count
        })
        .eq('Id', jobId)
    }

    return 1
  } catch (error) {
    // Update job status to failed
    if (jobId) {
      await supabase
        .from('SyncJobs')
        .update({
          Status: 3, // failed
          CompletedAt: new Date().toISOString(),
          Error: error.message
        })
        .eq('Id', jobId)
    }

    // Update integration sync status
    await supabase
      .from('CalendarIntegrations')
      .update({
        SyncStatus: 2, // error
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    throw error
  }
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

    const body: SyncRequest = await req.json()
    const { integrationId, syncType, jobId } = body

    // Verify integration exists and get property access
    const { data: integration } = await supabase
      .from('CalendarIntegrations')
      .select('EstatePropertyId, PlatformType')
      .eq('Id', integrationId)
      .eq('IsDeleted', false)
      .single()

    if (!integration || integration.PlatformType !== 0) { // Not Google Calendar
      return new Response(JSON.stringify({ error: 'Invalid Google Calendar integration' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let eventsProcessed = 0

    switch (syncType) {
      case 'inbound':
        eventsProcessed = await performInboundSync(integrationId, jobId)
        break
      case 'outbound':
        eventsProcessed = await performOutboundSync(integrationId, jobId)
        break
      case 'bidirectional':
        await performInboundSync(integrationId, jobId)
        eventsProcessed = await performOutboundSync(integrationId, jobId)
        break
      default:
        return new Response(JSON.stringify({ error: 'Invalid sync type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({
      success: true,
      eventsProcessed
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Google sync function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
