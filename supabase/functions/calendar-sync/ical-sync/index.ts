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

interface ICSSyncRequest {
  integrationId: string
  action: 'import' | 'export'
  icsUrl?: string // For import
  jobId?: string
}

interface ICSEvent {
  uid: string
  summary?: string
  description?: string
  dtstart: string
  dtend: string
  status?: string
  transp?: string // TRANSP: TRANSPARENT or OPAQUE
}

interface ICSData {
  events: ICSEvent[]
  calendarName?: string
}

/**
 * Basic ICS parser for calendar events
 */
function parseICS(icsContent: string): ICSData {
  const lines = icsContent.split('\n').map(line => line.trim())
  const events: ICSEvent[] = []
  let currentEvent: Partial<ICSEvent> = {}
  let inEvent = false
  let calendarName = ''

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Handle line continuation
    while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
      i++
      line += lines[i].substring(1)
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentEvent = {}
    } else if (line === 'END:VEVENT') {
      if (currentEvent.uid && currentEvent.dtstart && currentEvent.dtend) {
        events.push(currentEvent as ICSEvent)
      }
      inEvent = false
    } else if (line === 'BEGIN:VCALENDAR' || line === 'END:VCALENDAR') {
      // Skip
    } else if (inEvent) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).toLowerCase()
        const value = line.substring(colonIndex + 1)

        switch (key) {
          case 'uid':
            currentEvent.uid = value
            break
          case 'summary':
            currentEvent.summary = value
            break
          case 'description':
            currentEvent.description = value
            break
          case 'dtstart':
            currentEvent.dtstart = value
            break
          case 'dtend':
            currentEvent.dtend = value
            break
          case 'status':
            currentEvent.status = value
            break
          case 'transp':
            currentEvent.transp = value
            break
        }
      }
    } else if (line.startsWith('X-WR-CALNAME:')) {
      calendarName = line.substring(13)
    }
  }

  return { events, calendarName }
}

/**
 * Generate ICS content from availability blocks
 */
