/**
 * iCal feed parser for inbound Airbnb, Booking.com, and other ICS feeds.
 * Handles parameterised properties, all-day dates, TZID, and DURATION.
 */

export interface ParsedICalEvent {
  uid: string
  summary?: string
  description?: string
  start: Date
  end: Date
  cancelled: boolean
  transparent: boolean
}

export interface ParsedICalFeed {
  events: ParsedICalEvent[]
  hasCalendar: boolean
  calendarName?: string
}

interface ContentLine {
  name: string
  params: Record<string, string>
  value: string
}

const DURATION_RE = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i

export function parseICalFeed(icsContent: string): ParsedICalFeed {
  const text = icsContent.replace(/^\uFEFF/, '')
  const lines = unfoldLines(text)
  const events: ParsedICalEvent[] = []
  let hasCalendar = false
  let calendarName: string | undefined
  let inEvent = false
  let current: Record<string, ContentLine> = {}

  for (const line of lines) {
    const upper = line.toUpperCase()
    if (upper === 'BEGIN:VCALENDAR') {
      hasCalendar = true
      continue
    }
    if (upper === 'END:VCALENDAR' || upper === 'BEGIN:VCALENDAR') continue
    if (upper === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (upper === 'END:VEVENT') {
      if (inEvent) {
        const event = finishEvent(current)
        if (event) events.push(event)
      }
      inEvent = false
      current = {}
      continue
    }

    const parsed = splitContentLine(line)
    if (!parsed) continue

    if (!inEvent && parsed.name === 'x-wr-calname' && parsed.value) {
      calendarName = parsed.value
      continue
    }
    if (!inEvent) continue

    if (parsed.name === 'dtstart' || parsed.name === 'dtend' || parsed.name === 'duration' ||
        parsed.name === 'uid' || parsed.name === 'summary' || parsed.name === 'description' ||
        parsed.name === 'status' || parsed.name === 'transp') {
      current[parsed.name] = parsed
    }
  }

  return { events, hasCalendar, calendarName }
}

function unfoldLines(content: string): string[] {
  const physical = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const lines: string[] = []
  for (const physicalLine of physical) {
    const line = physicalLine.trimEnd()
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else if (line.length > 0) {
      lines.push(line)
    }
  }
  return lines
}

function splitContentLine(line: string): ContentLine | null {
  let inQuotes = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ':' && !inQuotes) {
      colon = i
      break
    }
  }
  if (colon <= 0) return null

  const left = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const semi = indexOfUnquoted(left, ';')
  const name = (semi === -1 ? left : left.slice(0, semi)).trim().toLowerCase()
  if (!name) return null

  const params: Record<string, string> = {}
  if (semi !== -1) {
    for (const part of splitUnquoted(left.slice(semi + 1), ';')) {
      const eq = part.indexOf('=')
      if (eq <= 0) continue
      const key = part.slice(0, eq).trim().toLowerCase()
      let paramValue = part.slice(eq + 1).trim()
      if (paramValue.startsWith('"') && paramValue.endsWith('"') && paramValue.length >= 2) {
        paramValue = paramValue.slice(1, -1)
      }
      if (key) params[key] = paramValue
    }
  }

  return { name, params, value }
}

function indexOfUnquoted(input: string, target: string): number {
  let inQuotes = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && input.startsWith(target, i)) return i
  }
  return -1
}

function splitUnquoted(input: string, separator: string): string[] {
  const parts: string[] = []
  let inQuotes = false
  let start = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && input.startsWith(separator, i)) {
      parts.push(input.slice(start, i))
      start = i + separator.length
    }
  }
  parts.push(input.slice(start))
  return parts
}

function finishEvent(fields: Record<string, ContentLine>): ParsedICalEvent | null {
  const uid = fields.uid?.value?.trim()
  const startLine = fields.dtstart
  if (!uid || !startLine?.value) return null

  let start: Date
  try {
    start = parseIcsDate(startLine.value.trim(), startLine.params)
  } catch {
    return null
  }

  const startIsDate = isDateValue(startLine.value.trim(), startLine.params)
  let end: Date | null = null
  if (fields.dtend?.value) {
    try {
      end = parseIcsDate(fields.dtend.value.trim(), fields.dtend.params)
    } catch {
      return null
    }
  } else if (fields.duration?.value) {
    end = addDuration(start, fields.duration.value.trim())
    if (!end) return null
  } else if (startIsDate) {
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  } else {
    return null
  }

  if (end.getTime() <= start.getTime()) return null

  const status = (fields.status?.value ?? '').trim().toUpperCase()
  const transp = (fields.transp?.value ?? '').trim().toUpperCase()

  return {
    uid,
    summary: fields.summary?.value,
    description: fields.description?.value,
    start,
    end,
    cancelled: status === 'CANCELLED',
    transparent: transp === 'TRANSPARENT',
  }
}

function isDateValue(value: string, params: Record<string, string>): boolean {
  const kind = (params.value ?? '').toUpperCase()
  return kind === 'DATE' || (/^\d{8}$/.test(value) && !value.includes('T'))
}

function parseIcsDate(value: string, params: Record<string, string>): Date {
  if (isDateValue(value, params)) {
    if (!/^\d{8}$/.test(value)) {
      throw new Error(`Unsupported ICS date format: ${value}`)
    }
    const year = Number(value.slice(0, 4))
    const month = Number(value.slice(4, 6))
    const day = Number(value.slice(6, 8))
    return new Date(Date.UTC(year, month - 1, day))
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value)
  if (!match) throw new Error(`Unsupported ICS date format: ${value}`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const tzid = params.tzid

  if (match[7] === 'Z' || !tzid) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  }

  return zonedWallTimeToUtc(year, month, day, hour, minute, second, tzid)
}

function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const desired = Date.UTC(year, month - 1, day, hour, minute, second)
  let utc = desired
  for (let i = 0; i < 3; i++) {
    const localMs = partsToUtcMs(zonedParts(timeZone, new Date(utc)))
    utc = desired - (localMs - utc)
  }
  return new Date(utc)
}

function zonedParts(timeZone: string, instant: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = fmt.formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

function partsToUtcMs(parts: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}): number {
  let { year, month, day, hour, minute, second } = parts
  if (hour === 24) {
    hour = 0
    const shifted = new Date(Date.UTC(year, month - 1, day))
    shifted.setUTCDate(shifted.getUTCDate() + 1)
    year = shifted.getUTCFullYear()
    month = shifted.getUTCMonth() + 1
    day = shifted.getUTCDate()
  }
  return Date.UTC(year, month - 1, day, hour, minute, second)
}

function addDuration(start: Date, duration: string): Date | null {
  const match = DURATION_RE.exec(duration)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const weeks = Number(match[2] ?? 0)
  const days = Number(match[3] ?? 0)
  const hours = Number(match[4] ?? 0)
  const minutes = Number(match[5] ?? 0)
  const seconds = Number(match[6] ?? 0)
  if (weeks + days + hours + minutes + seconds === 0) return null
  const delta = sign * (
    ((weeks * 7 + days) * 24 * 60 * 60) +
    (hours * 60 * 60) +
    (minutes * 60) +
    seconds
  ) * 1000
  return new Date(start.getTime() + delta)
}
