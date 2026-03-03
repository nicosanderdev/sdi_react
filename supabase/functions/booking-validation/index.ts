import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser, hasPropertyAccess, createUnauthorizedResponse, createForbiddenResponse } from '../_shared/auth.ts'
import { validateRequest, type BookingValidationRequest, type BookingValidationResponse, type ConflictInfo } from '../_shared/schemas.ts'
import { AvailabilityBlocksDB, BookingValidationDB, transformToConflictInfo } from '../_shared/db.ts'

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

    return await handleBookingValidation(req, user)

  } catch (error) {
    console.error('Booking validation function error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handleBookingValidation(req: Request, user: any): Promise<Response> {
  try {
    const body = await req.json()

    // Validate request body
    const validation = validateRequest(BookingValidationRequest, body)
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

    // Reject if property is blocked for new bookings (e.g. overdue unpaid receipt)
    const isBlocked = await BookingValidationDB.isPropertyBlockedForBooking(request.propertyId)
    if (isBlocked) {
      return new Response(JSON.stringify({
        error: 'This property is temporarily not accepting new bookings.',
        blockedForBooking: true
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate date range
    const checkInDate = new Date(request.checkInDate + 'T00:00:00.000Z')
    const checkOutDate = new Date(request.checkOutDate + 'T00:00:00.000Z')

    if (checkInDate >= checkOutDate) {
      return new Response(JSON.stringify({ error: 'Check-in date must be before check-out date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Convert dates to ISO strings for database queries
    const startDate = checkInDate.toISOString()
    const endDate = checkOutDate.toISOString()

    // Check for conflicts in parallel
    const [availabilityConflicts, bookingConflicts, externalConflicts] = await Promise.all([
      checkAvailabilityConflicts(request.propertyId, startDate, endDate),
      checkBookingConflicts(request.propertyId, startDate, endDate),
      checkExternalCalendarConflicts(request.propertyId, startDate, endDate)
    ])

    // Combine all conflicts
    const allConflicts = [
      ...availabilityConflicts,
      ...bookingConflicts,
      ...externalConflicts
    ]

    const response: BookingValidationResponse = {
      isValid: allConflicts.length === 0,
      conflicts: allConflicts,
      totalConflicts: allConflicts.length
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Booking validation error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Failed to validate booking'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function checkAvailabilityConflicts(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConflictInfo[]> {
  try {
    const conflictingBlocks = await AvailabilityBlocksDB.getConflictingBlocks(propertyId, startDate, endDate)

    return conflictingBlocks.map(block => transformToConflictInfo('availability_block', block))
  } catch (error) {
    console.error('Error checking availability conflicts:', error)
    return []
  }
}

async function checkBookingConflicts(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConflictInfo[]> {
  try {
    const existingBookings = await BookingValidationDB.getExistingBookings(propertyId, startDate, endDate)

    return existingBookings.map(booking => {
      const conflictInfo = transformToConflictInfo('existing_booking', booking)
      // Enhance title for bookings
      conflictInfo.title = `Existing booking (${booking.GuestCount} guests)`
      conflictInfo.description = booking.Notes || `Booking ID: ${booking.Id}`
      return conflictInfo
    })
  } catch (error) {
    console.error('Error checking booking conflicts:', error)
    return []
  }
}

async function checkExternalCalendarConflicts(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ConflictInfo[]> {
  try {
    const externalEvents = await BookingValidationDB.getExternalEvents(propertyId, startDate, endDate)

    return externalEvents.map(event => {
      const conflictInfo = transformToConflictInfo('external_event', event)
      // External events are already conflicts by definition
      return conflictInfo
    })
  } catch (error) {
    console.error('Error checking external calendar conflicts:', error)
    return []
  }
}
