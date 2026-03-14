import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess, createUnauthorizedResponse, createForbiddenResponse } from '../_shared/auth.ts'
import { validateRequest, type CalendarSyncRequest } from '../_shared/schemas.ts'
import { CalendarIntegrationsDB, RateLimiter } from '../_shared/db.ts'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Authenticate user
    const authResult = await authenticateUser(req)
    if (authResult.error || !authResult.user) {
      return createUnauthorizedResponse(authResult.error || 'Authentication failed')
    }
    const user = authResult.user

    return await handleCalendarSync(req, user)

  } catch (error) {
    console.error('Calendar sync function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handleCalendarSync(req: Request, user: any): Promise<Response> {
  try {
    const body = await req.json()

    // Validate request body
    const validation = validateRequest(CalendarSyncRequest, body)
    if (!validation.success) {
      return new Response(JSON.stringify({ error: `Invalid request: ${validation.error}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const request = validation.data

    // Check property access
    const hasAccess = await hasPropertyAccess(user, request.propertyId)
    if (!hasAccess) {
      return createForbiddenResponse('You do not have access to this property')
    }

    // Check rate limiting
    const withinRateLimit = await RateLimiter.checkSyncRateLimit(request.propertyId)
    if (!withinRateLimit) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded. Please wait before requesting another sync.'
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60' // Retry after 60 seconds
        }
      })
    }

    // Get active integrations for the property
    const integrations = await CalendarIntegrationsDB.getActiveIntegrations(request.propertyId)

    if (integrations.length === 0) {
      return new Response(JSON.stringify({
        error: 'No active calendar integrations found for this property'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update sync status to "syncing" for all integrations
    const now = new Date().toISOString()
    await Promise.all(
      integrations.map(integration =>
        CalendarIntegrationsDB.updateSyncStatus(integration.id, 1) // 1 = Syncing
      )
    )

    // In a real implementation, you would trigger background jobs here
    // For now, we'll simulate the sync process
    const syncPromises = integrations.map(integration =>
      performCalendarSync(integration, now)
    )

    // Start sync operations asynchronously (don't await)
    Promise.all(syncPromises).catch(error => {
      console.error('Background sync error:', error)
    })

    const response = {
      message: 'Calendar sync initiated successfully',
      integrationsTriggered: integrations.length,
      estimatedCompletion: '30-60 seconds'
    }

    return new Response(JSON.stringify(response), {
      status: 202, // Accepted - processing will complete asynchronously
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Calendar sync error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to initiate calendar sync'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Perform calendar sync for a specific integration
 * This is a placeholder implementation - in production, this would:
 * 1. Authenticate with external calendar API
 * 2. Fetch events from external calendar
 * 3. Compare with existing ExternalCalendarEvents
 * 4. Update/create/delete events as needed
 * 5. Update sync status and timestamps
 */
async function performCalendarSync(integration: any, syncStartedAt: string): Promise<void> {
  try {
    console.log(`Starting sync for integration ${integration.id} (${integration.platformType === 0 ? 'Google' : 'Apple'} Calendar)`)

    // Simulate sync delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))

    // TODO: Implement actual calendar API integration
    // This would involve:
    // - Refreshing OAuth tokens if needed
    // - Calling Google Calendar API or Apple Calendar API
    // - Processing events and updating database

    // For now, just mark as completed
    const now = new Date().toISOString()
    await CalendarIntegrationsDB.updateSyncStatus(integration.id, 0, now) // 0 = Idle

    console.log(`Completed sync for integration ${integration.id}`)

  } catch (error) {
    console.error(`Sync failed for integration ${integration.id}:`, error)

    // Mark as error
    await CalendarIntegrationsDB.updateSyncStatus(integration.id, 2) // 2 = Error

    // In production, you might want to:
    // - Send notifications to property owner
    // - Retry failed syncs
    // - Log detailed error information
  }
}
