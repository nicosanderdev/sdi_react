import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type {
  AvailabilityBlock,
  CalendarIntegration,
  CreateAvailabilityBlockRequest,
  UpdateAvailabilityBlockRequest,
  CreateCalendarIntegrationRequest,
  BookingValidationRequest,
  ConflictInfo,
  ListAvailabilityBlocksQuery
} from './schemas.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Create Supabase client with service role for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Availability Blocks Database Operations
export class AvailabilityBlocksDB {
  static async list(query: ListAvailabilityBlocksQuery): Promise<{
    data: AvailabilityBlock[]
    total: number
  }> {
    let dbQuery = supabase
      .from('AvailabilityBlocks')
      .select('*', { count: 'exact' })
      .eq('EstatePropertyId', query.propertyId)
      .eq('IsDeleted', false)
      .order('StartDate', { ascending: true })
      .range(query.offset, query.offset + query.limit - 1)

    // Add date filters if provided
    if (query.startDate) {
      dbQuery = dbQuery.gte('StartDate', query.startDate)
    }
    if (query.endDate) {
      dbQuery = dbQuery.lte('EndDate', query.endDate)
    }

    const { data, error, count } = await dbQuery

    if (error) {
      throw new Error(`Failed to list availability blocks: ${error.message}`)
    }

    return {
      data: data || [],
      total: count || 0
    }
  }

  static async create(request: CreateAvailabilityBlockRequest, userId: string): Promise<AvailabilityBlock> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('AvailabilityBlocks')
      .insert({
        EstatePropertyId: request.estatePropertyId,
        IsAvailable: request.isAvailable,
        StartDate: request.startDate,
        EndDate: request.endDate,
        RecurrencePattern: request.recurrencePattern,
        Title: request.title,
        Description: request.description,
        Created: now,
        CreatedBy: userId,
        LastModified: now,
        LastModifiedBy: userId
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create availability block: ${error.message}`)
    }

    return data
  }

  static async update(id: string, request: UpdateAvailabilityBlockRequest, userId: string): Promise<AvailabilityBlock> {
    const now = new Date().toISOString()

    const updateData: any = {
      LastModified: now,
      LastModifiedBy: userId
    }

    if (request.isAvailable !== undefined) updateData.IsAvailable = request.isAvailable
    if (request.startDate !== undefined) updateData.StartDate = request.startDate
    if (request.endDate !== undefined) updateData.EndDate = request.endDate
    if (request.recurrencePattern !== undefined) updateData.RecurrencePattern = request.recurrencePattern
    if (request.title !== undefined) updateData.Title = request.title
    if (request.description !== undefined) updateData.Description = request.description

    const { data, error } = await supabase
      .from('AvailabilityBlocks')
      .update(updateData)
      .eq('Id', id)
      .eq('IsDeleted', false)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update availability block: ${error.message}`)
    }

    return data
  }

  static async delete(id: string, userId: string): Promise<void> {
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('AvailabilityBlocks')
      .update({
        IsDeleted: true,
        LastModified: now,
        LastModifiedBy: userId
      })
      .eq('Id', id)
      .eq('IsDeleted', false)

    if (error) {
      throw new Error(`Failed to delete availability block: ${error.message}`)
    }
  }

  static async getById(id: string): Promise<AvailabilityBlock | null> {
    const { data, error } = await supabase
      .from('AvailabilityBlocks')
      .select('*')
      .eq('Id', id)
      .eq('IsDeleted', false)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to get availability block: ${error.message}`)
    }

    return data
  }

  static async getConflictingBlocks(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<AvailabilityBlock[]> {
    const { data, error } = await supabase
      .from('AvailabilityBlocks')
      .select('*')
      .eq('EstatePropertyId', propertyId)
      .eq('IsDeleted', false)
      .eq('IsAvailable', false) // Only unavailable blocks are conflicts
      .or(`and(StartDate.lt.${endDate},EndDate.gt.${startDate})`) // Overlapping date ranges

    if (error) {
      throw new Error(`Failed to get conflicting availability blocks: ${error.message}`)
    }

    return data || []
  }
}

// Calendar Integrations Database Operations
export class CalendarIntegrationsDB {
  static async list(propertyId: string): Promise<CalendarIntegration[]> {
    const { data, error } = await supabase
      .from('CalendarIntegrations')
      .select('*')
      .eq('EstatePropertyId', propertyId)
      .eq('IsDeleted', false)
      .order('Created', { ascending: false })

    if (error) {
      throw new Error(`Failed to list calendar integrations: ${error.message}`)
    }

    return data || []
  }

  static async create(request: CreateCalendarIntegrationRequest, userId: string): Promise<CalendarIntegration> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('CalendarIntegrations')
      .insert({
        EstatePropertyId: request.estatePropertyId,
        PlatformType: request.platformType,
        ExternalCalendarId: request.externalCalendarId,
        ExternalCalendarName: request.externalCalendarName,
        AccessToken: request.accessToken, // Should be encrypted in production
        RefreshToken: request.refreshToken,
        TokenExpiresAt: request.tokenExpiresAt,
        IsActive: true,
        SyncStatus: 0, // Idle
        Created: now,
        CreatedBy: userId,
        LastModified: now,
        LastModifiedBy: userId
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create calendar integration: ${error.message}`)
    }

    return data
  }

  static async updateSyncStatus(id: string, status: number, lastSyncAt?: string): Promise<void> {
    const updateData: any = { SyncStatus: status }
    if (lastSyncAt) updateData.LastSyncAt = lastSyncAt

    const { error } = await supabase
      .from('CalendarIntegrations')
      .update(updateData)
      .eq('Id', id)
      .eq('IsDeleted', false)

    if (error) {
      throw new Error(`Failed to update sync status: ${error.message}`)
    }
  }

  static async getActiveIntegrations(propertyId: string): Promise<CalendarIntegration[]> {
    const { data, error } = await supabase
      .from('CalendarIntegrations')
      .select('*')
      .eq('EstatePropertyId', propertyId)
      .eq('IsDeleted', false)
      .eq('IsActive', true)

    if (error) {
      throw new Error(`Failed to get active integrations: ${error.message}`)
    }

    return data || []
  }
}

