/**
 * iCal Generator Utility
 *
 * Generates standards-compliant iCal (.ics) feeds from availability blocks.
 * Used for exporting property availability to external platforms like Airbnb and Booking.com.
 */

import { AvailabilityBlock, BlockType } from '../../../src/models/calendar/CalendarSync.ts'
import { createLogger } from './logger.ts'

/**
 * Error class for iCal generation errors
 */
export class ICalGeneratorError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'ICalGeneratorError'
  }
}

/**
 * Configuration options for the generator
 */
export interface ICalGeneratorOptions {
  calendarName?: string
  prodId?: string
  timezone?: string // Default timezone for output
}

// Structured logger
const logger = createLogger('ical-generator')

/**
 * Generate iCal feed from availability blocks
 *
 * @param propertyId - Property ID for generating unique UIDs
 * @param blocks - Array of availability blocks to export
 * @param options - Generator configuration options
 * @returns Complete iCal (.ics) content as string
 * @throws ICalGeneratorError if generation fails
 */
export function generateICalFeed(
  propertyId: string,
  blocks: AvailabilityBlock[],
  options: ICalGeneratorOptions = {}
): string {
  const {
    calendarName = 'Property Availability',
    prodId = '-//YourApp//Calendar Export//EN',
    timezone = 'UTC'
  } = options

  logger.info('Starting iCal feed generation', {
    propertyId,
    blockCount: blocks.length,
    calendarName
  })

  if (!propertyId) {
    throw new ICalGeneratorError('Property ID is required')
  }

  if (!Array.isArray(blocks)) {
    throw new ICalGeneratorError('Blocks must be an array')
  }

  try {
    // Filter blocks to only include those that should block external calendars
    const exportableBlocks = filterExportableBlocks(blocks)
    logger.info(`Filtered to ${exportableBlocks.length} exportable blocks`)

    // Generate VCALENDAR wrapper
    const calendarContent = generateCalendarContent(propertyId, exportableBlocks, {
      calendarName,
      prodId,
      timezone,
      logger
    })

    logger.info('Successfully generated iCal feed', {
      contentLength: calendarContent.length
    })

    return calendarContent
  } catch (error) {
    if (error instanceof ICalGeneratorError) {
      throw error
    }

    logger.error('Unexpected error during iCal generation', error)
    throw new ICalGeneratorError(
      `Failed to generate iCal feed: ${error.message}`,
      error as Error
    )
  }
}

/**
 * Filter blocks to only include those that should be exported to external calendars
 */
function filterExportableBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  return blocks.filter(block => {
    // Only export blocks that are not available (i.e., they block availability)
    if (block.IsAvailable) {
      return false
    }

    // Exclude external blocks (prevent circular sync)
    if (block.BlockType === BlockType.ExternalBlock) {
      return false
    }

    // Include confirmed bookings and owner blocks
    return block.BlockType === BlockType.Booking || block.BlockType === BlockType.OwnerBlock
  })
}

/**
 * Generate the complete VCALENDAR content
 */
function generateCalendarContent(
  propertyId: string,
  blocks: AvailabilityBlock[],
  options: {
    calendarName: string
    prodId: string
    timezone: string
    logger: Logger
  }
): string {
  const { calendarName, prodId, timezone, logger } = options
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z'

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:${prodId}
METHOD:PUBLISH
X-WR-CALNAME:${calendarName}
X-WR-TIMEZONE:${timezone}
`

  // Add each block as a VEVENT
  for (const block of blocks) {
    try {
      const vevent = convertBlockToVEvent(propertyId, block, now)
      ics += vevent
    } catch (error) {
      logger.warn(`Failed to convert block ${block.Id} to VEVENT: ${error.message}`)
      // Continue with other blocks
    }
  }

  ics += 'END:VCALENDAR'
  return ics
}

/**
 * Convert an availability block to a VEVENT component
 */
function convertBlockToVEvent(propertyId: string, block: AvailabilityBlock, now: string): string {
  // Generate stable UID based on property and block ID
  const uid = `block-${block.Id}@${propertyId}`

  // Format dates as UTC
  const startDate = formatICalDate(new Date(block.StartDate))
  const endDate = formatICalDate(new Date(block.EndDate))

  // Determine summary based on block type
  let summary: string
  switch (block.BlockType) {
    case BlockType.Booking:
      summary = 'Booked'
      break
    case BlockType.OwnerBlock:
      summary = block.Title || 'Blocked'
      break
    default:
      summary = 'Unavailable'
  }

  // Set description
  const description = block.Description || `${summary} - Property unavailable`

  // Build VEVENT content
  let vevent = `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${escapeICalText(summary)}
DESCRIPTION:${escapeICalText(description)}
STATUS:CONFIRMED
TRANSP:OPAQUE
`

  // Add last modified if available
  if (block.LastModified) {
    const lastModified = new Date(block.LastModified).toISOString()
      .replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z'
    vevent += `LAST-MODIFIED:${lastModified}
`
  }

  vevent += 'END:VEVENT\n'

  return vevent
}

/**
 * Format a date as iCal DATE format (YYYYMMDD)
 */
function formatICalDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Escape text for iCal format
 * iCal requires escaping of commas, semicolons, and backslashes
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/;/g, '\\;')    // Escape semicolons
    .replace(/,/g, '\\,')    // Escape commas
    .replace(/\n/g, '\\n')   // Escape newlines
}

/**
 * Generate ETag for caching based on content
 */
export function generateETag(content: string): string {
  // Simple hash function for ETag generation
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `"${Math.abs(hash).toString(16)}"`
}

/**
 * Validate that generated iCal content is well-formed
 */
export function validateICalContent(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Basic validation checks
  if (!content.includes('BEGIN:VCALENDAR')) {
    errors.push('Missing BEGIN:VCALENDAR')
  }

  if (!content.includes('END:VCALENDAR')) {
    errors.push('Missing END:VCALENDAR')
  }

  if (!content.includes('VERSION:2.0')) {
    errors.push('Missing VERSION:2.0')
  }

  // Check for properly closed VEVENTs
  const beginCount = (content.match(/BEGIN:VEVENT/g) || []).length
  const endCount = (content.match(/END:VEVENT/g) || []).length
  if (beginCount !== endCount) {
    errors.push(`Unmatched VEVENT blocks: ${beginCount} BEGIN, ${endCount} END`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}