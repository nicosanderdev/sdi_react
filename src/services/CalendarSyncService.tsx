import { supabase } from '../config/supabase'
import { SdiApiResponse } from '../models/SdiApiResponse'

// Types for calendar sync
export interface CalendarIntegration {
  Id: string
  EstatePropertyId: string
  PlatformType: number // 0: Google Calendar, 1: Apple Calendar
  ExternalCalendarId: string
  ExternalCalendarName?: string
  IsActive: boolean
  LastSyncAt?: string
  SyncStatus: number // 0: idle, 1: syncing, 2: error
  Created: string
}

export interface SyncJob {
  Id: string
  JobType: number // 0: manual, 1: scheduled, 2: webhook
  Status: number // 0: pending, 1: running, 2: completed, 3: failed
  StartedAt?: string
  CompletedAt?: string
  Error?: string
  EventsProcessed?: number
  Created: string
}

export interface SyncStatus {
  integrationId: string
  platformType: number
  calendarName?: string
  isActive: boolean
  lastSyncAt?: string
  syncStatus: number
  latestJob?: SyncJob
}

export interface AvailabilityBlock {
  Id: string
  EstatePropertyId: string
  IsAvailable: boolean
  StartDate: string
  EndDate: string
  BlockType: number // 0: availability, 1: booking, 2: owner_block, 3: external_block
  Source: string // 'internal', 'google_calendar', 'ical'
  ExternalEventId?: string
  Title?: string
  Description?: string
  IsReadOnly: boolean
  ConflictFlagged: boolean
  Created: string
}

// Google Calendar OAuth
export class GoogleCalendarOAuthService {
  /**
   * Initiate Google Calendar OAuth flow
   */
  static async initiateOAuth(propertyId: string, calendarId?: string, calendarName?: string): Promise<{ authUrl: string }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/google-oauth/initiate', {
      body: { propertyId, calendarId, calendarName }
    })

    if (error) throw error
    return data
  }

  /**
   * Refresh OAuth tokens for an existing integration
   */
  static async refreshTokens(integrationId: string): Promise<{ expires_at: number }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/google-oauth/refresh', {
      body: { integrationId }
    })

    if (error) throw error
    return data
  }
}

// iCal Sync Service
export class ICalSyncService {
  /**
   * Import ICS feed
   */
  static async importICS(integrationId: string, icsUrl: string): Promise<{ eventsProcessed: number }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/ical-sync/import', {
      body: { integrationId, icsUrl }
    })

    if (error) throw error
    return data
  }

  /**
   * Connect ICS feed to property
   */
  static async connectICS(propertyId: string, icsUrl: string, calendarName?: string): Promise<{ integrationId: string }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/ical-sync/connect', {
      body: { propertyId, icsUrl, calendarName }
    })

    if (error) throw error
    return data
  }

  /**
   * Get ICS export URL
   */
  static getICSExportUrl(integrationId: string): string {
    return `${supabase.supabaseUrl}/functions/v1/calendar-sync/ical-sync/export?integrationId=${integrationId}`
  }
}

// Sync Orchestrator Service
export class SyncOrchestratorService {
  /**
   * Trigger sync for a specific calendar integration
   */
  static async triggerSync(integrationId: string, syncType: 'inbound' | 'outbound' | 'bidirectional' = 'bidirectional'): Promise<{ jobId: string; message: string }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/sync-orchestrator/sync', {
      body: { integrationId, syncType }
    })

    if (error) throw error
    return data
  }

  /**
   * Trigger sync for all integrations of a property
   */
  static async triggerBulkSync(propertyId: string, syncType: 'inbound' | 'outbound' | 'bidirectional' = 'bidirectional'): Promise<{ jobIds: string[]; message: string }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/sync-orchestrator/bulk-sync', {
      body: { propertyId, syncType }
    })

    if (error) throw error
    return data
  }

  /**
   * Get sync status for all integrations of a property
   */
  static async getSyncStatus(propertyId: string): Promise<{ status: SyncStatus[] }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/sync-orchestrator/status', {
      body: { propertyId }
    })

    if (error) throw error
    return data
  }

  /**
   * Retry failed sync jobs for a property
   */
  static async retryFailedJobs(propertyId: string): Promise<{ jobIds: string[]; message: string }> {
    const { data, error } = await supabase.functions.invoke('calendar-sync/sync-orchestrator/retry', {
      body: { propertyId }
    })

    if (error) throw error
    return data
  }
}

