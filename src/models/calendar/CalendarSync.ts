/**
 * Calendar Integration Types
 */

export enum PlatformType {
  GoogleCalendar = 0,
  AppleCalendar = 1,
  AirbnbICal = 2,
  BookingComICal = 3,
  OtherICal = 4
}

export enum SyncStatus {
  Idle = 0,
  Syncing = 1,
  Error = 2
}

export enum SyncDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
  Bidirectional = 'bidirectional'
}

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
  SyncStatus: SyncStatus
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

/**
 * iCal Types
 */

export interface ICalFeedMetadata {
  productId: string;
  version: string;
  calendarName: string;
  timezone: string;
  lastModified?: string;
}

export interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string;
  dtend: string;
  created?: string;
  lastModified?: string;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
}

/**
 * Availability Block Types
 */

export enum BlockType {
  Availability = 0,
  Booking = 1,
  OwnerBlock = 2,
  ExternalBlock = 3
}

export enum SourceType {
  Internal = 'internal',
  GoogleCalendar = 'google_calendar',
  ICal = 'ical'
}

export interface AvailabilityBlock {
  Id: string
  EstatePropertyId: string
  IsAvailable: boolean
  StartDate: string
  EndDate: string
  RecurrencePattern?: any // JSONB for complex recurrence rules
  BlockType: BlockType
  Source: SourceType
  ExternalEventId?: string
  Title?: string
  Description?: string
  IsReadOnly: boolean
  ConflictFlagged: boolean
  IsDeleted: boolean
  Created: string
  CreatedBy?: string
  LastModified: string
  LastModifiedBy?: string
}

/**
 * Sync Job Types
 */

export enum JobType {
  Manual = 0,
  Scheduled = 1,
  Webhook = 2
}

export enum JobStatus {
  Pending = 0,
  Running = 1,
  Completed = 2,
  Failed = 3
}

export interface SyncJob {
  Id: string
  CalendarIntegrationId: string
  JobType: JobType
  Status: JobStatus
  StartedAt?: string
  CompletedAt?: string
  Error?: string
  EventsProcessed?: number
  IsDeleted: boolean
  Created: string
  CreatedBy?: string
  LastModified: string
  LastModifiedBy?: string
}

/**
 * External Calendar Event Types
 */

export interface ExternalCalendarEvent {
  Id: string
  CalendarIntegrationId: string
  ExternalEventId: string
  ExternalEventData: any // Full external event data
  Title?: string
  Description?: string
  StartDate: string
  EndDate: string
  IsAllDay: boolean
  Location?: string
  LastSyncedAt: string
  IsDeleted: boolean
  Created: string
  CreatedBy?: string
  LastModified: string
  LastModifiedBy?: string
}

/**
 * Booking Types
 */

export enum BookingStatus {
  Pending = 0,
  Confirmed = 1,
  Cancelled = 2,
  Completed = 3,
  NoShow = 4
}

export enum ValidationStatus {
  Pending = 0,
  Valid = 1,
  Invalid = 2,
  Overridden = 3
}

export enum Currency {
  USD = 0,
  UYU = 1,
  BRL = 2,
  EUR = 3,
  GBP = 4
}

export interface Booking {
  Id: string
  EstatePropertyId: string
  GuestId: string | null
  CheckInDate: string
  CheckOutDate: string
  Status: BookingStatus
  ValidationStatus: ValidationStatus
  HasConflict: boolean
  ConflictReason?: string
  GuestCount: number
  TotalAmount?: number
  Currency: Currency
  Notes?: string
  BookingSource?: string
  ExternalBookingId?: string
  IsDeleted: boolean
  Created: string
  CreatedBy?: string
  LastModified: string
  LastModifiedBy?: string
}

/**
 * API Request/Response Types
 */

export interface SyncRequest {
  integrationId: string
  syncType?: SyncDirection
  jobId?: string
}

export interface BulkSyncRequest {
  propertyId: string
  syncType?: SyncDirection
}

export interface SyncResponse {
  success: boolean
  jobIds?: string[]
  message: string
}

export interface SyncStatusResponse {
  integrationId: string
  platformType: PlatformType
  calendarName?: string
  isActive: boolean
  lastSyncAt?: string
  syncStatus: SyncStatus
  latestJob?: SyncJob
}

export interface InitiateOAuthRequest {
  propertyId: string
  calendarId?: string
  calendarName?: string
}

export interface OAuthCallbackResponse {
  success: boolean
  integrationId?: string
  error?: string
}

