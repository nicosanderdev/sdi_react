import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess } from '../../_shared/auth.ts'
import { createLogger } from '../../_shared/logger.ts'
import { parseICalFeed, type ParsedICalEvent } from '../../_shared/ical-parse.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const logger = createLogger('ical-sync')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const FETCH_TIMEOUT_MS = 15_000
const MAX_FEED_BYTES = 5 * 1024 * 1024
const FEED_USER_AGENT = 'SDI-CalendarSync/1.0'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isServiceRoleRequest(req: Request): boolean {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return Boolean(serviceRoleKey) && token === serviceRoleKey
}

function resolveICalFeedUrl(integration: {
  ICalUrl?: string | null
  ExternalCalendarId?: string | null
}, provided?: string): string | null {
  if (provided && provided.startsWith('https://')) return provided
  if (integration.ICalUrl && integration.ICalUrl.startsWith('https://')) return integration.ICalUrl
  if (integration.ExternalCalendarId && integration.ExternalCalendarId.startsWith('https://')) {
    return integration.ExternalCalendarId
  }
  return null
}

interface ICSSyncRequest {
  integrationId: string
  action?: 'import' | 'export' | 'connect'
  icsUrl?: string
  jobId?: string
}

interface ImportResult {
  eventsProcessed: number
  blocksUpserted: number
  blocksDeleted: number
  conflictsDetected: number
}

async function fetchFeed(icsUrl: string): Promise<string> {
  const response = await fetch(icsUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': FEED_USER_AGENT },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ICS file: ${response.status}`)
  }

  const declared = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_FEED_BYTES) {
    throw new Error('ICS feed exceeds the size limit')
  }

  const icsContent = await response.text()
  if (icsContent.length > MAX_FEED_BYTES) {
    throw new Error('ICS feed exceeds the size limit')
  }
  return icsContent
}

async function upsertEventBlock(
  integrationId: string,
  propertyId: string,
  event: ParsedICalEvent,
): Promise<{ upserted: boolean; conflict: boolean }> {
  const { data: conflicts } = await supabase.rpc('detect_availability_conflicts', {
    property_id: propertyId,
    start_date: event.start.toISOString(),
    end_date: event.end.toISOString(),
    exclude_external_event_id: event.uid,
  })

  const hasConflict = Array.isArray(conflicts) && conflicts.length > 0
  const now = new Date().toISOString()
  const blockData = {
    EstatePropertyId: propertyId,
    CalendarIntegrationId: integrationId,
    IsAvailable: event.transparent,
    StartDate: event.start.toISOString(),
    EndDate: event.end.toISOString(),
    BlockType: 3,
    Source: 'ical',
    ExternalEventId: event.uid,
    Title: event.summary || 'ICS Event',
    Description: event.description,
    IsReadOnly: true,
    ConflictFlagged: hasConflict,
    IsDeleted: false,
    LastModified: now,
  }

  const { error: upsertError } = await supabase
    .from('AvailabilityBlocks')
    .upsert(blockData, {
      onConflict: 'EstatePropertyId,ExternalEventId,Source',
    })

  if (upsertError) {
    logger.error('upsert_block_failed', upsertError.message, { eventUid: event.uid })
    return { upserted: false, conflict: hasConflict }
  }
  return { upserted: true, conflict: hasConflict }
}