// Booking Validation Database Operations
export class BookingValidationDB {
  static async getExistingBookings(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('Bookings')
      .select('*')
      .eq('EstatePropertyId', propertyId)
      .eq('IsDeleted', false)
      .neq('Status', 2) // Not cancelled
      .or(`and(CheckInDate.lt.${endDate},CheckOutDate.gt.${startDate})`) // Overlapping date ranges

    if (error) {
      throw new Error(`Failed to get existing bookings: ${error.message}`)
    }

    return data || []
  }

  static async getExternalEvents(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('ExternalCalendarEvents')
      .select(`
        *,
        CalendarIntegrations!inner(EstatePropertyId, IsActive)
      `)
      .eq('CalendarIntegrations.EstatePropertyId', propertyId)
      .eq('CalendarIntegrations.IsActive', true)
      .eq('ExternalCalendarEvents.IsDeleted', false)
      .or(`and(StartDate.lt.${endDate},EndDate.gt.${startDate})`) // Overlapping date ranges

    if (error) {
      throw new Error(`Failed to get external events: ${error.message}`)
    }

    return data || []
  }
}

// Rate limiting helper
export class RateLimiter {
  private static readonly SYNC_RATE_LIMIT = 60 * 1000 // 1 minute
  private static readonly SYNC_KEY_PREFIX = 'calendar_sync:'

  static async checkSyncRateLimit(propertyId: string): Promise<boolean> {
    const key = `${this.SYNC_KEY_PREFIX}${propertyId}`
    const now = Date.now()
    const windowStart = now - this.SYNC_RATE_LIMIT

    // In a real implementation, you'd use Redis or similar
    // For now, we'll use a simple in-memory check with a database table
    // This is a simplified version - in production you'd want proper rate limiting

    const { data, error } = await supabase
      .from('CalendarIntegrations')
      .select('LastSyncAt')
      .eq('EstatePropertyId', propertyId)
      .eq('IsDeleted', false)
      .order('LastSyncAt', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Rate limit check error:', error)
      return true // Allow on error
    }

    if (!data || data.length === 0) {
      return true // No previous sync, allow
    }

    const lastSync = new Date(data[0].LastSyncAt).getTime()
    return (now - lastSync) >= this.SYNC_RATE_LIMIT
  }
}

// Utility functions
export function transformAvailabilityBlock(row: any): AvailabilityBlock {
  return {
    id: row.Id,
    estatePropertyId: row.EstatePropertyId,
    isAvailable: row.IsAvailable,
    startDate: row.StartDate,
    endDate: row.EndDate,
    recurrencePattern: row.RecurrencePattern,
    title: row.Title,
    description: row.Description,
    created: row.Created,
    createdBy: row.CreatedBy,
    lastModified: row.LastModified,
    lastModifiedBy: row.LastModifiedBy
  }
}

export function transformCalendarIntegration(row: any): CalendarIntegration {
  return {
    id: row.Id,
    estatePropertyId: row.EstatePropertyId,
    platformType: row.PlatformType,
    externalCalendarId: row.ExternalCalendarId,
    externalCalendarName: row.ExternalCalendarName,
    isActive: row.IsActive,
    lastSyncAt: row.LastSyncAt,
    syncStatus: row.SyncStatus,
    created: row.Created,
    createdBy: row.CreatedBy,
    lastModified: row.LastModified,
    lastModifiedBy: row.LastModifiedBy
  }
}

export function transformToConflictInfo(
  type: 'availability_block' | 'existing_booking' | 'external_event',
  data: any
): ConflictInfo {
  const baseInfo = {
    type,
    id: data.Id || data.id,
    title: data.Title || data.title || `${type} conflict`,
    description: data.Description || data.description || null
  }

  if (type === 'availability_block') {
    return {
      ...baseInfo,
      startDate: data.StartDate,
      endDate: data.EndDate
    }
  } else if (type === 'existing_booking') {
    return {
      ...baseInfo,
      startDate: new Date(data.CheckInDate).toISOString(),
      endDate: new Date(data.CheckOutDate).toISOString()
    }
  } else if (type === 'external_event') {
    return {
      ...baseInfo,
      startDate: data.StartDate,
      endDate: data.EndDate
    }
  }

  throw new Error(`Unknown conflict type: ${type}`)
}
