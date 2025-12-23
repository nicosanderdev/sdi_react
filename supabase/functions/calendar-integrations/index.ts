import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess, createUnauthorizedResponse, createForbiddenResponse } from '../_shared/auth.ts'
import { validateRequest, type CalendarIntegration, type CreateCalendarIntegrationRequest, type ListCalendarIntegrationsQuery } from '../_shared/schemas.ts'
import { CalendarIntegrationsDB, transformCalendarIntegration } from '../_shared/db.ts'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate user
    const authResult = await authenticateUser(req)
    if (authResult.error || !authResult.user) {
      return createUnauthorizedResponse(authResult.error || 'Authentication failed')
    }
    const user = authResult.user

    const method = req.method

    // Route handling based on method
    if (method === 'GET') {
      return await handleListCalendarIntegrations(req, user)
    } else if (method === 'POST') {
      return await handleCreateCalendarIntegration(req, user)
    }

    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Calendar integrations function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handleListCalendarIntegrations(req: Request, user: any): Promise<Response> {
  try {
    const url = new URL(req.url)
    const propertyId = url.searchParams.get('propertyId')

    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'Missing propertyId query parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check property access
    const hasAccess = await hasPropertyAccess(user, propertyId)
    if (!hasAccess) {
      return createForbiddenResponse('You do not have access to this property')
    }

    // Get calendar integrations
    const integrations = await CalendarIntegrationsDB.list(propertyId)

    // Transform data (exclude sensitive tokens)
    const transformedIntegrations = integrations.map(integration => {
      const transformed = transformCalendarIntegration(integration)
      // Remove sensitive token data from response
      return {
        ...transformed,
        // Note: In production, you might want to include token expiry info without the actual tokens
      }
    })

    return new Response(JSON.stringify(transformedIntegrations), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('List calendar integrations error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to list calendar integrations'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleCreateCalendarIntegration(req: Request, user: any): Promise<Response> {
  try {
    const body = await req.json()

    // Validate request body
    const validation = validateRequest(CreateCalendarIntegrationRequest, body)
    if (!validation.success) {
      return new Response(JSON.stringify({ error: `Invalid request: ${validation.error}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const request = validation.data

    // Check property access
    const hasAccess = await hasPropertyAccess(user, request.estatePropertyId)
    if (!hasAccess) {
      return createForbiddenResponse('You do not have access to this property')
    }

    // Validate platform type
    if (request.platformType < 0 || request.platformType > 1) {
      return new Response(JSON.stringify({ error: 'Invalid platform type. Must be 0 (Google Calendar) or 1 (Apple Calendar)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for duplicate integration (same property + platform + external calendar)
    const existingIntegrations = await CalendarIntegrationsDB.list(request.estatePropertyId)
    const duplicate = existingIntegrations.find(integration =>
      integration.platformType === request.platformType &&
      integration.externalCalendarId === request.externalCalendarId
    )

    if (duplicate) {
      return new Response(JSON.stringify({
        error: 'Integration already exists for this calendar and platform'
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // In production, you should encrypt the tokens before storing
    // For now, we'll store them as-is but mark this as a TODO
    console.warn('TODO: Encrypt access and refresh tokens before storing in database')

    // Create calendar integration
    const integration = await CalendarIntegrationsDB.create(request, user.id)

    // Transform response (exclude sensitive tokens)
    const transformedIntegration = transformCalendarIntegration(integration)

    return new Response(JSON.stringify(transformedIntegration), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Create calendar integration error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to create calendar integration'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