async function softDeleteMissing(integrationId: string, seenUids: Set<string>): Promise<number> {
  const rows: { Id: string; ExternalEventId: string | null }[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('AvailabilityBlocks')
      .select('Id, ExternalEventId')
      .eq('CalendarIntegrationId', integrationId)
      .eq('Source', 'ical')
      .eq('IsDeleted', false)
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`Failed to list iCal blocks: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }

  const ids = rows
    .filter((row) => !row.ExternalEventId || !seenUids.has(row.ExternalEventId))
    .map((row) => row.Id)

  if (ids.length === 0) return 0

  const now = new Date().toISOString()
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { error, count } = await supabase
      .from('AvailabilityBlocks')
      .update({ IsDeleted: true, LastModified: now }, { count: 'exact' })
      .in('Id', chunk)

    if (error) throw new Error(`Failed to remove missing iCal blocks: ${error.message}`)
    deleted += count ?? chunk.length
  }
  return deleted
}

/**
 * Import ICS feed and create availability blocks.
 * A failed upsert still counts the UID as seen, so a transient error does not delete the block.
 * Cancelled and missing events are soft-deleted afterwards.
 */
async function importICSFeed(integrationId: string, icsUrl: string, jobId?: string): Promise<ImportResult> {
  const { data: integration } = await supabase
    .from('CalendarIntegrations')
    .select('EstatePropertyId')
    .eq('Id', integrationId)
    .eq('IsDeleted', false)
    .single()

  if (!integration) {
    throw new Error('Integration not found')
  }

  if (jobId) {
    await supabase
      .from('SyncJobs')
      .update({
        Status: 1,
        StartedAt: new Date().toISOString()
      })
      .eq('Id', jobId)
  }

  try {
    const icsContent = await fetchFeed(icsUrl)
    const icsData = parseICalFeed(icsContent)
    if (!icsData.hasCalendar) {
      throw new Error('Feed is not an iCal calendar')
    }

    const seenUids = new Set<string>()
    let eventsProcessed = 0
    let blocksUpserted = 0
    let conflictsDetected = 0

    for (const event of icsData.events) {
      if (event.cancelled) continue

      eventsProcessed++
      seenUids.add(event.uid)

      try {
        const result = await upsertEventBlock(integrationId, integration.EstatePropertyId, event)
        if (result.upserted) blocksUpserted++
        if (result.conflict) conflictsDetected++
      } catch (error) {
        logger.error('process_event_failed', errorMessage(error), { eventUid: event.uid })
      }
    }

    const blocksDeleted = await softDeleteMissing(integrationId, seenUids)

    await supabase
      .from('CalendarIntegrations')
      .update({
        LastSyncAt: new Date().toISOString(),
        SyncStatus: 0,
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    if (jobId) {
      await supabase
        .from('SyncJobs')
        .update({
          Status: 2,
          CompletedAt: new Date().toISOString(),
          EventsProcessed: blocksUpserted
        })
        .eq('Id', jobId)
    }

    return { eventsProcessed, blocksUpserted, blocksDeleted, conflictsDetected }
  } catch (error) {
    if (jobId) {
      await supabase
        .from('SyncJobs')
        .update({
          Status: 3,
          CompletedAt: new Date().toISOString(),
          Error: errorMessage(error)
        })
        .eq('Id', jobId)
    }

    await supabase
      .from('CalendarIntegrations')
      .update({
        SyncStatus: 2,
        LastModified: new Date().toISOString()
      })
      .eq('Id', integrationId)

    throw error
  }
}

/**
 * Create or update ICS integration
 */
async function createICSIntegration(propertyId: string, icsUrl: string, calendarName?: string): Promise<string> {
  const { data: existingIntegration } = await supabase
    .from('CalendarIntegrations')
    .select('Id')
    .eq('EstatePropertyId', propertyId)
    .eq('PlatformType', 1)
    .eq('ExternalCalendarId', icsUrl)
    .eq('IsDeleted', false)
    .single()

  const integrationData = {
    EstatePropertyId: propertyId,
    PlatformType: 1,
    ExternalCalendarId: icsUrl,
    ExternalCalendarName: calendarName || 'ICS Calendar',
    IsActive: true,
    LastSyncAt: new Date().toISOString(),
    SyncStatus: 0,
    LastModified: new Date().toISOString()
  }

  if (existingIntegration) {
    const { error } = await supabase
      .from('CalendarIntegrations')
      .update(integrationData)
      .eq('Id', existingIntegration.Id)

    if (error) throw error
    return existingIntegration.Id
  }

  const { data, error } = await supabase
    .from('CalendarIntegrations')
    .insert(integrationData)
    .select('Id')
    .single()

  if (error) throw error
  return data.Id
}

export async function handleICalSyncRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    switch (path) {
      case 'import':
      case 'ical-sync': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const serviceRole = isServiceRoleRequest(req)
        let user = null
        if (!serviceRole) {
          const authResult = await authenticateUser(req)
          if (!authResult.user) {
            return new Response(JSON.stringify({ error: authResult.error }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          user = authResult.user
        }

        const body: ICSSyncRequest = await req.json()
        const { integrationId, icsUrl: providedUrl, jobId, action } = body

        if (path === 'ical-sync' && action && action !== 'import') {
          return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!integrationId) {
          return new Response(JSON.stringify({ error: 'Integration ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: integration } = await supabase
          .from('CalendarIntegrations')
          .select('EstatePropertyId, ICalUrl, ExternalCalendarId')
          .eq('Id', integrationId)
          .eq('IsDeleted', false)
          .single()

        if (!integration) {
          return new Response(JSON.stringify({ error: 'Integration not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!serviceRole && user) {
          const hasAccess = await hasPropertyAccess(user, integration.EstatePropertyId)
          if (!hasAccess) {
            return new Response(JSON.stringify({ error: 'Access denied' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }

        const icsUrl = resolveICalFeedUrl(integration, providedUrl)
        if (!icsUrl) {
          return new Response(JSON.stringify({ error: 'ICS URL is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const result = await importICSFeed(integrationId, icsUrl, jobId)

        return new Response(JSON.stringify({
          success: true,
          ...result,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'export': {
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'connect': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const authResult = await authenticateUser(req)
        if (!authResult.user) {
          return new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const body = await req.json()
        const { propertyId, icsUrl, calendarName } = body

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
    logger.error('function_error', errorMessage(error))
    return new Response(JSON.stringify({
      error: errorMessage(error) || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

if (import.meta.main) {
  Deno.serve(handleICalSyncRequest)
}