// Main Calendar Sync Service
export class CalendarSyncService {
  /**
   * Get calendar integrations for a property
   */
  static async getCalendarIntegrations(propertyId: string): Promise<SdiApiResponse<CalendarIntegration[]>> {
    try {
      const { data, error } = await supabase
        .from('CalendarIntegrations')
        .select('*')
        .eq('EstatePropertyId', propertyId)
        .eq('IsDeleted', false)
        .order('Created', { ascending: false })

      if (error) throw error

      return {
        succeeded: true,
        data: data || []
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to fetch calendar integrations'
      }
    }
  }

  /**
   * Create calendar integration
   */
  static async createCalendarIntegration(integration: Omit<CalendarIntegration, 'Id' | 'Created' | 'LastModified' | 'LastModifiedBy'>): Promise<SdiApiResponse<CalendarIntegration>> {
    try {
      const { data, error } = await supabase
        .from('CalendarIntegrations')
        .insert({
          ...integration,
          CreatedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) throw error

      return {
        succeeded: true,
        data
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to create calendar integration'
      }
    }
  }

  /**
   * Update calendar integration
   */
  static async updateCalendarIntegration(id: string, updates: Partial<CalendarIntegration>): Promise<SdiApiResponse<CalendarIntegration>> {
    try {
      const { data, error } = await supabase
        .from('CalendarIntegrations')
        .update({
          ...updates,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Id', id)
        .select()
        .single()

      if (error) throw error

      return {
        succeeded: true,
        data
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to update calendar integration'
      }
    }
  }

  /**
   * Delete calendar integration (soft delete)
   */
  static async deleteCalendarIntegration(id: string): Promise<SdiApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('CalendarIntegrations')
        .update({
          IsDeleted: true,
          IsActive: false,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Id', id)

      if (error) throw error

      return {
        succeeded: true,
        data: true
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to delete calendar integration'
      }
    }
  }

  /**
   * Get availability blocks for a property
   */
  static async getAvailabilityBlocks(propertyId: string, startDate?: string, endDate?: string): Promise<SdiApiResponse<AvailabilityBlock[]>> {
    try {
      let query = supabase
        .from('AvailabilityBlocks')
        .select('*')
        .eq('EstatePropertyId', propertyId)
        .eq('IsDeleted', false)
        .order('StartDate', { ascending: true })

      if (startDate) {
        query = query.gte('StartDate', startDate)
      }

      if (endDate) {
        query = query.lte('EndDate', endDate)
      }

      const { data, error } = await query

      if (error) throw error

      return {
        succeeded: true,
        data: data || []
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to fetch availability blocks'
      }
    }
  }

  /**
   * Create availability block
   */
  static async createAvailabilityBlock(block: Omit<AvailabilityBlock, 'Id' | 'Created' | 'LastModified' | 'LastModifiedBy'>): Promise<SdiApiResponse<AvailabilityBlock>> {
    try {
      const { data, error } = await supabase
        .from('AvailabilityBlocks')
        .insert({
          ...block,
          CreatedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) throw error

      return {
        succeeded: true,
        data
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to create availability block'
      }
    }
  }

  /**
   * Update availability block
   */
  static async updateAvailabilityBlock(id: string, updates: Partial<AvailabilityBlock>): Promise<SdiApiResponse<AvailabilityBlock>> {
    try {
      const { data, error } = await supabase
        .from('AvailabilityBlocks')
        .update({
          ...updates,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Id', id)
        .select()
        .single()

      if (error) throw error

      return {
        succeeded: true,
        data
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to update availability block'
      }
    }
  }

  /**
   * Delete availability block
   */
  static async deleteAvailabilityBlock(id: string): Promise<SdiApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('AvailabilityBlocks')
        .update({
          IsDeleted: true,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Id', id)

      if (error) throw error

      return {
        succeeded: true,
        data: true
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to delete availability block'
      }
    }
  }

  /**
   * Get sync jobs for a property
   */
  static async getSyncJobs(propertyId: string, limit: number = 50): Promise<SdiApiResponse<SyncJob[]>> {
    try {
      const { data, error } = await supabase
        .from('SyncJobs')
        .select(`
          *,
          CalendarIntegrations!inner(EstatePropertyId)
        `)
        .eq('CalendarIntegrations.EstatePropertyId', propertyId)
        .order('Created', { ascending: false })
        .limit(limit)

      if (error) throw error

      return {
        succeeded: true,
        data: data || []
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to fetch sync jobs'
      }
    }
  }
}

// Export all services
export {
  GoogleCalendarOAuthService,
  ICalSyncService,
  SyncOrchestratorService
}
