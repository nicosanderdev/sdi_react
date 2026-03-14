import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess, createUnauthorizedResponse, createForbiddenResponse } from '../_shared/auth.ts'
import { validateRequest, type ConflictsQuery, type ConflictsResponse, type ConflictInfo } from '../_shared/schemas.ts'
import { AvailabilityBlocksDB, BookingValidationDB, transformToConflictInfo } from '../_shared/db.ts'

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
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

    return await handleGetConflicts(req, user)

  } catch (error) {
    console.error('Conflicts function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handleGetConflicts(req: Request, user: any): Promise<Response> {
  try {
    const url = new URL(req.url)
    const propertyId = url.searchParams.get('propertyId')
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

    // Default date range to next 30 days if not specified
    const now = new Date()
    const defaultStartDate = startDate ? new Date(startDate) : now
    const defaultEndDate = endDate ? new Date(endDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

    // Validate date range
    if (defaultStartDate >= defaultEndDate) {
      return new Response(JSON.stringify({ error: 'Start date must be before end date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Convert dates to ISO strings for database queries
    const startDateISO = defaultStartDate.toISOString()
    const endDateISO = defaultEndDate.toISOString()

    // Get all conflicts in parallel
    const [availabilityBlocks, bookings, externalEvents] = await Promise.all([
      getAvailabilityBlockConflicts(propertyId, startDateISO, endDateISO),
      getBookingConflicts(propertyId, startDateISO, endDateISO),
      getExternalEventConflicts(propertyId, startDateISO, endDateISO)
    ])

    const allConflicts = [...availabilityBlocks, ...bookings, ...externalEvents]

    const response: ConflictsResponse = {
      availabilityBlocks,
      bookings,
      externalEvents,
      totalConflicts: allConflicts.length
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Get conflicts error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get conflicts'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getAvailabilityBlockConflicts(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConflictInfo[]> {
  try {
    const conflictingBlocks = await AvailabilityBlocksDB.getConflictingBlocks(propertyId, startDate, endDate)

    return conflictingBlocks.map(block => {
      const conflictInfo = transformToConflictInfo('availability_block', block)
      conflictInfo.title = block.Title || `Availability Block (${block.IsAvailable ? 'Available' : 'Unavailable'})`
      conflictInfo.description = block.Description || `Blocks availability for this period`
      return conflictInfo
    })
  } catch (error) {
    console.error('Error getting availability block conflicts:', error)
    return []
  }
}

async function getBookingConflicts(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConflictInfo[]> {
  try {
    const existingBookings = await BookingValidationDB.getExistingBookings(propertyId, startDate, endDate)

    return existingBookings.map(booking => {
      const conflictInfo = transformToConflictInfo('existing_booking', booking)
      conflictInfo.title = `Booking (${booking.GuestCount} guests)`
      conflictInfo.description = booking.Notes || `Booking ID: ${booking.Id}, Status: ${getBookingStatusText(booking.Status)}`
      return conflictInfo
    })
  } catch (error) {
    console.error('Error getting booking conflicts:', error)
    return []
  }
}

async function getExternalEventConflicts(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConflictInfo[]> {
  try {
    const externalEvents = await BookingValidationDB.getExternalEvents(propertyId, startDate, endDate)

    return externalEvents.map(event => {
      const conflictInfo = transformToConflictInfo('external_event', event)
      conflictInfo.title = event.Title || 'External Calendar Event'
      conflictInfo.description = event.Description || `From external calendar`
      return conflictInfo
    })
  } catch (error) {
    console.error('Error getting external event conflicts:', error)
    return []
  }
}

function getBookingStatusText(status: number): string {
  const statusMap: { [key: number]: string } = {
    0: 'Pending',
    1: 'Confirmed',
    2: 'Cancelled',
    3: 'Completed',
    4: 'No Show'
  }
  return statusMap[status] || 'Unknown'
}
