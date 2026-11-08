import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOOKING_INQUIRY_MAX_BODY_BYTES,
  BOOKING_INQUIRY_SCHEMA_VERSION,
} from './booking-inquiry-contract.js'
import { createBookingInquiryHandler } from './booking-inquiry.js'
import {
  normalizeBookingInquiryPacket,
  validateBookingInquiryPacket,
} from '../../../../../ops/n8n/scripts/lib/booking-inquiry-ingest-contract.mjs'

function validPayload(overrides = {}) {
  return {
    eventName: 'Night Garden 2026',
    inquiryType: 'performance',
    locationType: 'irl',
    venueName: 'The Garden',
    venueAddress: 'Los Angeles, CA',
    estimatedAttendance: '500',
    startAt: '2026-08-15T20:00',
    endAt: '2026-08-15T21:30',
    timezone: 'America/Los_Angeles',
    contactName: 'Promoter',
    contactEmail: 'BOOKING@EXAMPLE.COM',
    organization: 'Night Garden',
    website: 'https://example.com/events',
    genres: 'Electronic',
    notes: 'Load-in details available on request.',
    feeAccepted: true,
    privacyAccepted: true,
    contactAllowed: true,
    turnstileToken: 'test-token',
    companyFax: '',
    ...overrides,
  }
}

function fixture(options = {}) {
  const sent = []
  const records = new Map()
  const handler = createBookingInquiryHandler({
    turnstile: { verify: async () => options.turnstile !== false },
    rateLimit: { consume: async () => options.rateLimit !== false },
    queue: {
      send: async (message) => {
        if (options.queueFailure) throw new Error('contains sensitive data: booking@example.com')
        sent.push(message)
      },
    },
    idempotency: {
      get: async (key) => records.get(key) ?? null,
      put: async (key, value) => records.set(key, value),
    },
  })
  return { handler, sent, records }
}

