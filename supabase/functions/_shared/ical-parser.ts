/**
 * iCal Parser Utility
 *
 * Robust iCal parser for Edge Functions using ical.js library.
 * Handles timezone conversions, recurring events, and various edge cases.
 */

import ICAL from 'https://esm.sh/ical.js@1.5.0'
import { createLogger } from './logger.ts'

// Re-export types for convenience
export type { ICalEvent, ICalFeedMetadata } from '../../../src/models/calendar/CalendarSync.ts'

/**
 * Error class for iCal parsing errors
 */
export class ICalParseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'ICalParseError'
  }
}

/**
 * Error class for iCal validation errors
 */
export class ICalValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'ICalValidationError'
  }
}

// Structured logger
const logger = createLogger('ical-parser')

/**
 * Configuration options for the parser
 */
export interface ICalParserOptions {
  logger?: Logger
  maxEvents?: number
  timezone?: string // Default timezone for parsing
  expandRecurring?: boolean // Whether to expand recurring events
  maxRecurringInstances?: number // Max instances to expand for recurring events
}

/**
 * Internal representation of a parsed iCal event before normalization
 */
interface ParsedICalEvent {
  uid: string
  summary?: string
  description?: string
  dtstart?: ICAL.Time
  dtend?: ICAL.Time
  created?: ICAL.Time
  lastModified?: ICAL.Time
  status?: string
  rrule?: ICAL.Recur
  exdates?: ICAL.Time[]
  rawData: any // Full parsed component for debugging
}

/**
 * Parse iCal feed content and extract normalized events
 *
 * @param icsContent - The raw iCal (.ics) content as a string
 * @param options - Parser configuration options
 * @returns Array of normalized ICalEvent objects
 * @throws ICalParseError if parsing fails
 * @throws ICalValidationError if validation fails
 */
export function parseICalFeed(
  icsContent: string,
  options: ICalParserOptions = {}
): Array<{
  uid: string
  summary: string
  description?: string
  dtstart: string
  dtend: string
  created?: string
  lastModified?: string
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}> {
  const {
    logger = defaultLogger,
    maxEvents = 1000,
    timezone = 'UTC',
    expandRecurring = true,
    maxRecurringInstances = 365
  } = options

  logger.info('Starting iCal feed parsing', { contentLength: icsContent.length })

  if (!icsContent || icsContent.trim().length === 0) {
    throw new ICalValidationError('Empty or null iCal content provided')
  }

  try {
    // Parse the iCal content using ical.js
    const jcalData = ICAL.parse(icsContent)
    const comp = new ICAL.Component(jcalData)
    logger.info('Successfully parsed iCal structure')

    // Extract calendar metadata
    const calendarMetadata = extractCalendarMetadata(comp)
    logger.info('Extracted calendar metadata', calendarMetadata)

    // Extract all VEVENT components
    const vevents = comp.getAllSubcomponents('vevent')
    logger.info(`Found ${vevents.length} VEVENT components`)

    if (vevents.length === 0) {
      logger.warn('No VEVENT components found in iCal feed')
      return []
    }

    if (vevents.length > maxEvents) {
      throw new ICalValidationError(
        `Too many events in feed: ${vevents.length} (max: ${maxEvents})`
      )
    }

    // Parse individual events
    const parsedEvents: ParsedICalEvent[] = []
    for (const vevent of vevents) {
      try {
        const parsedEvent = parseVEvent(vevent, timezone)
        if (parsedEvent) {
          parsedEvents.push(parsedEvent)
        }
      } catch (error) {
        logger.warn(`Failed to parse VEVENT: ${error.message}`, { uid: vevent.getFirstPropertyValue('uid') })
        // Continue with other events
      }
    }

    logger.info(`Successfully parsed ${parsedEvents.length} events`)

    // Expand recurring events if requested
    let finalEvents: ParsedICalEvent[] = parsedEvents
    if (expandRecurring) {
      finalEvents = expandRecurringEvents(parsedEvents, {
        maxInstances: maxRecurringInstances,
        timezone,
        logger
      })
      logger.info(`Expanded to ${finalEvents.length} events after recurring expansion`)
    }

    // Normalize events to the expected format
    const normalizedEvents = finalEvents.map(event => normalizeICalEvent(event, timezone, logger))

    logger.info(`Successfully normalized ${normalizedEvents.length} events`)
    return normalizedEvents

  } catch (error) {
    if (error instanceof ICalParseError || error instanceof ICalValidationError) {
      throw error
    }

    logger.error('Unexpected error during iCal parsing', error)
    throw new ICalParseError(
      `Failed to parse iCal feed: ${error.message}`,
      error as Error
    )
  }
}

