import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { projectGeneratedEvent } from '../src/data/events.js'
import { formatEventStamp, formatEventWindow, getViewerTimeZone } from '../src/lib/event-time.mjs'
import { getAttendanceLabels, getEventRowMeta, getExperienceLabel } from '../src/lib/event-presentation.mjs'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('presentation keeps overlapping attendance dimensions and corrects experience labels', () => {
  const lounge = {
    slug: 'lounge-fixture',
    title: 'Listening Lounge: Showcase',
    type: 'stream',
    venue: 'Listening Lounge',
    primaryUrl: 'https://www.twitch.tv/noasaitoshii',
  }
  assert.equal(getExperienceLabel(lounge), 'Listening session')
  assert.deepEqual(getAttendanceLabels(lounge), ['FFXIV', 'Livestream'])

  const inPerson = { type: 'irl', venue: 'Sundial', title: 'Sundial session' }
  assert.equal(getExperienceLabel(inPerson), 'Coworking café')
  assert.deepEqual(getAttendanceLabels(inPerson), ['In person'])

  assert.equal(getExperienceLabel({ type: 'metaverse', venueSlug: 'future-room', title: 'Future room' }), 'Event')
  assert.deepEqual(getAttendanceLabels({ type: 'metaverse', streamUrl: 'https://www.youtube.com/watch?v=example' }), ['FFXIV', 'Livestream'])
})

test('livestream attendance remains visible when booking gates withhold the URL', () => {
  const event = {
    type: 'metaverse',
    venueSlug: 'obsidian',
    title: 'Obsidian',
    topic: 'DJ Set',
    isLivestream: true,
    streamUrl: null,
  }
  assert.equal(getExperienceLabel(event), 'DJ set')
  assert.deepEqual(getAttendanceLabels(event), ['FFXIV', 'Livestream'])
  assert.deepEqual(getEventRowMeta(event), {
    experience: 'DJ set',
    supporting: ['FFXIV', 'Livestream'],
  })
})

test('timezone helpers preserve date rollover and fail honestly when viewer zone is unavailable', () => {
  const stamp = formatEventStamp('2026-09-05T00:30:00Z', 'America/Los_Angeles')
  assert.match(stamp, /Sep 04/)
  assert.match(formatEventWindow('2026-09-05T00:30:00Z', '2026-09-05T02:00:00Z', 'America/Los_Angeles'), /Fri, Sep 4/)
  assert.equal(getViewerTimeZone({ DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'not-a-zone' }) }) }), null)
})

test('venue-plus-stream projections retain a published venue address when present', () => {
  const event = projectGeneratedEvent({
    slug: 'venue-stream-fixture',
    title: 'Listening Lounge fixture',
    eventType: 'stream',
    status: 'upcoming',
    startsAtUtc: '2026-10-01T00:00:00Z',
    endsAtUtc: '2026-10-01T02:00:00Z',
    noaStartsAtUtc: '2026-10-01T00:00:00Z',
    noaEndsAtUtc: '2026-10-01T02:00:00Z',
    eventTimeZone: 'America/Los_Angeles',
    venueSlug: 'listening-lounge',
    venueName: 'Listening Lounge',
    locationDisplay: 'Twitch',
    address: 'North America · Dynamis · Marilith · The Goblet · Ward 9 · Plot 42',
    topic: 'DJ Set',
    genre: [],
    vibe: null,
    theme: null,
    ticketUrl: null,
    eventInfoUrl: null,
    streamUrl: 'https://www.twitch.tv/noasaitoshii',
    lineupStatus: 'not-applicable',
    lineup: [],
    setTimes: [],
  })
  assert.equal(event.address, 'North America · Dynamis · Marilith · The Goblet · Ward 9 · Plot 42')
})

test('generated bundle venue identity reaches DJ presentation semantics', () => {
  const event = projectGeneratedEvent({
    slug: 'obsidian-generated-fixture',
    title: 'Obsidian',
    eventType: 'ffxiv',
    status: 'upcoming',
    startsAtUtc: '2026-10-01T00:00:00Z',
    endsAtUtc: '2026-10-01T02:00:00Z',
    noaStartsAtUtc: null,
    noaEndsAtUtc: null,
    eventTimeZone: 'America/Los_Angeles',
    venueSlug: 'obsidian',
    venueName: 'Obsidian',
    locationDisplay: 'Final Fantasy XIV · North America',
    address: null,
    topic: null,
    isLivestream: true,
    genre: ['House', 'Techno'],
    vibe: null,
    theme: null,
    ticketUrl: null,
    eventInfoUrl: null,
    streamUrl: null,
    lineupStatus: 'tba',
    lineup: [],
    setTimes: [],
  })
  assert.equal(event.venueSlug, 'obsidian')
  assert.equal(event.isLivestream, true)
  assert.equal(getExperienceLabel(event), 'DJ set')
})

test('event surfaces include the shared heading, timezone fallback, and loopback-only preview gate', async () => {
  const [home, archive, preview, time] = await Promise.all([
    read('src/pages/index.astro'),
    read('src/pages/events/index.astro'),
    read('src/components/EventLifecyclePreview.astro'),
    read('src/components/EventTime.astro'),
  ])
  assert.match(home, /Upcoming Events/)
  assert.match(archive, /Upcoming Events/)
  assert.match(time, /your timezone unavailable/)
  assert.match(time, /data-time-range/)
  assert.match(time, /data-time-date/)
  assert.match(preview, /localhost.*127\.0\.0\.1|127\.0\.0\.1.*localhost/)
  assert.match(preview, /Reset to real time/)
  assert.match(preview, /Simulate live/)
  assert.match(preview, /preview-at/)
})
