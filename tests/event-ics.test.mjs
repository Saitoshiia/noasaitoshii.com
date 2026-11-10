import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEventIcs, hasCalendarFile } from '../src/lib/event-ics.mjs'

const event = {
  slug: 'noa-rud3-2026-12-04',
  title: 'Noa @ Rud3; late set, part 2',
  subtitle: 'A Saitoshiia event',
  type: 'metaverse',
  startsAt: '2026-12-04T03:00:00Z',
  endsAt: '2026-12-04T05:00:00Z',
  venue: 'Rud3',
  address: 'Aether · Jenova · Mist · Ward 5 · Plot 12',
  streamUrl: 'https://www.twitch.tv/noasaitoshii',
  status: 'upcoming',
}

test('calendar file escapes text, uses CRLF and folds long lines', () => {
  const ics = buildEventIcs({ event, url: 'https://noasaitoshii.com/events/noa-rud3-2026-12-04' })
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.match(ics, /SUMMARY:Noa @ Rud3\; late set\\, part 2\r\n/)
  assert.match(ics, /DTSTART:20261204T030000Z/)
  assert.match(ics, /UID:noa-rud3-2026-12-04@noasaitoshii\.com/)
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line)
})

test('only upcoming, not cancelled events get a calendar file', () => {
  const now = new Date('2026-11-09T00:00:00Z')
  assert.equal(hasCalendarFile(event, now), true)
  assert.equal(hasCalendarFile({ ...event, status: 'cancelled' }, now), false)
  assert.equal(hasCalendarFile(event, new Date('2026-12-05T00:00:00Z')), false)
})
