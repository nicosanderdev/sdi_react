import { AvailabilityBlock as BaseAvailabilityBlock, BlockType, SourceType } from './CalendarSync'

/**
 * Extended Availability Block with additional computed properties and methods
 */
export interface AvailabilityBlock extends BaseAvailabilityBlock {
  // Computed properties
  duration?: number // Duration in milliseconds
  durationDays?: number // Duration in days
  isRecurring?: boolean
  conflicts?: AvailabilityBlock[]
}

/**
 * Recurrence pattern types
 */
export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number // Every N days/weeks/months/years
  endDate?: string
  count?: number // Number of occurrences
  byDay?: string[] // For weekly: ['MO', 'WE', 'FR']
  byMonthDay?: number[] // For monthly: [1, 15, -1]
}

/**
 * Availability query parameters
 */
export interface AvailabilityQuery {
  propertyId: string
  startDate?: string
  endDate?: string
  includeRecurring?: boolean
  includeBookings?: boolean
  includeExternalBlocks?: boolean
  sources?: SourceType[]
  blockTypes?: BlockType[]
}

/**
 * Availability calendar view
 */
export interface CalendarView {
  date: string
  blocks: AvailabilityBlock[]
  isAvailable: boolean
  bookingCount: number
  totalBookings: number
  availableHours?: number
}

/**
 * Availability summary for a date range
 */
export interface AvailabilitySummary {
  startDate: string
  endDate: string
  totalDays: number
  availableDays: number
  bookedDays: number
  blockedDays: number
  utilizationRate: number // 0-1
  totalBookings: number
  averageBookingValue?: number
}

/**
 * Conflict detection result
 */
export interface ConflictResult {
  hasConflicts: boolean
  conflicts: AvailabilityBlock[]
  severity: 'none' | 'warning' | 'error'
  message: string
  suggestedActions?: string[]
}

/**
 * Availability rule for automatic blocking
 */
export interface AvailabilityRule {
  id: string
  propertyId: string
  name: string
  type: 'minimum_stay' | 'maximum_stay' | 'buffer_days' | 'weekly_schedule' | 'custom'
  config: any // Rule-specific configuration
  isActive: boolean
  priority: number // Higher priority rules override lower ones
  created: string
  updated: string
}

/**
 * Property availability settings
 */
export interface PropertyAvailabilitySettings {
  propertyId: string
  timezone: string
  minimumStayDays?: number
  maximumStayDays?: number
  bufferDays?: number // Days between bookings
  checkInTime?: string // e.g., "15:00"
  checkOutTime?: string // e.g., "11:00"
  weeklySchedule?: {
    [key: string]: { // 'monday', 'tuesday', etc.
      available: boolean
      startTime?: string
      endTime?: string
    }
  }
  blockedDates?: string[] // Specific dates to block
  specialPricing?: {
    [date: string]: number // Date -> price multiplier
  }
  created: string
  updated: string
}

/**
 * Calendar sync operations
 */
export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete' | 'conflict'
  entityType: 'availability_block' | 'booking' | 'external_event'
  entityId: string
  source: SourceType
  externalId?: string
  changes: any
  timestamp: string
  resolved: boolean
  resolution?: string
}

/**
 * Availability utilities
 */
export class AvailabilityUtils {
  /**
   * Calculate duration between two dates in days
   */
  static calculateDurationDays(startDate: string | Date, endDate: string | Date): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Check if two date ranges overlap
   */
  static dateRangesOverlap(
    start1: string | Date,
    end1: string | Date,
    start2: string | Date,
    end2: string | Date
  ): boolean {
    const s1 = new Date(start1)
    const e1 = new Date(end1)
    const s2 = new Date(start2)
    const e2 = new Date(end2)

    return s1 < e2 && s2 < e1
  }

  /**
   * Check if a block represents availability (not a booking or block)
   */
  static isAvailableBlock(block: AvailabilityBlock): boolean {
    return block.IsAvailable &&
           (block.BlockType === BlockType.Availability || block.BlockType === BlockType.ExternalBlock) &&
           !block.ConflictFlagged
  }

  /**
   * Check if a block represents a booking
   */
  static isBookingBlock(block: AvailabilityBlock): boolean {
    return !block.IsAvailable && block.BlockType === BlockType.Booking
  }

  /**
   * Check if a block represents an owner block
   */
  static isOwnerBlock(block: AvailabilityBlock): boolean {
    return !block.IsAvailable && block.BlockType === BlockType.OwnerBlock
  }

