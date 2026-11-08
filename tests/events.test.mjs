import assert from 'node:assert/strict'
import test from 'node:test'
import {
  events,
  getEventBySlug,
  getPastEvents,
  getUpcomingEvents,
  projectGeneratedEvent,
  projectEventLifecycle,
} from '../src/data/events.js'
import { validateEvents } from '../src/lib/validate-events.mjs'

const generatedEventFixture = (overrides = {}) => ({
  slug: 'projection-fixture',
  title: 'Canonical source title',
  eventType: 'ffxiv',
  status: 'live',
  startsAtUtc: '2026-09-20T01:00:00Z',
  endsAtUtc: '2026-09-20T04:00:00Z',
  noaStartsAtUtc: '2026-09-20T02:00:00Z',
  noaEndsAtUtc: '2026-09-20T03:00:00Z',
  eventTimeZone: 'America/Los_Angeles',
  venueName: 'Canonical venue',
  locationDisplay: 'Canonical location',
  address: {
    region: 'North America',
    dataCenter: 'Dynamis',
    world: 'Marilith',
    district: 'Goblet',
    ward: 9,
    plot: 36,
  },
  genre: ['Electronic'],
  vibe: null,
  theme: null,
  ticketUrl: null,
  eventInfoUrl: null,
  streamUrl: null,
  lineupStatus: 'tba',
  lineup: [],
  setTimes: [],
  ...overrides,
})

const authoredEditorialFixture = {
  title: 'Editorial title',
  subtitle: 'Editorial subtitle',
  venue: 'Authored venue',
  location: 'Authored location',
  address: 'Authored address',
  genre: 'Authored genre',
  theme: 'Authored theme',
}

test('shipped public events satisfy the all-or-nothing lineup contract', () => {
  assert.deepEqual(validateEvents(events).errors, [])
})

