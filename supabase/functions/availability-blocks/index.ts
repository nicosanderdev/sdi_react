import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess, createUnauthorizedResponse, createForbiddenResponse, createNotFoundResponse } from '../_shared/auth.ts'
import { validateRequest, PaginatedResponseSchema, ErrorResponseSchema, type AvailabilityBlock, type CreateAvailabilityBlockRequest, type UpdateAvailabilityBlockRequest, type ListAvailabilityBlocksQuery } from '../_shared/schemas.ts'
import { AvailabilityBlocksDB, transformAvailabilityBlock } from '../_shared/db.ts'

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

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const method = req.method

    // Route handling based on method and path
    if (method === 'GET') {
      return await handleListAvailabilityBlocks(req, url, user)
    } else if (method === 'POST') {
      return await handleCreateAvailabilityBlock(req, user)
    } else if (method === 'PUT' && pathParts.length >= 2) {
      const blockId = pathParts[pathParts.length - 1]
      return await handleUpdateAvailabilityBlock(req, blockId, user)
    } else if (method === 'DELETE' && pathParts.length >= 2) {
      const blockId = pathParts[pathParts.length - 1]
      return await handleDeleteAvailabilityBlock(blockId, user)
    }

    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Availability blocks function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handleListAvailabilityBlocks(req: Request, url: URL, user: any): Promise<Response> {
  try {
    // Parse query parameters
    const propertyId = url.searchParams.get('propertyId')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

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

    // Validate query parameters
    const query: ListAvailabilityBlocksQuery = {
      propertyId,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      startDate,
      endDate
    }

    // Get availability blocks
    const result = await AvailabilityBlocksDB.list(query)

    // Transform data
    const transformedData = result.data.map(transformAvailabilityBlock)

    const response = {
      data: transformedData,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < result.total
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('List availability blocks error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to list availability blocks'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleCreateAvailabilityBlock(req: Request, user: any): Promise<Response> {
  try {
    const body = await req.json()

    // Validate request body
    const validation = validateRequest(CreateAvailabilityBlockRequest, body)
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

    // Validate date range
    const startDate = new Date(request.startDate)
    const endDate = new Date(request.endDate)
    if (startDate >= endDate) {
      return new Response(JSON.stringify({ error: 'Start date must be before end date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create availability block
    const availabilityBlock = await AvailabilityBlocksDB.create(request, user.id)

    // Transform response
    const transformedBlock = transformAvailabilityBlock(availabilityBlock)

    return new Response(JSON.stringify(transformedBlock), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Create availability block error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to create availability block'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleUpdateAvailabilityBlock(req: Request, blockId: string, user: any): Promise<Response> {
  try {
    // Check if block exists and get property ID
    const existingBlock = await AvailabilityBlocksDB.getById(blockId)
    if (!existingBlock) {
      return createNotFoundResponse('Availability block not found')
    }

    // Check property access
    const hasAccess = await hasPropertyAccess(user, existingBlock.estatePropertyId)
    if (!hasAccess) {
      return createForbiddenResponse('You do not have access to this property')
    }

    const body = await req.json()

    // Validate request body
    const validation = validateRequest(UpdateAvailabilityBlockRequest, body)
    if (!validation.success) {
      return new Response(JSON.stringify({ error: `Invalid request: ${validation.error}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const request = validation.data

    // Validate date range if both dates are provided
    if (request.startDate && request.endDate) {
      const startDate = new Date(request.startDate)
      const endDate = new Date(request.endDate)
      if (startDate >= endDate) {
        return new Response(JSON.stringify({ error: 'Start date must be before end date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (request.startDate && !request.endDate) {
      // If only start date is provided, check against existing end date
      const endDate = new Date(existingBlock.endDate)
      const newStartDate = new Date(request.startDate)
      if (newStartDate >= endDate) {
        return new Response(JSON.stringify({ error: 'Start date must be before end date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else if (!request.startDate && request.endDate) {
      // If only end date is provided, check against existing start date
      const startDate = new Date(existingBlock.startDate)
      const newEndDate = new Date(request.endDate)
      if (startDate >= newEndDate) {
        return new Response(JSON.stringify({ error: 'Start date must be before end date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Update availability block
    const updatedBlock = await AvailabilityBlocksDB.update(blockId, request, user.id)

    // Transform response
    const transformedBlock = transformAvailabilityBlock(updatedBlock)

    return new Response(JSON.stringify(transformedBlock), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Update availability block error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to update availability block'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleDeleteAvailabilityBlock(blockId: string, user: any): Promise<Response> {
  try {
    // Check if block exists and get property ID
    const existingBlock = await AvailabilityBlocksDB.getById(blockId)
    if (!existingBlock) {
      return createNotFoundResponse('Availability block not found')
    }

    // Check property access
    const hasAccess = await hasPropertyAccess(user, existingBlock.estatePropertyId)
    if (!hasAccess) {
      return createForbiddenResponse('You do not have access to this property')
    }

    // Soft delete availability block
    await AvailabilityBlocksDB.delete(blockId, user.id)

    return new Response(JSON.stringify({ message: 'Availability block deleted successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Delete availability block error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to delete availability block'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