  /**
   * Check if a block is from an external source
   */
  static isExternalBlock(block: AvailabilityBlock): boolean {
    return block.Source !== SourceType.Internal
  }

  /**
   * Check if a block can be modified by users
   */
  static isEditable(block: AvailabilityBlock): boolean {
    return !block.IsReadOnly && block.Source === SourceType.Internal
  }

  /**
   * Format block title for display
   */
  static formatBlockTitle(block: AvailabilityBlock): string {
    if (block.Title) return block.Title

    switch (block.BlockType) {
      case BlockType.Availability:
        return block.IsAvailable ? 'Available' : 'Unavailable'
      case BlockType.Booking:
        return 'Booking'
      case BlockType.OwnerBlock:
        return 'Owner Block'
      case BlockType.ExternalBlock:
        return `${block.Source.replace('_', ' ').toUpperCase()} Event`
      default:
        return 'Block'
    }
  }

  /**
   * Get block color for calendar display
   */
  static getBlockColor(block: AvailabilityBlock): string {
    if (block.ConflictFlagged) return '#ef4444' // red-500

    switch (block.BlockType) {
      case BlockType.Availability:
        return block.IsAvailable ? '#10b981' : '#6b7280' // green-500 : gray-500
      case BlockType.Booking:
        return '#3b82f6' // blue-500
      case BlockType.OwnerBlock:
        return '#f59e0b' // amber-500
      case BlockType.ExternalBlock:
        return '#8b5cf6' // violet-500
      default:
        return '#6b7280' // gray-500
    }
  }

  /**
   * Validate availability block dates
   */
  static validateBlockDates(startDate: string, endDate: string): { isValid: boolean; error?: string } {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid date format' }
    }

    if (start >= end) {
      return { isValid: false, error: 'End date must be after start date' }
    }

    const maxDays = 365 // Prevent extremely long blocks
    const durationDays = this.calculateDurationDays(start, end)
    if (durationDays > maxDays) {
      return { isValid: false, error: `Block duration cannot exceed ${maxDays} days` }
    }

    return { isValid: true }
  }

  /**
   * Merge overlapping availability blocks
   */
  static mergeOverlappingBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
    if (blocks.length <= 1) return blocks

    // Sort by start date
    const sorted = [...blocks].sort((a, b) =>
      new Date(a.StartDate).getTime() - new Date(b.StartDate).getTime()
    )

    const merged: AvailabilityBlock[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const last = merged[merged.length - 1]

      if (this.canMergeBlocks(last, current)) {
        // Merge the blocks
        last.EndDate = current.EndDate > last.EndDate ? current.EndDate : last.EndDate
        if (current.Description && !last.Description) {
          last.Description = current.Description
        }
        last.LastModified = current.LastModified
      } else {
        merged.push(current)
      }
    }

    return merged
  }

  /**
   * Check if two blocks can be merged
   */
  private static canMergeBlocks(block1: AvailabilityBlock, block2: AvailabilityBlock): boolean {
    // Must be the same type and availability status
    if (block1.IsAvailable !== block2.IsAvailable ||
        block1.BlockType !== block2.BlockType ||
        block1.Source !== block2.Source) {
      return false
    }

    // Must overlap or be adjacent
    const end1 = new Date(block1.EndDate)
    const start2 = new Date(block2.StartDate)

    return end1 >= start2
  }

  /**
   * Calculate utilization rate for a period
   */
  static calculateUtilizationRate(
    blocks: AvailabilityBlock[],
    startDate: string,
    endDate: string
  ): number {
    const totalDays = this.calculateDurationDays(startDate, endDate)
    if (totalDays === 0) return 0

    const bookedBlocks = blocks.filter(block =>
      !block.IsAvailable &&
      (block.BlockType === BlockType.Booking || block.BlockType === BlockType.OwnerBlock)
    )

    let bookedDays = 0
    for (const block of bookedBlocks) {
      const blockStart = new Date(Math.max(new Date(block.StartDate).getTime(), new Date(startDate).getTime()))
      const blockEnd = new Date(Math.min(new Date(block.EndDate).getTime(), new Date(endDate).getTime()))

      if (blockStart < blockEnd) {
        bookedDays += this.calculateDurationDays(blockStart, blockEnd)
      }
    }

    return Math.min(bookedDays / totalDays, 1)
  }
}