/**
 * Extract calendar metadata from VCALENDAR component
 */
function extractCalendarMetadata(comp: ICAL.Component): {
  productId?: string
  version?: string
  calendarName?: string
  timezone?: string
  lastModified?: string
} {
  return {
    productId: comp.getFirstPropertyValue('prodid'),
    version: comp.getFirstPropertyValue('version'),
    calendarName: comp.getFirstPropertyValue('x-wr-calname'),
    timezone: comp.getFirstPropertyValue('x-wr-timezone'),
    lastModified: comp.getFirstPropertyValue('last-modified')
  }
}

/**
 * Parse a single VEVENT component
 */
function parseVEvent(vevent: ICAL.Component, defaultTimezone: string): ParsedICalEvent | null {
  const uid = vevent.getFirstPropertyValue('uid')
  if (!uid) {
    throw new ICalValidationError('VEVENT missing required UID property')
  }

  // Skip cancelled events
  const status = vevent.getFirstPropertyValue('status')
  if (status === 'CANCELLED') {
    return null
  }

  // Parse dates with timezone handling
  const dtstart = parseDateTimeProperty(vevent, 'dtstart', defaultTimezone)
  const dtend = parseDateTimeProperty(vevent, 'dtend', defaultTimezone)

  // If no end date but we have start date, assume all-day or 1-hour event
  let effectiveDtEnd = dtend
  if (!effectiveDtEnd && dtstart) {
    if (dtstart.isDate) {
      // All-day event: end date is start date + 1 day
      effectiveDtEnd = dtstart.clone()
      effectiveDtEnd.adjust(1, 0, 0, 0) // Add 1 day
    } else {
      // Regular event: end date is start date + 1 hour
      effectiveDtEnd = dtstart.clone()
      effectiveDtEnd.adjust(0, 1, 0, 0) // Add 1 hour
    }
  }

  // Parse recurrence rule
  const rruleProp = vevent.getFirstProperty('rrule')
  const rrule = rruleProp ? ICAL.Recur.fromData(rruleProp.getValues()[0]) : undefined

  // Parse exception dates
  const exdateProps = vevent.getAllProperties('exdate')
  const exdates = exdateProps.flatMap(prop =>
    prop.getValues().map((value: any) => ICAL.Time.fromData(value))
  )

  return {
    uid,
    summary: vevent.getFirstPropertyValue('summary'),
    description: vevent.getFirstPropertyValue('description'),
    dtstart,
    dtend: effectiveDtEnd,
    created: parseDateTimeProperty(vevent, 'created', defaultTimezone),
    lastModified: parseDateTimeProperty(vevent, 'last-modified', defaultTimezone),
    status,
    rrule,
    exdates,
    rawData: vevent.toJSON()
  }
}

/**
 * Parse a date/time property with timezone handling
 */
function parseDateTimeProperty(
  component: ICAL.Component,
  propertyName: string,
  defaultTimezone: string
): ICAL.Time | undefined {
  const prop = component.getFirstProperty(propertyName.toLowerCase())
  if (!prop) return undefined

  try {
    const time = prop.getFirstValue()
    if (time instanceof ICAL.Time) {
      return time
    }

    // If it's a raw value, create ICAL.Time from it
    return ICAL.Time.fromData(time)
  } catch (error) {
    throw new ICalParseError(`Failed to parse ${propertyName}: ${error.message}`)
  }
}

/**
 * Expand recurring events into individual instances
 */
function expandRecurringEvents(
  events: ParsedICalEvent[],
  options: {
    maxInstances: number
    timezone: string
    logger: Logger
  }
): ParsedICalEvent[] {
  const { maxInstances, timezone, logger } = options
  const expandedEvents: ParsedICalEvent[] = []

  for (const event of events) {
    if (!event.rrule || !event.dtstart) {
      // Not a recurring event, add as-is
      expandedEvents.push(event)
      continue
    }

    try {
      const instances = expandSingleRecurringEvent(event, maxInstances, timezone)
      expandedEvents.push(...instances)
      logger.info(`Expanded recurring event ${event.uid} into ${instances.length} instances`)
    } catch (error) {
      logger.warn(`Failed to expand recurring event ${event.uid}: ${error.message}`)
      // Add the original event as fallback
      expandedEvents.push(event)
    }
  }

  return expandedEvents
}

