import { supabase } from '../config/supabase'
import { SdiApiResponse } from '../models/SdiApiResponse'
import { PlatformType, SyncDirection } from '../models/calendar/CalendarSync'

// Types for calendar sync
export interface CalendarIntegration {
  Id: string
  EstatePropertyId: string
  PlatformType: PlatformType
  ExternalCalendarId: string
  ExternalCalendarName?: string
  AccessToken?: string
  RefreshToken?: string
  TokenExpiresAt?: string
  WebhookChannelId?: string
  WebhookResourceId?: string
  IsActive: boolean
  LastSyncAt?: string
  SyncStatus: number // 0: idle, 1: syncing, 2: error
  LastError?: string
  SyncDirection: SyncDirection
  IsDeleted: boolean
  Created: string
  CreatedBy?: string
  LastModified: string
  LastModifiedBy?: string
  ICalUrl?: string
  ICalSyncToken?: string
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

  /**
   * Create iCal calendar integration
   */
  static async createICalIntegration(
    propertyId: string,
    platformType: PlatformType,
    iCalUrl: string,
    calendarName?: string
  ): Promise<SdiApiResponse<CalendarIntegration>> {
    try {
      // Validate platform type (must be iCal type: 2, 3, or 4)
      if (![PlatformType.AirbnbICal, PlatformType.BookingComICal, PlatformType.OtherICal].includes(platformType)) {
        return {
          succeeded: false,
          errorMessage: 'Invalid platform type for iCal integration'
        }
      }

      // Validate iCal URL format
      if (!iCalUrl || !iCalUrl.startsWith('https://')) {
        return {
          succeeded: false,
          errorMessage: 'iCal URL must be a valid HTTPS URL'
        }
      }

      // Check if integration already exists for this URL and property
      const { data: existing } = await supabase
        .from('CalendarIntegrations')
        .select('Id')
        .eq('EstatePropertyId', propertyId)
        .eq('ICalUrl', iCalUrl)
        .eq('IsDeleted', false)
        .single()

      if (existing) {
        return {
          succeeded: false,
          errorMessage: 'An integration with this iCal URL already exists for this property'
        }
      }

      const { data, error } = await supabase
        .from('CalendarIntegrations')
        .insert({
          EstatePropertyId: propertyId,
          PlatformType: platformType,
          ExternalCalendarId: iCalUrl, // Store URL as external ID for consistency
          ExternalCalendarName: calendarName || `iCal Calendar`,
          ICalUrl: iCalUrl,
          IsActive: true,
          SyncStatus: 0, // idle
          SyncDirection: SyncDirection.Inbound,
          IsDeleted: false,
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
        errorMessage: error.message || 'Failed to create iCal integration'
      }
    }
  }

  /**
   * Update iCal calendar integration
   */
  static async updateICalIntegration(
    integrationId: string,
    updates: Partial<Pick<CalendarIntegration, 'ICalUrl' | 'ExternalCalendarName' | 'IsActive'>>
  ): Promise<SdiApiResponse<CalendarIntegration>> {
    try {
      // Validate iCal URL if provided
      if (updates.ICalUrl && !updates.ICalUrl.startsWith('https://')) {
        return {
          succeeded: false,
          errorMessage: 'iCal URL must be a valid HTTPS URL'
        }
      }

      const updateData: any = {
        ...updates,
        LastModified: new Date().toISOString(),
        LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
      }

      // If URL is being updated, also update ExternalCalendarId for consistency
      if (updates.ICalUrl) {
        updateData.ExternalCalendarId = updates.ICalUrl
      }

      const { data, error } = await supabase
        .from('CalendarIntegrations')
        .update(updateData)
        .eq('Id', integrationId)
        .eq('IsDeleted', false)
        .select()
        .single()

      if (error) throw error

      if (!data) {
        return {
          succeeded: false,
          errorMessage: 'Integration not found'
        }
      }

      // Verify it's an iCal integration
      if (![PlatformType.AirbnbICal, PlatformType.BookingComICal, PlatformType.OtherICal].includes(data.PlatformType)) {
        return {
          succeeded: false,
          errorMessage: 'Integration is not an iCal type'
        }
      }

      return {
        succeeded: true,
        data
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to update iCal integration'
      }
    }
  }

  /**
   * Delete iCal calendar integration (soft delete)
   */
  static async deleteICalIntegration(integrationId: string): Promise<SdiApiResponse<boolean>> {
    try {
      // First verify it's an iCal integration
      const { data: integration } = await supabase
        .from('CalendarIntegrations')
        .select('PlatformType')
        .eq('Id', integrationId)
        .eq('IsDeleted', false)
        .single()

      if (!integration) {
        return {
          succeeded: false,
          errorMessage: 'Integration not found'
        }
      }

      if (![PlatformType.AirbnbICal, PlatformType.BookingComICal, PlatformType.OtherICal].includes(integration.PlatformType)) {
        return {
          succeeded: false,
          errorMessage: 'Integration is not an iCal type'
        }
      }

      // Soft delete the integration
      const { error: deleteError } = await supabase
        .from('CalendarIntegrations')
        .update({
          IsDeleted: true,
          IsActive: false,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Id', integrationId)

      if (deleteError) throw deleteError

      // Clean up associated availability blocks (soft delete)
      const { error: blocksError } = await supabase
        .from('AvailabilityBlocks')
        .update({
          IsDeleted: true,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Source', 'ical') // Only delete iCal-sourced blocks
        .eq('EstatePropertyId',
          supabase.from('CalendarIntegrations')
            .select('EstatePropertyId')
            .eq('Id', integrationId)
        )

      if (blocksError) {
        console.warn('Failed to clean up associated availability blocks:', blocksError)
        // Don't fail the entire operation for this
      }

      return {
        succeeded: true,
        data: true
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to delete iCal integration'
      }
    }
  }

  /**
   * Sync iCal calendar integration
   */
  static async syncICalIntegration(integrationId: string): Promise<SdiApiResponse<{ jobId: string; message: string }>> {
    try {
      // Verify integration exists and is iCal type
      const { data: integration } = await supabase
        .from('CalendarIntegrations')
        .select('PlatformType, IsActive')
        .eq('Id', integrationId)
        .eq('IsDeleted', false)
        .single()

      if (!integration) {
        return {
          succeeded: false,
          errorMessage: 'Integration not found'
        }
      }

      if (![PlatformType.AirbnbICal, PlatformType.BookingComICal, PlatformType.OtherICal].includes(integration.PlatformType)) {
        return {
          succeeded: false,
          errorMessage: 'Integration is not an iCal type'
        }
      }

      if (!integration.IsActive) {
        return {
          succeeded: false,
          errorMessage: 'Integration is not active'
        }
      }

      // Call the sync orchestrator
      const result = await SyncOrchestratorService.triggerSync(integrationId, 'inbound', 0) // manual sync

      return {
        succeeded: true,
        data: {
          jobId: result.jobId,
          message: result.message
        }
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to trigger iCal sync'
      }
    }
  }

  /**
   * Get property's iCal export URL
   */
  static async getPropertyExportUrl(propertyId: string): Promise<SdiApiResponse<string>> {
    try {
      // Get or create export token for the property
      const { data: property } = await supabase
        .from('EstateProperties')
        .select('ICalExportToken')
        .eq('Id', propertyId)
        .single()

      if (!property) {
        return {
          succeeded: false,
          errorMessage: 'Property not found'
        }
      }

      let exportToken = property.ICalExportToken

      // Generate token if it doesn't exist
      if (!exportToken) {
        exportToken = crypto.randomUUID()
        const { error } = await supabase
          .from('EstateProperties')
          .update({ ICalExportToken: exportToken })
          .eq('Id', propertyId)

        if (error) throw error
      }

      // Construct the export URL
      const baseUrl = supabase.supabaseUrl.replace('/v1', '') // Remove /v1 if present
      const exportUrl = `${baseUrl}/functions/v1/ical-export/${propertyId}?token=${exportToken}`

      return {
        succeeded: true,
        data: exportUrl
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to get export URL'
      }
    }
  }

  /**
   * Regenerate property's iCal export token
   */
  static async regenerateExportToken(propertyId: string): Promise<SdiApiResponse<string>> {
    try {
      // Generate new token
      const newToken = crypto.randomUUID()

      const { error } = await supabase
        .from('EstateProperties')
        .update({
          ICalExportToken: newToken,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Id', propertyId)

      if (error) throw error

      // Return the new export URL
      const baseUrl = supabase.supabaseUrl.replace('/v1', '') // Remove /v1 if present
      const exportUrl = `${baseUrl}/functions/v1/ical-export/${propertyId}?token=${newToken}`

      return {
        succeeded: true,
        data: exportUrl
      }
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to regenerate export token'
      }
    }
  }
}

// Services are exported individually above
