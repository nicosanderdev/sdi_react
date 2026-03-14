/**
 * iCal Export Public Endpoint
 *
 * Serves public iCal (.ics) feeds for property availability.
 * Used by external platforms like Airbnb and Booking.com to sync property availability.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { generateICalFeed, generateETag } from '../_shared/ical-generator.ts'
import { createLogger } from '../_shared/logger.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const logger = createLogger('ical-export')

// Rate limiting: max 100 requests per hour per property
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Log access for monitoring and analytics
 */
async function logAccess(propertyId: string, token: string, userAgent?: string, ip?: string) {
  try {
    await supabase
      .from('AuditLogs')
      .insert({
        Action: 'ICAL_EXPORT_ACCESS',
        EntityType: 'EstateProperty',
        EntityId: propertyId,
        Details: {
          token: token.substring(0, 8) + '...', // Log partial token for security
          userAgent,
          ip
        },
        Created: new Date().toISOString()
      })
  } catch (error) {
    // Log failure but don't fail the request
    logger.warn('log_export_access', { propertyId }, error.message)
  }
}

/**
 * Check rate limiting for a property
 */
async function checkRateLimit(propertyId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW)

  const { count, error } = await supabase
    .from('AuditLogs')
    .select('*', { count: 'exact', head: true })
    .eq('Action', 'ICAL_EXPORT_ACCESS')
    .eq('EntityId', propertyId)
    .gte('Created', oneHourAgo.toISOString())

  if (error) {
    logger.warn('rate_limit_check_failed', { propertyId }, error.message)
    // Allow request on error to avoid blocking legitimate users
    return true
  }

  return (count || 0) < RATE_LIMIT_MAX
}

/**
 * Validate export token for property
 */
async function validateExportToken(propertyId: string, token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('EstateProperties')
    .select('ICalExportToken')
    .eq('Id', propertyId)
    .eq('IsDeleted', false)
    .single()

  if (error || !data) {
    logger.warn('token_validation_failed', { propertyId, tokenPrefix: token?.substring(0, 8) }, error?.message)
    return false
  }

  // If no token exists, generate one
  if (!data.ICalExportToken) {
    const newToken = crypto.randomUUID()
    const { error: updateError } = await supabase
      .from('EstateProperties')
      .update({ ICalExportToken: newToken })
      .eq('Id', propertyId)

    if (updateError) {
      logger.error('generate_export_token_failed', updateError.message, { propertyId })
      return false
    }

    return newToken === token
  }

  return data.ICalExportToken === token
}

/**
 * Generate iCal feed for property
 */
async function generatePropertyICalFeed(propertyId: string): Promise<string> {
  // Calculate date range: past 30 days to future 365 days
  const past30Days = new Date()
  past30Days.setDate(past30Days.getDate() - 30)

  const future365Days = new Date()
  future365Days.setFullYear(future365Days.getFullYear() + 1)

  // Query availability blocks
  const { data: blocks, error } = await supabase
    .from('AvailabilityBlocks')
    .select('*')
    .eq('EstatePropertyId', propertyId)
    .eq('IsDeleted', false)
    .eq('IsAvailable', false) // Only unavailable blocks
    .gte('StartDate', past30Days.toISOString())
    .lte('EndDate', future365Days.toISOString())
    .order('StartDate', { ascending: true })

  if (error) {
    throw new Error(`Failed to query availability blocks: ${error.message}`)
  }

  if (!blocks) {
    // Return empty calendar if no blocks
    return generateICalFeed(propertyId, [])
  }

  // Generate iCal feed
  return generateICalFeed(propertyId, blocks, {
    calendarName: 'Property Availability',
    prodId: '-//YourApp//Calendar Export//EN'
  })
}

Deno.serve(async (req) => {
  const startTime = Date.now()

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    logger.warn('invalid_method', { method: req.method })
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const propertyId = pathParts[pathParts.length - 1] // Extract propertyId from /ical-export/{propertyId}

    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'Property ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(propertyId)) {
      return new Response(JSON.stringify({ error: 'Invalid property ID format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get token from query parameters
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token parameter is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate token
    const isValidToken = await validateExportToken(propertyId, token)
    if (!isValidToken) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check rate limiting
    const withinLimit = await checkRateLimit(propertyId)
    if (!withinLimit) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '3600' // Retry after 1 hour
        }
      })
    }

    // Log access for monitoring
    const userAgent = req.headers.get('User-Agent') || undefined
    const ip = req.headers.get('CF-Connecting-IP') ||
               req.headers.get('X-Forwarded-For') ||
               req.headers.get('X-Real-IP') ||
               undefined
    await logAccess(propertyId, token, userAgent, ip)

    // Generate iCal feed
    const icalContent = await generatePropertyICalFeed(propertyId)

    // Generate ETag for caching
    const etag = generateETag(icalContent)

    // Check If-None-Match for conditional requests
    const ifNoneMatch = req.headers.get('If-None-Match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      logger.info('cache_hit', { propertyId, etag })
      return new Response(null, {
        status: 304, // Not Modified
        headers: {
          'ETag': etag,
          'Cache-Control': 'max-age=300' // 5 minutes
        }
      })
    }

    // Log successful export
    logger.info('export_success', {
      propertyId,
      contentLength: icalContent.length,
      hasCacheHit: false
    })

    // Return iCal feed with proper headers
    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="property-${propertyId}.ics"`,
        'Cache-Control': 'max-age=300', // 5 minutes
        'ETag': etag,
        'Access-Control-Allow-Origin': '*', // Allow cross-origin for web calendars
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, If-None-Match'
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('export_failed', error.message, {
      method: req.method,
      url: req.url,
      duration
    })

    // Don't expose internal errors to public endpoint
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})