function request(body, headers = {}, url = 'https://noasaitoshii.com/api/booking-inquiries') {
  return new Request(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin,
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

test('accepts and queues only the normalized allowlisted packet', async () => {
  const { handler, sent } = fixture()
  const result = await handler(request({ ...validPayload(), internalStatus: 'Accepted' }), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(result.status, 202)
  const body = await result.json()
  assert.match(body.inquiry.id, /^inq_[A-Za-z0-9_-]{22}$/)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].contact.email, 'booking@example.com')
  assert.equal(sent[0].schemaVersion, BOOKING_INQUIRY_SCHEMA_VERSION)
  assert.equal(sent[0].queue.attempt, 1)
  assert.equal(sent[0].queue.messageId, body.inquiry.id)
  assert.equal(sent[0].source.submissionId, body.inquiry.id)
  assert.equal(sent[0].source.submittedAt, sent[0].queue.enqueuedAt)
  assert.equal(sent[0].opportunity.eventName, 'Night Garden 2026')
  assert.equal(sent[0].opportunity.inquiryType, 'DJ Set')
  assert.deepEqual(sent[0].creative.genres, ['Electronic'])
  assert.deepEqual(sent[0].creative.vibes, [])
  assert.equal(sent[0].schedule.start, '2026-08-16T03:00:00.000Z')
  assert.equal(sent[0].schedule.timeZone, 'America/Los_Angeles')
  assert.equal(sent[0].schedule.dateFlexible, false)
  assert.equal(sent[0].location.kind, 'IRL')
  assert.equal(sent[0].commercial.feeAccepted, true)
  assert.equal(sent[0].consent.privacyAccepted, true)
  assert.equal(sent[0].internalStatus, undefined)
  assert.equal(sent[0].turnstileToken, undefined)
  assert.doesNotThrow(() => validateBookingInquiryPacket(sent[0]))
  const n8nNormalized = normalizeBookingInquiryPacket(sent[0])
  assert.equal(n8nNormalized.inquiryId, `website:${body.inquiry.id}`)
  assert.equal(n8nNormalized.idempotencyKey, n8nNormalized.inquiryId)
})

test('rejects malformed JSON and a non-JSON content type', async () => {
  const { handler } = fixture()
  const malformed = await handler(request('{not-json'), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(malformed.status, 400)
  assert.equal((await malformed.json()).error.code, 'malformed_json')

  const wrongType = await handler(request('{}', { 'content-type': 'text/plain' }), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(wrongType.status, 415)
})

test('rejects declared and streamed oversized bodies before validation', async () => {
  const { handler } = fixture()
  const declared = await handler(request('{}', { 'content-length': String(BOOKING_INQUIRY_MAX_BODY_BYTES + 1) }), {
    BOOKING_INQUIRY_MODE: 'local',
  })
  assert.equal(declared.status, 413)

  const streamed = await handler(request(JSON.stringify({ padding: 'x'.repeat(BOOKING_INQUIRY_MAX_BODY_BYTES) })), {
    BOOKING_INQUIRY_MODE: 'local',
  })
  assert.equal(streamed.status, 413)
})

test('rejects cross-origin POST and OPTIONS but answers same-origin OPTIONS', async () => {
  const { handler } = fixture()
  const crossOrigin = request(validPayload(), { origin: 'https://attacker.example' })
  assert.equal((await handler(crossOrigin, { BOOKING_INQUIRY_MODE: 'local' })).status, 403)

  const crossOptions = new Request('https://noasaitoshii.com/api/booking-inquiries', {
    method: 'OPTIONS',
    headers: { origin: 'https://attacker.example' },
  })
  assert.equal((await handler(crossOptions, { BOOKING_INQUIRY_MODE: 'local' })).status, 403)

  const options = new Request('https://noasaitoshii.com/api/booking-inquiries', {
    method: 'OPTIONS',
    headers: { origin: 'https://noasaitoshii.com' },
  })
  assert.equal((await handler(options, { BOOKING_INQUIRY_MODE: 'local' })).status, 204)
})

test('returns the same stable inquiry for an idempotent duplicate and queues once', async () => {
  const { handler, sent } = fixture()
  const first = await handler(request(validPayload()), { BOOKING_INQUIRY_MODE: 'local' })
  const second = await handler(request(validPayload()), { BOOKING_INQUIRY_MODE: 'local' })
  const firstBody = await first.json()
  const secondBody = await second.json()
  assert.equal(firstBody.inquiry.id, secondBody.inquiry.id)
  assert.equal(secondBody.duplicate, true)
  assert.equal(sent.length, 1)
})

test('reuses source identity and submittedAt when retrying a failed queue send', async () => {
  const records = new Map()
  const attempted = []
  let fail = true
  const handler = createBookingInquiryHandler({
    turnstile: { verify: async () => true },
    rateLimit: { consume: async () => true },
    queue: {
      send: async (packet) => {
        attempted.push(structuredClone(packet))
        if (fail) {
          fail = false
          throw new Error('simulated queue outage')
        }
      },
    },
    idempotency: {
      get: async (key) => records.get(key) ?? null,
      put: async (key, value) => records.set(key, structuredClone(value)),
    },
  })
  assert.equal((await handler(request(validPayload()), { BOOKING_INQUIRY_MODE: 'local' })).status, 503)
  assert.equal((await handler(request(validPayload()), { BOOKING_INQUIRY_MODE: 'local' })).status, 202)
  assert.equal(attempted.length, 2)
  assert.equal(attempted[0].source.submissionId, attempted[1].source.submissionId)
  assert.equal(attempted[0].source.submittedAt, attempted[1].source.submittedAt)
  assert.equal(attempted[0].queue.messageId, attempted[1].queue.messageId)
})

test('silently accepts a filled honeypot without invoking adapters', async () => {
  let called = false
  const handler = createBookingInquiryHandler({
    turnstile: { verify: async () => { called = true; return false } },
    rateLimit: { consume: async () => { called = true; return false } },
    queue: { send: async () => { called = true } },
  })
  const result = await handler(request({ companyFax: 'bot value' }), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(result.status, 202)
  assert.deepEqual(await result.json(), { ok: true, accepted: true })
  assert.equal(called, false)
})

test('fails Turnstile closed and rate limits before queueing', async () => {
  const failedChallenge = fixture({ turnstile: false })
  const challengeResponse = await failedChallenge.handler(request(validPayload()), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(challengeResponse.status, 403)
  assert.equal((await challengeResponse.json()).error.code, 'challenge_failed')
  assert.equal(failedChallenge.sent.length, 0)

  const limited = fixture({ rateLimit: false })
  const limitedResponse = await limited.handler(request(validPayload()), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(limitedResponse.status, 429)
  assert.equal(limited.sent.length, 0)
})

test('enforces location conditionals, contact email, and timezone-offset accuracy', async () => {
  const { handler, sent } = fixture()
  const partialStream = validPayload({
    locationType: 'stream',
    platform: 'Twitch',
    channelUrl: '',
  })
  assert.equal((await handler(request(partialStream), { BOOKING_INQUIRY_MODE: 'local' })).status, 422)

  const badEmail = validPayload({ contactEmail: 'not-an-email' })
  assert.equal((await handler(request(badEmail), { BOOKING_INQUIRY_MODE: 'local' })).status, 422)

  const nonexistentDstTime = validPayload({
    startAt: '2026-03-08T02:30',
    endAt: '2026-03-08T04:00',
    timezone: 'America/Los_Angeles',
  })
  const dstResponse = await handler(request(nonexistentDstTime), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(dstResponse.status, 422)
  assert.equal(sent.length, 0)
})

test('maps every public opportunity/location enum to exact canonical values and tag arrays', async () => {
  const cases = [
    ['performance', 'irl', 'DJ Set', 'IRL', {}],
    ['collaboration', 'stream', 'Collab Stream', 'Stream Only', {
      platform: 'Twitch',
      channelUrl: 'https://twitch.tv/example',
    }],
    ['press', 'ffxiv', 'Interview', 'FFXIV', {
      region: 'NA',
      dataCenter: 'Aether',
      world: 'Cactuar',
      wardPlot: 'Ward 12, Plot 34',
    }],
    ['other', 'undecided', 'Other', 'Other', {}],
  ]
  for (const [inquiryType, locationType, canonicalInquiry, canonicalLocation, extra] of cases) {
    const { handler, sent } = fixture()
    const result = await handler(request(validPayload({
      inquiryType,
      locationType,
      genres: 'Techno, House, Techno',
      vibe: "DJ's Choice; Warehouse Rave",
      ...extra,
    })), { BOOKING_INQUIRY_MODE: 'local' })
    assert.equal(result.status, 202)
    assert.equal(sent[0].opportunity.inquiryType, canonicalInquiry)
    assert.equal(sent[0].location.kind, canonicalLocation)
    assert.deepEqual(sent[0].creative.genres, ['House', 'Techno'])
    assert.deepEqual(sent[0].creative.vibes, ["DJ's Choice", 'Warehouse Rave'])
    assert.doesNotThrow(() => validateBookingInquiryPacket(sent[0]))
  }
})

test('requires explicit privacy consent for canonical queue packets', async () => {
  const { handler, sent } = fixture()
  const result = await handler(request(validPayload({ privacyAccepted: false })), {
    BOOKING_INQUIRY_MODE: 'local',
  })
  assert.equal(result.status, 422)
  assert.equal((await result.json()).error.code, 'validation_failed')
  assert.equal(sent.length, 0)
})

test('queue failure is sanitized and preserves only stable retry metadata', async () => {
  const { handler, records } = fixture({ queueFailure: true })
  const result = await handler(request(validPayload()), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(result.status, 503)
  const serialized = JSON.stringify(await result.json())
  assert.equal(serialized.includes('booking@example.com'), false)
  assert.equal(records.size, 1)
  const [record] = records.values()
  assert.equal(record.state, 'pending')
  assert.match(record.inquiryId, /^inq_/)
  assert.equal(JSON.stringify(record).includes('booking@example.com'), false)
})

test('production fails closed when operational bindings are missing', async () => {
  const result = await createBookingInquiryHandler()(request(validPayload()), {})
  assert.equal(result.status, 503)
  assert.equal((await result.json()).error.code, 'not_configured')
})

test('explicit local mode completes without Cloudflare bindings and deduplicates in-process', async () => {
  const handler = createBookingInquiryHandler()
  const payload = validPayload({ eventName: 'Local Prototype Binding-Free Proof' })
  const first = await handler(request(payload), { BOOKING_INQUIRY_MODE: 'local' })
  const second = await handler(request(payload), { BOOKING_INQUIRY_MODE: 'local' })
  assert.equal(first.status, 202)
  assert.equal(second.status, 202)
  const firstBody = await first.json()
  const secondBody = await second.json()
  assert.equal(firstBody.accepted, true)
  assert.equal(firstBody.duplicate, false)
  assert.equal(secondBody.duplicate, true)
  assert.equal(firstBody.inquiry.id, secondBody.inquiry.id)
})