export interface ICSSyncRequest {
  integrationId: string
  action: 'import' | 'export'
  icsUrl?: string
  jobId?: string
}

export interface ICSConnectRequest {
  propertyId: string
  icsUrl: string
  calendarName?: string
}

/**
 * Utility Types
 */

export interface ConflictInfo {
  Id: string
  Title?: string
  BlockType: BlockType
  Source: SourceType
  IsReadOnly: boolean
  ConflictFlagged: boolean
}

export interface SyncStats {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  runningJobs: number
  totalEventsProcessed: number
  lastSyncAt?: string
}

export interface CalendarHealthStatus {
  integrationId: string
  isHealthy: boolean
  issues: string[]
  lastChecked: string
}

/**
 * Form Types
 */

export interface CalendarIntegrationForm {
  platformType: PlatformType
  externalCalendarId: string
  externalCalendarName?: string
  syncDirection: SyncDirection
}

export interface AvailabilityBlockForm {
  estatePropertyId: string
  isAvailable: boolean
  startDate: string
  endDate: string
  recurrencePattern?: any
  blockType: BlockType
  title?: string
  description?: string
}

export interface BookingForm {
  estatePropertyId: string
  guestId: string | null | undefined
  checkInDate: string
  checkOutDate: string
  guestCount: number
  totalAmount?: number
  currency: Currency
  notes?: string
  bookingSource?: string
  externalBookingId?: string
}

/**
 * Display/Format Types
 */

export interface CalendarDisplayInfo {
  id: string
  name: string
  platform: string
  status: 'active' | 'inactive' | 'error'
  lastSync?: string
  syncStatus: SyncStatus
  eventsCount?: number
}

export interface SyncJobDisplay {
  id: string
  integrationName: string
  jobType: JobType
  status: JobStatus
  startedAt?: string
  completedAt?: string
  duration?: number
  eventsProcessed?: number
  error?: string
  canRetry: boolean
}

/**
 * Constants
 */

export const PLATFORM_NAMES = {
  [PlatformType.GoogleCalendar]: 'Google Calendar',
  [PlatformType.AppleCalendar]: 'Apple Calendar (ICS)',
  [PlatformType.AirbnbICal]: 'Airbnb iCal',
  [PlatformType.BookingComICal]: 'Booking.com iCal',
  [PlatformType.OtherICal]: 'Other iCal'
} as const

export const PLATFORM_ICONS = {
  [PlatformType.GoogleCalendar]: '📅',
  [PlatformType.AppleCalendar]: '📱',
  [PlatformType.AirbnbICal]: '🏠',
  [PlatformType.BookingComICal]: '🛏️',
  [PlatformType.OtherICal]: '📆'
} as const

export const SYNC_STATUS_NAMES = {
  [SyncStatus.Idle]: 'Idle',
  [SyncStatus.Syncing]: 'Syncing',
  [SyncStatus.Error]: 'Error'
} as const

export const JOB_TYPE_NAMES = {
  [JobType.Manual]: 'Manual',
  [JobType.Scheduled]: 'Scheduled',
  [JobType.Webhook]: 'Webhook'
} as const

export const JOB_STATUS_NAMES = {
  [JobStatus.Pending]: 'Pending',
  [JobStatus.Running]: 'Running',
  [JobStatus.Completed]: 'Completed',
  [JobStatus.Failed]: 'Failed'
} as const

export const BLOCK_TYPE_NAMES = {
  [BlockType.Availability]: 'Availability',
  [BlockType.Booking]: 'Booking',
  [BlockType.OwnerBlock]: 'Owner Block',
  [BlockType.ExternalBlock]: 'External Block'
} as const

export const BOOKING_STATUS_NAMES = {
  [BookingStatus.Pending]: 'Pending',
  [BookingStatus.Confirmed]: 'Confirmed',
  [BookingStatus.Cancelled]: 'Cancelled',
  [BookingStatus.Completed]: 'Completed',
  [BookingStatus.NoShow]: 'No Show'
} as const

export const CURRENCY_NAMES = {
  [Currency.USD]: 'USD',
  [Currency.UYU]: 'UYU',
  [Currency.BRL]: 'BRL',
  [Currency.EUR]: 'EUR',
  [Currency.GBP]: 'GBP'
} as const

export const CURRENCY_SYMBOLS = {
  [Currency.USD]: '$',
  [Currency.UYU]: '$U',
  [Currency.BRL]: 'R$',
  [Currency.EUR]: '€',
  [Currency.GBP]: '£'
} as const