function generateICS(propertyId: string, blocks: any[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Property Calendar//EN
X-WR-CALNAME:Property Availability
`

  for (const block of blocks) {
    if (!block.IsAvailable) { // Only include unavailable blocks in export
      const startDate = new Date(block.StartDate).toISOString().split('T')[0].replace(/-/g, '')
      const endDate = new Date(block.EndDate).toISOString().split('T')[0].replace(/-/g, '')

      ics += `BEGIN:VEVENT
UID:block_${block.Id}@property
SUMMARY:${block.Title || 'Booked'}
DESCRIPTION:${block.Description || 'Property is not available'}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`
    }
  }

  ics += 'END:VCALENDAR'
  return ics
}

/**
 * Parse ICS date/time format
 */
function parseICSDate(icsDate: string): Date {
  // Handle DATE format (YYYYMMDD)
  if (icsDate.length === 8 && /^\d{8}$/.test(icsDate)) {
    const year = icsDate.substring(0, 4)
    const month = icsDate.substring(4, 6)
    const day = icsDate.substring(6, 8)
    return new Date(`${year}-${month}-${day}T00:00:00`)
  }

  // Handle DATETIME format (YYYYMMDDTHHMMSSZ or with timezone)
  if (icsDate.includes('T')) {
    // Convert from ICS format to ISO format
    const isoDate = icsDate
      .replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')
      .replace(/Z$/, '+00:00')
    return new Date(isoDate)
  }

  throw new Error(`Unsupported ICS date format: ${icsDate}`)
}

/**
 * Import ICS feed and create availability blocks
 */
async function importICSFeed(integrationId: string, icsUrl: string, jobId?: string): Promise<number> {
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('EstatePropertyId')
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
    // Fetch ICS file
    const response = await fetch(icsUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch ICS file: ${response.status}`)
    }

    const icsContent = await response.text()
    const icsData = parseICS(icsContent)

    let processedCount = 0

    for (const event of icsData.events) {
      // Skip cancelled events
      if (event.status === 'CANCELLED') {
        continue
      }

      try {
        const startDate = parseICSDate(event.dtstart)
        const endDate = parseICSDate(event.dtend)

        // Check for conflicts with internal bookings
        const { data: conflicts } = await supabase.rpc('detect_availability_conflicts', {
          property_id: integration.EstatePropertyId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        })

        const hasConflict = conflicts && conflicts.length > 0
        const isBusy = event.transp !== 'TRANSPARENT'

        // Create availability block
        const blockData = {
          EstatePropertyId: integration.EstatePropertyId,
          IsAvailable: !isBusy,
          StartDate: startDate.toISOString(),
          EndDate: endDate.toISOString(),
          BlockType: 3, // external_block
          Source: 'ical',
          ExternalEventId: event.uid,
          Title: event.summary || 'ICS Event',
          Description: event.description,
          IsReadOnly: true,
          ConflictFlagged: hasConflict,
          Created: new Date().toISOString(),
          LastModified: new Date().toISOString()
        }

        // Upsert block (update if exists, insert if not)
        const { error: upsertError } = await supabase
          .from('AvailabilityBlocks')
          .upsert(blockData, {
            onConflict: 'EstatePropertyId,ExternalEventId,Source'
          })

        if (upsertError) {
          console.error('Error upserting availability block:', upsertError)
        } else {
          processedCount++
        }
      } catch (error) {
        console.error(`Error processing ICS event ${event.uid}:`, error)
      }
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
 * Export availability blocks as ICS feed
 */
async function exportICSFeed(integrationId: string): Promise<string> {
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('EstatePropertyId')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (!integration) {
    throw new Error('Integration not found')
  }

  // Get all availability blocks for the property (future only)
  const { data: blocks } = await supabase
    .from('AvailabilityBlocks')
    .select('*')
    .eq('EstatePropertyId', integration.EstatePropertyId)
    .eq('IsDeleted', false)
    .gte('EndDate', new Date().toISOString())
    .order('StartDate', { ascending: true })

  if (!blocks) {
    // Return empty calendar
    return generateICS(integration.EstatePropertyId, [])
  }

  return generateICS(integration.EstatePropertyId, blocks)
}

/**
 * Create or update ICS integration
 */
async function createICSIntegration(propertyId: string, icsUrl: string, calendarName?: string): Promise<string> {
  // Check if integration already exists
  const { data: existingIntegration } = await supabase
    .from('CalendarIntegrations')
    .select('Id')
    .eq('EstatePropertyId', propertyId)
    .eq('PlatformType', 1) // Apple Calendar
    .eq('ExternalCalendarId', icsUrl)
    .eq('IsDeleted', false)
    .single()

  const integrationData = {
    EstatePropertyId: propertyId,
    PlatformType: 1, // Apple Calendar
    ExternalCalendarId: icsUrl,
    ExternalCalendarName: calendarName || 'ICS Calendar',
    IsActive: true,
    LastSyncAt: new Date().toISOString(),
    SyncStatus: 0, // idle
    LastModified: new Date().toISOString()
  }

  if (existingIntegration) {
    // Update existing integration
    const { error } = await supabase
      .from('CalendarIntegrations')
      .update(integrationData)
      .eq('Id', existingIntegration.Id)

    if (error) throw error
    return existingIntegration.Id
  } else {
    // Create new integration
    const { data, error } = await supabase
      .from('CalendarIntegrations')
      .insert(integrationData)
      .select('Id')
      .single()

    if (error) throw error
    return data.Id
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    switch (path) {
      case 'import': {
        // Import ICS feed
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Authenticate user
        const authResult = await authenticateUser(req)
        if (!authResult.user) {
          return new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body: ICSSyncRequest = await req.json()
        const { integrationId, icsUrl, jobId } = body

        if (!icsUrl) {
          return new Response(JSON.stringify({ error: 'ICS URL is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

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

        const eventsProcessed = await importICSFeed(integrationId, icsUrl, jobId)

        return new Response(JSON.stringify({
          success: true,
          eventsProcessed
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'export': {
        // Export ICS feed
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'text/calendar' }
          })
        }

        const integrationId = url.searchParams.get('integrationId')
        if (!integrationId) {
          return new Response(JSON.stringify({ error: 'Integration ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const icsContent = await exportICSFeed(integrationId)

        return new Response(icsContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/calendar',
            'Content-Disposition': 'attachment; filename="property-calendar.ics"'
          }
        })
      }

      case 'connect': {
        // Connect ICS feed
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Authenticate user
        const authResult = await authenticateUser(req)
        if (!authResult.user) {
          return new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body = await req.json()
        const { propertyId, icsUrl, calendarName } = body

        // Verify user has access to property
        const hasAccess = await hasPropertyAccess(authResult.user, propertyId)
        if (!hasAccess) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const integrationId = await createICSIntegration(propertyId, icsUrl, calendarName)

        return new Response(JSON.stringify({
          success: true,
          integrationId
        }), {
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
    console.error('ICS sync function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