test('projects a venue-less non-DJ stream without metaverse or lineup placeholders', () => {
  const event = projectGeneratedEvent({
    slug: 'noa-gaming-palworld-2026-09-09',
    title: 'Noa Gaming: Palworld!',
    eventType: 'stream',
    status: 'upcoming',
    startsAtUtc: '2026-09-10T04:00:00Z',
    endsAtUtc: '2026-09-10T06:00:00Z',
    noaStartsAtUtc: null,
    noaEndsAtUtc: null,
    eventTimeZone: 'America/Los_Angeles',
    venueName: null,
    locationDisplay: 'Twitch',
    address: null,
    topic: 'Gaming',
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

  assert.equal(event.type, 'stream')
  assert.equal(event.subtitle, 'Live on Twitch')
  assert.equal(event.location, 'Twitch')
  assert.equal(event.topic, 'Gaming')
  assert.equal(event.address, null)
  assert.equal(event.genre, null)
  assert.equal(event.primaryUrl, 'https://www.twitch.tv/noasaitoshii')
  assert.deepEqual(validateEvents([event]).errors, [])
})

test('keeps Listening Lounge venue attendance and its stream in the artist event ledger', () => {
  // A generated event can age out of the rolling export window. Test the
  // adapter with a fixed fixture, then validate any currently shipped rows.
  const event = projectGeneratedEvent(generatedEventFixture({
    slug: 'listening-lounge-fixture',
    title: 'Noa’s Listening Lounge: Midweek Reset',
    venueSlug: 'listening-lounge',
    venueName: 'Saitoshiia Listening Lounge',
    locationDisplay: 'Final Fantasy XIV · North America',
    topic: 'Listening session',
    isLivestream: true,
    streamUrl: 'https://www.twitch.tv/noasaitoshii',
    lineupStatus: 'confirmed',
    lineup: [{ name: 'Noa Saitoshii', url: 'https://www.twitch.tv/noasaitoshii' }],
    audiences: { noaSaitoshii: true, saitoshiia: true },
  }))

  assert.ok(events.filter((candidate) => candidate.slug.startsWith('noa-s-listening-lounge-'))
    .every((candidate) => candidate.venueSlug === 'listening-lounge'), 'Listening Lounge should be routed to noasaitoshii.com')
  assert.equal(event.type, 'metaverse')
  assert.equal(event.venue, 'Saitoshiia Listening Lounge')
  assert.equal(event.location, 'Final Fantasy XIV · North America')
  assert.equal(event.topic, 'Listening session')
  assert.equal(event.venueSlug, 'listening-lounge')
  assert.equal(event.streamUrl, 'https://www.twitch.tv/noasaitoshii')
  assert.equal(event.primaryUrl, 'https://www.twitch.tv/noasaitoshii')
  assert.equal(event.lineupStatus, 'confirmed')
})

test('canonical venue, location, address, time, and status replace authored operational facts', () => {
  const event = projectGeneratedEvent(generatedEventFixture({
    venueName: 'Moved venue',
    locationDisplay: 'Moved location',
    address: {
      region: 'North America',
      dataCenter: 'Crystal',
      world: 'Zalera',
      district: 'Lav Beds',
      ward: 13,
      plot: 28,
    },
    startsAtUtc: '2026-10-01T05:00:00Z',
    endsAtUtc: '2026-10-01T08:00:00Z',
    noaStartsAtUtc: '2026-10-01T06:00:00Z',
    noaEndsAtUtc: '2026-10-01T07:00:00Z',
    status: 'upcoming',
  }), authoredEditorialFixture)

  assert.equal(event.title, 'Editorial title')
  assert.equal(event.subtitle, 'Editorial subtitle')
  assert.equal(event.venue, 'Moved venue')
  assert.equal(event.location, 'Moved location')
  assert.equal(event.address, 'Crystal · Zalera · Lav Beds · Ward 13 · Plot 28')
  assert.equal(event.startsAt, '2026-10-01T05:00:00Z')
  assert.equal(event.endsAt, '2026-10-01T08:00:00Z')
  assert.equal(event.noaStartsAt, '2026-10-01T06:00:00Z')
  assert.equal(event.noaEndsAt, '2026-10-01T07:00:00Z')
  assert.equal(event.status, 'upcoming')
  assert.deepEqual(validateEvents([event]).errors, [])
})

test('withheld canonical address does not revive an authored address', () => {
  const event = projectGeneratedEvent(generatedEventFixture({ address: null }), authoredEditorialFixture)

  assert.equal(event.address, 'Address not published')
  assert.notEqual(event.address, authoredEditorialFixture.address)
  assert.deepEqual(validateEvents([event]).errors, [])
})

test('TBA events cannot leak partial lineup or set-time facts', () => {
  const fixture = structuredClone(events[0])
  assert.ok(fixture, 'expected at least one shipped event fixture')
  fixture.lineupStatus = 'tba'
  fixture.setTimes = []
  fixture.lineup = [{ name: 'Draft DJ' }]
  assert.match(validateEvents([fixture]).errors.join('\n'), /must not expose lineup or set times/)
})

test('confirmed lineups require complete ordered set windows', () => {
  const fixture = structuredClone(events.find((event) => event.lineupStatus === 'confirmed'))
  fixture.setTimes[0].endsAtUtc = fixture.setTimes[0].startsAtUtc
  assert.match(validateEvents([fixture]).errors.join('\n'), /must be before/)
})

test('IRL event set rows omit stream links', () => {
  const fixture = structuredClone(events.find((event) => event.type === 'irl' && event.lineupStatus === 'confirmed'))
  fixture.setTimes[0].streamUrl = 'https://www.twitch.tv/example'
  assert.match(validateEvents([fixture]).errors.join('\n'), /must be omitted for IRL/)
})

test('accepts complete stage-grouped set times and rejects partial stage metadata', () => {
  const fixture = structuredClone(events.find((event) => event.lineupStatus === 'confirmed'))
  fixture.startsAt = '2026-07-26T04:00:00Z'
  fixture.endsAt = '2026-07-26T09:00:00Z'
  fixture.noaStartsAt = '2026-07-26T04:30:00Z'
  fixture.noaEndsAt = '2026-07-26T05:45:00Z'
  fixture.lineup = [{ name: 'Main DJ' }, { name: 'Gallery DJ' }]
  fixture.setTimes = [
    {
      name: 'Main DJ',
      startsAtUtc: '2026-07-26T07:00:00Z',
      endsAtUtc: '2026-07-26T08:00:00Z',
      stage: 'Main Room',
      stageOrder: 1,
    },
    {
      name: 'Gallery DJ',
      startsAtUtc: '2026-07-26T04:30:00Z',
      endsAtUtc: '2026-07-26T05:30:00Z',
      stage: 'The Gallery',
      stageOrder: 2,
    },
  ]
  assert.deepEqual(validateEvents([fixture]).errors, [])

  delete fixture.setTimes[1].stage
  assert.match(validateEvents([fixture]).errors.join('\n'), /stage is required/)
})

test('homepage event projection excludes completed and terminal events', () => {
  const now = '2026-07-24T18:00:00Z'
  const source = [
    { ...events[0], slug: 'past-status', status: 'past', endsAt: '2026-07-25T08:00:00Z' },
    { ...events[0], slug: 'elapsed-published', status: 'published', endsAt: '2026-07-24T17:59:59Z' },
    { ...events[0], slug: 'upcoming', status: 'upcoming', startsAt: '2026-07-25T03:00:00Z', endsAt: '2026-07-25T08:00:00Z' },
    { ...events[0], slug: 'live', status: 'live', startsAt: '2026-07-24T17:00:00Z', endsAt: '2026-07-24T19:00:00Z' },
  ]

  assert.deepEqual(
    getUpcomingEvents(source, now).map((event) => event.slug),
    ['live', 'upcoming'],
  )
})

test('event archive classifies elapsed public events as past, newest first', () => {
  const now = '2026-07-24T18:00:00Z'
  const source = [
    { ...events[0], slug: 'older-past', status: 'past', startsAt: '2026-07-20T03:00:00Z', endsAt: '2026-07-20T08:00:00Z' },
    { ...events[0], slug: 'newer-elapsed', status: 'upcoming', startsAt: '2026-07-24T03:00:00Z', endsAt: '2026-07-24T08:00:00Z' },
    { ...events[0], slug: 'future', status: 'upcoming', startsAt: '2026-07-25T03:00:00Z', endsAt: '2026-07-25T08:00:00Z' },
  ]

  assert.deepEqual(
    getPastEvents(source, now).map((event) => event.slug),
    ['newer-elapsed', 'older-past'],
  )
})

test('shared event projection overrides stale source status after the event ends', () => {
  const source = [{
    ...events[0],
    slug: 'elapsed-upcoming-detail',
    status: 'upcoming',
    startsAt: '2026-09-06T18:00:00Z',
    endsAt: '2026-09-06T20:00:00Z',
  }]
  const now = '2026-09-07T00:00:00Z'

  assert.equal(projectEventLifecycle(source[0], now).status, 'past')
  assert.equal(getEventBySlug('elapsed-upcoming-detail', source, now).status, 'past')
  assert.deepEqual(getUpcomingEvents(source, now), [])
  assert.deepEqual(getPastEvents(source, now).map((event) => event.slug), ['elapsed-upcoming-detail'])
})