/**
 * Expand a single recurring event into individual instances
 */
function expandSingleRecurringEvent(
  event: ParsedICalEvent,
  maxInstances: number,
  timezone: string
): ParsedICalEvent[] {
  if (!event.rrule || !event.dtstart || !event.dtend) {
    return [event]
  }

  const instances: ParsedICalEvent[] = []
  const iterator = event.rrule.iterator(event.dtstart)

  let instanceCount = 0
  let next: ICAL.Time | null = null

  while ((next = iterator.next()) && instanceCount < maxInstances) {
    // Check if this instance is in the exception dates
    const isExcluded = event.exdates?.some(exdate =>
      exdate.compare(next!) === 0
    )

    if (isExcluded) {
      continue
    }

    // Calculate duration between start and end
    const duration = event.dtend.subtractDate(event.dtstart)

    // Create instance
    const instanceStart = next.clone()
    const instanceEnd = next.clone()
    instanceEnd.addDuration(duration)

    const instance: ParsedICalEvent = {
      ...event,
      uid: `${event.uid}_${instanceCount}`,
      dtstart: instanceStart,
      dtend: instanceEnd,
      rrule: undefined, // Remove recurrence rule from instances
      exdates: undefined // Remove exception dates from instances
    }

    instances.push(instance)
    instanceCount++
  }

  return instances.length > 0 ? instances : [event]
}

/**
 * Normalize a parsed event to the expected ICalEvent format
 */
function normalizeICalEvent(
  event: ParsedICalEvent,
  timezone: string,
  logger: Logger
): {
  uid: string
  summary: string
  description?: string
  dtstart: string
  dtend: string
  created?: string
  lastModified?: string
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
} {
  // Validate required fields
  if (!event.uid) {
    throw new ICalValidationError('Event missing required UID')
  }

  if (!event.dtstart || !event.dtend) {
    throw new ICalValidationError(`Event ${event.uid} missing required date fields`)
  }

  // Convert dates to ISO strings in UTC
  const dtstartIso = convertToISOString(event.dtstart, timezone, logger)
  const dtendIso = convertToISOString(event.dtend, timezone, logger)

  // Validate date order
  if (new Date(dtstartIso) >= new Date(dtendIso)) {
    logger.warn(`Event ${event.uid} has invalid date range: ${dtstartIso} to ${dtendIso}`)
    // Fix by adding 1 hour to end date
    const fixedEnd = new Date(dtstartIso)
    fixedEnd.setHours(fixedEnd.getHours() + 1)
    const fixedDtEndIso = fixedEnd.toISOString()
    logger.info(`Fixed end date for event ${event.uid}: ${fixedDtEndIso}`)
  }

  // Normalize status
  let normalizedStatus: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | undefined
  if (event.status) {
    const upperStatus = event.status.toUpperCase()
    if (['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(upperStatus)) {
      normalizedStatus = upperStatus as 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
    }
  }

  return {
    uid: event.uid,
    summary: event.summary || 'Untitled Event',
    description: event.description,
    dtstart: dtstartIso,
    dtend: dtendIso,
    created: event.created ? convertToISOString(event.created, timezone, logger) : undefined,
    lastModified: event.lastModified ? convertToISOString(event.lastModified, timezone, logger) : undefined,
    status: normalizedStatus || 'CONFIRMED' // Default to CONFIRMED
  }
}

/**
 * Convert ICAL.Time to ISO string with proper timezone handling
 */
function convertToISOString(time: ICAL.Time, defaultTimezone: string, logger: Logger): string {
  try {
    // Convert to UTC for consistent storage
    const utcTime = time.convertToZone(ICAL.Timezone.utcTimezone)
    return utcTime.toString()
  } catch (error) {
    logger.warn(`Failed to convert time to UTC, using local time: ${error.message}`)
    // Fallback: convert to JavaScript Date and then to ISO string
    const jsDate = time.toJSDate()
    return jsDate.toISOString()
  }
}