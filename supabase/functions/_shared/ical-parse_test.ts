/**
 * Run: deno test supabase/functions/_shared/ical-parse_test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { parseICalFeed } from './ical-parse.ts'

const AIRBNB = `BEGIN:VCALENDAR\r
PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN\r
VERSION:2.0\r
BEGIN:VEVENT\r
DTSTART;VALUE=DATE:20261021\r
DTEND;VALUE=DATE:20261024\r
UID:stay-1@airbnb.com\r
SUMMARY:Reserved\r
END:VEVENT\r
END:VCALENDAR\r
`

Deno.test('parses Airbnb all-day VALUE=DATE events as UTC midnights', () => {
  const feed = parseICalFeed(AIRBNB)
  assertEquals(feed.hasCalendar, true)
  assertEquals(feed.events.length, 1)
  assertEquals(feed.events[0].uid, 'stay-1@airbnb.com')
  assertEquals(feed.events[0].start.toISOString(), '2026-10-21T00:00:00.000Z')
  assertEquals(feed.events[0].end.toISOString(), '2026-10-24T00:00:00.000Z')
  assertEquals(feed.events[0].cancelled, false)
})

Deno.test('parses a Booking.com all-day reservation', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Booking.com//EN',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261101',
    'DTEND;VALUE=DATE:20261105',
    'UID:booking-1',
    'SUMMARY:CLOSED - Not available',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
  const feed = parseICalFeed(ics)
  assertEquals(feed.events.length, 1)
  assertEquals(feed.events[0].summary, 'CLOSED - Not available')
  assertEquals(feed.events[0].start.toISOString(), '2026-11-01T00:00:00.000Z')
  assertEquals(feed.events[0].end.toISOString(), '2026-11-05T00:00:00.000Z')
})

Deno.test('converts DTSTART with TZID from wall time to UTC', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:tz-1',
    'DTSTART;TZID=America/Montevideo:20261021T150000',
    'DTEND;TZID=America/Montevideo:20261021T180000',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
  const event = parseICalFeed(ics).events[0]
  assertEquals(event.start.toISOString(), '2026-10-21T18:00:00.000Z')
  assertEquals(event.end.toISOString(), '2026-10-21T21:00:00.000Z')
})

Deno.test('uses DURATION when DTEND is absent', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:dur-1',
    'DTSTART:20261021T100000Z',
    'DURATION:PT2H',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
  const event = parseICalFeed(ics).events[0]
  assertEquals(event.start.toISOString(), '2026-10-21T10:00:00.000Z')
  assertEquals(event.end.toISOString(), '2026-10-21T12:00:00.000Z')
})

Deno.test('gives an all-day event with no end a one-day length', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:oneday',
    'DTSTART;VALUE=DATE:20261021',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
  const event = parseICalFeed(ics).events[0]
  assertEquals(event.end.toISOString(), '2026-10-22T00:00:00.000Z')
})

Deno.test('unfolds a line that continues with a tab', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:fold-1',
    'DTSTART;VALUE=DATE:20261021',
    'DTEND;VALUE=DATE:20261022',
    'SUMMARY:Hello',
    '\tworld',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
  assertEquals(parseICalFeed(ics).events[0].summary, 'Helloworld')
})

Deno.test('treats STATUS cancelled in any case as cancelled', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:gone',
    'DTSTART;VALUE=DATE:20261021',
    'DTEND;VALUE=DATE:20261022',
    'STATUS:cancelled',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
  assertEquals(parseICalFeed(ics).events[0].cancelled, true)
})

Deno.test('reports hasCalendar false when the body is not a calendar', () => {
  const feed = parseICalFeed('<html>not a calendar</html>')
  assertEquals(feed.hasCalendar, false)
  assertEquals(feed.events.length, 0)
})
