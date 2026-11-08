import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IntakeError,
  MEDIA_INTAKE_CONSENT,
  MEDIA_INTAKE_DEFAULTS,
  signatureMatchesExtension,
  safeDownloadName,
  sniffMediaType,
  validateSessionRequest,
} from './media-intake-contract.js'
import { MediaIntakeLedger } from './media-intake-ledger.js'
import { handleMediaIntake } from './media-intake.js'

class MemoryStorage {
  constructor() {
    this.values = new Map()
  }

  async get(key) {
    return this.values.get(key)
  }

  async put(keyOrEntries, value) {
    if (typeof keyOrEntries === 'object') {
      Object.entries(keyOrEntries).forEach(([key, entry]) => this.values.set(key, entry))
    } else {
      this.values.set(keyOrEntries, value)
    }
  }

  async list({ prefix = '', limit = Infinity, startAfter = '' } = {}) {
    return new Map([...this.values.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .filter(([key]) => !startAfter || key > startAfter)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, limit))
  }

  async delete(keyOrKeys) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]
    return keys.reduce((count, key) => count + Number(this.values.delete(key)), 0)
  }
}

async function readBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value instanceof ReadableStream) return new Uint8Array(await new Response(value).arrayBuffer())
  return new Uint8Array(await new Response(value).arrayBuffer())
}

class MemoryR2 {
  constructor() {
    this.uploads = new Map()
    this.objects = new Map()
  }

  async createMultipartUpload(key, options = {}) {
    const uploadId = crypto.randomUUID()
    const record = { key, uploadId, options, parts: new Map() }
    this.uploads.set(uploadId, record)
    return {
      key,
      uploadId,
      abort: async () => this.uploads.delete(uploadId),
    }
  }

  resumeMultipartUpload(key, uploadId) {
    const record = this.uploads.get(uploadId)
    assert.equal(record?.key, key)
    return {
      uploadPart: async (partNumber, value) => {
        record.parts.set(partNumber, await readBytes(value))
        return { partNumber, etag: `etag-${partNumber}` }
      },
      complete: async (parts) => {
        const size = parts.reduce((total, part) => total + record.parts.get(part.partNumber).length, 0)
        const bytes = new Uint8Array(size)
        let offset = 0
        parts.forEach((part) => {
          const value = record.parts.get(part.partNumber)
          bytes.set(value, offset)
          offset += value.length
        })
        this.objects.set(key, { bytes, options: record.options })
        this.uploads.delete(uploadId)
        return { key, size }
      },
    }
  }

  async get(key, options = {}) {
    const object = this.objects.get(key)
    if (!object) return null
    const range = options.range
    const bytes = range
      ? object.bytes.slice(range.offset, range.offset + range.length)
      : object.bytes
    return {
      size: object.bytes.length,
      etag: object.etag ?? 'mock-etag',
      body: new Blob([bytes]).stream(),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }
  }

  async put(key, value, options = {}) {
    const object = { bytes: await readBytes(value), options, etag: 'eligible-mock-etag' }
    this.objects.set(key, object)
    return { key, size: object.bytes.length, etag: object.etag }
  }

  async delete(key) {
    this.objects.delete(key)
  }
}

function makeEnv({ failReadyOnce = false } = {}) {
  const ledgerInstance = new MediaIntakeLedger({ storage: new MemoryStorage() })
  let shouldFailReady = failReadyOnce
  return {
    MEDIA_INTAKE_MODE: 'local',
    MEDIA_INTAKE_ENABLED: 'true',
    MEDIA_QUARANTINE: new MemoryR2(),
    MEDIA_ELIGIBLE: new MemoryR2(),
    MEDIA_INTAKE_LEDGER: {
      idFromName: (value) => value,
      get: () => ({
        fetch: async (url, init) => {
          const payload = init?.body ? JSON.parse(init.body) : null
          if (
            shouldFailReady
            && init?.method === 'PATCH'
            && payload?.operation === 'status'
            && payload?.status === 'pending_review'
          ) {
            shouldFailReady = false
            return Response.json({
              error: 'simulated_ready_commit_failure',
              message: 'Simulated ready-state commit failure.',
            }, { status: 503 })
          }
          return ledgerInstance.fetch(new Request(url, init))
        },
      }),
    },
  }
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])
const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
const validSubmission = {
  contributorName: 'Friend',
  handle: '@friend',
  email: 'friend@example.com',
  creditPreference: 'social-handle',
  consentVersion: MEDIA_INTAKE_CONSENT.version,
  confirmsAuthority: true,
  grantsMediaLicense: true,
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

test('recognizes only the approved media signatures', () => {
  assert.equal(sniffMediaType(jpeg).mime, 'image/jpeg')
  assert.equal(sniffMediaType(png).mime, 'image/png')
  assert.equal(sniffMediaType(mp4).mime, 'video/mp4')
  assert.equal(sniffMediaType(heic).mime, 'image/heic')
  assert.equal(sniffMediaType(new Uint8Array([1, 2, 3])), null)
  assert.equal(signatureMatchesExtension('.mov', sniffMediaType(mp4)), true)
  assert.equal(signatureMatchesExtension('.jpg', sniffMediaType(mp4)), false)
})

test('validates media sessions and normalizes contributor text', () => {
  const result = validateSessionRequest({
    ...validSubmission,
    contributorName: '  Noa\u0000 Friend ',
    handle: '@friend',
    note: 'afterparty',
    files: [{ name: 'moment.MOV', size: 1024, type: 'video/quicktime', lastModified: 123 }],
  })
  assert.equal(result.contributorName, 'Noa Friend')
  assert.equal(result.consent.version, MEDIA_INTAKE_CONSENT.version)
  assert.equal(result.files[0].extension, '.mov')
  assert.equal(result.totalBytes, 1024)
  assert.equal(safeDownloadName('  café 🎥.mov  '), 'cafe __.mov')
})

test('rejects executable-looking and oversized input before storage', () => {
  assert.throws(() => validateSessionRequest({
    ...validSubmission,
    files: [{ name: 'payload.js', size: 10, type: 'text/javascript' }],
  }), (error) => error instanceof IntakeError && error.code === 'unsupported_extension')

  assert.throws(() => validateSessionRequest({
    ...validSubmission,
    files: [{ name: 'huge.mp4', size: MEDIA_INTAKE_DEFAULTS.maxFileBytes + 1, type: 'video/mp4' }],
  }), (error) => error instanceof IntakeError && error.code === 'file_too_large')
})

test('requires attributable identity, credit choice, and explicit versioned consent', () => {
  assert.throws(() => validateSessionRequest({
    files: [{ name: 'photo.png', size: png.length, type: 'image/png' }],
  }), (error) => error instanceof IntakeError && error.code === 'identity_required')

  assert.throws(() => validateSessionRequest({
    ...validSubmission,
    grantsMediaLicense: false,
    files: [{ name: 'photo.png', size: png.length, type: 'image/png' }],
  }), (error) => error instanceof IntakeError && error.code === 'consent_required')
})

test('fails closed for cross-origin requests and missing production configuration', async () => {
  const crossOrigin = await handleMediaIntake(new Request('https://example.com/api/media-intake/config', {
    headers: { origin: 'https://attacker.example' },
  }), {})
  assert.equal(crossOrigin.status, 403)

  const productionConfig = await handleMediaIntake(
    new Request('https://example.com/api/media-intake/config'),
    { MEDIA_INTAKE_ENABLED: 'true' },
  )
  const configPayload = await productionConfig.json()
  assert.equal(configPayload.enabled, false)

  const create = await handleMediaIntake(new Request('https://example.com/api/media-intake/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-media-invite': 'anything' },
    body: JSON.stringify({ files: [{ name: 'photo.png', size: png.length, type: 'image/png' }] }),
  }), { MEDIA_INTAKE_ENABLED: 'true' })
  assert.equal(create.status, 503)
})

test('production intake requires a live invite window and throttles attempts atomically', async () => {
  const env = makeEnv()
  delete env.MEDIA_INTAKE_MODE
  env.MEDIA_INTAKE_ENABLED = 'true'
  env.MEDIA_INTAKE_INVITE_HASH = await sha256Base64Url('correct-invite')
  env.MEDIA_INTAKE_INVITE_EXPIRES_AT = new Date(Date.now() + 60_000).toISOString()
  env.MEDIA_INTAKE_RATE_LIMIT_SECRET = 'test-only-rate-secret'
  env.MEDIA_INTAKE_MAX_FAILED_INVITE_ATTEMPTS_PER_HOUR = '2'
  env.MEDIA_INTAKE_MAX_SESSIONS_PER_IP_PER_HOUR = '2'

  const config = await handleMediaIntake(
    new Request('https://noasaitoshii.com/api/media-intake/config'),
    env,
  )
  assert.equal((await config.json()).enabled, true)

  const attempt = () => handleMediaIntake(new Request('https://noasaitoshii.com/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': '203.0.113.10',
      'content-type': 'application/json',
      'x-media-invite': 'wrong',
    },
    body: JSON.stringify({
      ...validSubmission,
      files: [{
        name: 'photo.png',
        size: png.length,
        type: 'image/png',
        lastModified: 1,
      }],
    }),
  }), env)

  assert.equal((await attempt()).status, 403)
  assert.equal((await attempt()).status, 403)
  assert.equal((await attempt()).status, 429)

  const acceptedSession = () => handleMediaIntake(new Request('https://noasaitoshii.com/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': '203.0.113.11',
      'content-type': 'application/json',
      'x-media-invite': 'correct-invite',
    },
    body: JSON.stringify({
      ...validSubmission,
      files: [{
        name: 'photo.png',
        size: png.length,
        type: 'image/png',
        lastModified: 1,
      }],
    }),
  }), env)
  assert.equal((await acceptedSession()).status, 201)
  assert.equal((await acceptedSession()).status, 201)
  assert.equal((await acceptedSession()).status, 429)

  env.MEDIA_INTAKE_INVITE_EXPIRES_AT = new Date(Date.now() - 1).toISOString()
  const expired = await handleMediaIntake(
    new Request('https://noasaitoshii.com/api/media-intake/config'),
    env,
  )
  assert.equal((await expired.json()).enabled, true)
})

test('production sessions use Secure cookies and malformed JSON fails closed', async () => {
  const env = makeEnv()
  delete env.MEDIA_INTAKE_MODE
  env.MEDIA_INTAKE_ENABLED = 'true'
  env.MEDIA_INTAKE_INVITE_HASH = await sha256Base64Url('correct-invite')
  env.MEDIA_INTAKE_INVITE_EXPIRES_AT = new Date(Date.now() + 60_000).toISOString()
  env.MEDIA_INTAKE_RATE_LIMIT_SECRET = 'test-only-rate-secret'

  const malformed = await handleMediaIntake(new Request('https://noasaitoshii.com/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': '203.0.113.20',
      'content-type': 'application/json',
      'x-media-invite': 'correct-invite',
    },
    body: '{not-json',
  }), env)
  assert.equal(malformed.status, 400)
  assert.equal((await malformed.json()).error, 'invalid_json')

  const created = await handleMediaIntake(new Request('https://noasaitoshii.com/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': '203.0.113.21',
      'content-type': 'application/json',
      'x-media-invite': 'correct-invite',
    },
    body: JSON.stringify({
      ...validSubmission,
      files: [{ name: 'photo.png', size: png.length, type: 'image/png', lastModified: 1 }],
    }),
  }), env)
  assert.equal(created.status, 201)
  assert.match(created.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Secure/)
})

test('personalized links are opaque, cookie-bound, attributable, and one-time when requested', async () => {
  const env = makeEnv()
  const invitationResponse = await handleMediaIntake(new Request(
    'http://localhost/api/media-intake/operator/invitations',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'one-time',
        expectedHandle: '@jimmy',
        eventLabel: 'Warehouse show',
        lifetimeDays: 7,
      }),
    },
  ), env)
  assert.equal(invitationResponse.status, 201)
  const createdInvitation = await invitationResponse.json()
  assert.match(createdInvitation.url, /^http:\/\/localhost\/send\/invite\//)
  assert.equal(createdInvitation.invitation.tokenHash, undefined)

  const accepted = await handleMediaIntake(new Request(createdInvitation.url), env)
  assert.equal(accepted.status, 303)
  assert.equal(accepted.headers.get('location'), '/send/')
  assert.match(accepted.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert.equal(accepted.headers.get('referrer-policy'), 'no-referrer')
  const invitationCookieHeader = accepted.headers.get('set-cookie').split(';', 1)[0]

  const config = await handleMediaIntake(new Request('http://localhost/api/media-intake/config', {
    headers: { cookie: invitationCookieHeader },
  }), env)
  const configPayload = await config.json()
  assert.equal(configPayload.invitation.expectedHandle, '@jimmy')
  assert.equal(configPayload.invitation.tokenHash, undefined)

  const submission = () => handleMediaIntake(new Request('http://localhost/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      cookie: invitationCookieHeader,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...validSubmission,
      handle: '@jimmy',
      files: [{ name: 'photo.png', size: png.length, type: 'image/png', lastModified: 1 }],
    }),
  }), env)
  assert.equal((await submission()).status, 201)
  assert.equal((await submission()).status, 403)

  const listing = await handleMediaIntake(
    new Request('http://localhost/api/media-intake/operator/sessions'),
    env,
  )
  const listed = (await listing.json()).sessions[0]
  assert.equal(listed.invitation.expectedHandle, '@jimmy')
  assert.equal(listed.consent.version, MEDIA_INTAKE_CONSENT.version)
  assert.equal(listed.creditPreference, 'social-handle')

  const controlPlane = await handleMediaIntake(
    new Request('http://localhost/api/media-intake/operator/control-plane'),
    env,
  )
  const controlPlanePayload = await controlPlane.json()
  assert.equal(controlPlanePayload.schemaVersion, 'show-media-control.v1')
  assert.equal(controlPlanePayload.invitations[0].status, 'used')
  assert.equal(controlPlanePayload.invitations[0].tokenHash, undefined)
  assert.equal(controlPlanePayload.submissions[0].id, listed.id)
  assert.equal(
    controlPlanePayload.submissions[0].reviewPath,
    `/send/review/?submission=${listed.id}`,
  )
  assert.equal(JSON.stringify(controlPlanePayload).includes('eligibleKey'), false)
  assert.equal(JSON.stringify(controlPlanePayload).includes('sourceIpHash'), false)
})

test('idempotent invitation commands replay one stable link after an ambiguous retry', async () => {
  const env = makeEnv()
  const requestBody = {
    kind: 'one-time',
    expectedHandle: '@retry-friend',
    eventLabel: 'Retry fixture',
    lifetimeDays: 7,
    requestId: 'notion-page:synthetic-retry-0001',
  }
  const create = () => handleMediaIntake(new Request(
    'http://localhost/api/media-intake/operator/invitations',
    {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(requestBody),
    },
  ), env)

  const first = await create()
  const firstPayload = await first.json()
  const replay = await create()
  const replayPayload = await replay.json()

  assert.equal(first.status, 201)
  assert.equal(replay.status, 200)
  assert.equal(replayPayload.replayed, true)
  assert.equal(replayPayload.invitation.id, firstPayload.invitation.id)
  assert.equal(replayPayload.url, firstPayload.url)

  const invitations = await handleMediaIntake(
    new Request('http://localhost/api/media-intake/operator/invitations'),
    env,
  )
  assert.equal((await invitations.json()).invitations.length, 1)
})

test('ledger prunes stale attempt and session metadata on daily maintenance', async () => {
  const storage = new MemoryStorage()
  await storage.put({
    'attempt:2026-01-01T00:stale': 2,
    'attempt:2026-07-28T12:fresh': 1,
    'session:stale': {
      id: 'stale',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      totalBytes: 1,
      files: [],
    },
    'session:fresh': {
      id: 'fresh',
      createdAt: '2026-07-28T12:00:00.000Z',
      updatedAt: '2026-07-28T12:00:00.000Z',
      totalBytes: 1,
      files: [],
    },
    'invitation:stale': {
      id: 'stale',
      expiresAt: '2026-01-02T00:00:00.000Z',
    },
    'invitation:fresh': {
      id: 'fresh',
      expiresAt: '2026-08-01T00:00:00.000Z',
    },
  })
  const ledger = new MediaIntakeLedger({ storage })
  await ledger.maybeCleanup(new Date('2026-07-28T15:00:00.000Z'))
  assert.equal(await storage.get('attempt:2026-01-01T00:stale'), undefined)
  assert.equal(await storage.get('session:stale'), undefined)
  assert.equal(await storage.get('invitation:stale'), undefined)
  assert.equal((await storage.get('invitation:fresh')).id, 'fresh')
  assert.equal(await storage.get('attempt:2026-07-28T12:fresh'), 1)
  assert.equal((await storage.get('session:fresh')).id, 'fresh')
})

test('uploads, verifies, promotes, lists, and downloads a valid photo', async () => {
  const env = makeEnv()
  const sessionResponse = await handleMediaIntake(new Request('http://127.0.0.1/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-media-invite': 'friends-preview',
    },
    body: JSON.stringify({
      ...validSubmission,
      note: 'front left',
      files: [{ name: 'Moment.PNG', size: png.length, type: 'image/png', lastModified: 123 }],
    }),
  }), env)
  assert.equal(sessionResponse.status, 201)
  assert.match(sessionResponse.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert.doesNotMatch(sessionResponse.headers.get('set-cookie'), /Secure/)
  const created = await sessionResponse.json()
  const file = created.session.files[0]
  const sessionCookie = sessionResponse.headers.get('set-cookie').split(';', 1)[0]
  assert.equal(created.uploadToken, undefined)

  const partResponse = await handleMediaIntake(new Request(
    `http://127.0.0.1/api/media-intake/sessions/${created.session.id}/files/${file.id}/parts/1`,
    {
      method: 'PUT',
      headers: {
        cookie: sessionCookie,
        'content-length': String(png.length),
        'content-type': 'application/octet-stream',
      },
      body: png,
    },
  ), env)
  assert.equal(partResponse.status, 200)

  const duplicateBytes = png.slice()
  duplicateBytes[0] = 0
  const duplicatePart = await handleMediaIntake(new Request(
    `http://127.0.0.1/api/media-intake/sessions/${created.session.id}/files/${file.id}/parts/1`,
    {
      method: 'PUT',
      headers: {
        cookie: sessionCookie,
        'content-length': String(duplicateBytes.length),
        'content-type': 'application/octet-stream',
      },
      body: duplicateBytes,
    },
  ), env)
  assert.equal(duplicatePart.status, 200)
  assert.equal((await duplicatePart.json()).alreadyUploaded, true)

  const completeResponse = await handleMediaIntake(new Request(
    `http://127.0.0.1/api/media-intake/sessions/${created.session.id}/files/${file.id}/complete`,
    {
      method: 'POST',
      headers: { cookie: sessionCookie },
    },
  ), env)
  assert.equal(completeResponse.status, 200)
  assert.equal((await completeResponse.json()).status, 'pending_review')

  const listing = await handleMediaIntake(
    new Request('http://127.0.0.1/api/media-intake/operator/sessions'),
    env,
  )
  const listed = await listing.json()
  assert.equal(listed.sessions[0].files[0].status, 'pending_review')

  const summary = await handleMediaIntake(
    new Request('http://127.0.0.1/api/media-intake/operator/summary'),
    env,
  )
  const summaryPayload = await summary.json()
  assert.equal(summaryPayload.counts.pending_review, 1)
  assert.equal(summaryPayload.attentionRequired, true)

  const blockedDownload = await handleMediaIntake(new Request(
    `http://127.0.0.1/api/media-intake/operator/sessions/${created.session.id}/files/${file.id}`,
  ), env)
  assert.equal(blockedDownload.status, 404)

  const approved = await handleMediaIntake(new Request(
    `http://127.0.0.1/api/media-intake/operator/sessions/${created.session.id}/files/${file.id}/decision`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve' }),
    },
  ), env)
  assert.equal(approved.status, 200)

  const download = await handleMediaIntake(new Request(
    `http://127.0.0.1/api/media-intake/operator/sessions/${created.session.id}/files/${file.id}`,
  ), env)
  assert.equal(download.status, 200)
  assert.equal(download.headers.get('content-type'), 'image/png')
  assert.equal(download.headers.get('x-media-source-etag'), 'eligible-mock-etag')
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), png)

  const delivered = await handleMediaIntake(new Request(
    `http://127.0.0.1/api/media-intake/operator/sessions/${created.session.id}/files/${file.id}/delivered`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storedName: '2026-07-28_moment.png',
        sha256: 'a'.repeat(64),
      }),
    },
  ), env)
  assert.equal(delivered.status, 200)
  const deliveredListing = await handleMediaIntake(
    new Request('http://127.0.0.1/api/media-intake/operator/sessions'),
    env,
  )
  assert.equal((await deliveredListing.json()).sessions[0].files[0].status, 'delivered')
})

test('holds a file whose content does not match its approved extension', async () => {
  const env = makeEnv()
  const sessionResponse = await handleMediaIntake(new Request('http://localhost/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-media-invite': 'friends-preview',
    },
    body: JSON.stringify({
      ...validSubmission,
      files: [{ name: 'not-really.jpg', size: mp4.length, type: 'image/jpeg', lastModified: 456 }],
    }),
  }), env)
  const created = await sessionResponse.json()
  const file = created.session.files[0]
  const sessionCookie = sessionResponse.headers.get('set-cookie').split(';', 1)[0]

  await handleMediaIntake(new Request(
    `http://localhost/api/media-intake/sessions/${created.session.id}/files/${file.id}/parts/1`,
    {
      method: 'PUT',
      headers: {
        cookie: sessionCookie,
        'content-length': String(mp4.length),
      },
      body: mp4,
    },
  ), env)
  const completed = await handleMediaIntake(new Request(
    `http://localhost/api/media-intake/sessions/${created.session.id}/files/${file.id}/complete`,
    {
      method: 'POST',
      headers: { cookie: sessionCookie },
    },
  ), env)

  assert.equal(completed.status, 422)
  const status = await handleMediaIntake(new Request(
    `http://localhost/api/media-intake/sessions/${created.session.id}`,
    { headers: { cookie: sessionCookie } },
  ), env)
  assert.equal((await status.json()).session.files[0].status, 'held')
})

test('recovers completion after eligible promotion succeeds but ready-state commit fails', async () => {
  const env = makeEnv({ failReadyOnce: true })
  const sessionResponse = await handleMediaIntake(new Request('http://localhost/api/media-intake/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-media-invite': 'friends-preview',
    },
    body: JSON.stringify({
      ...validSubmission,
      files: [{ name: 'recover.png', size: png.length, type: 'image/png', lastModified: 789 }],
    }),
  }), env)
  const created = await sessionResponse.json()
  const file = created.session.files[0]
  const sessionCookie = sessionResponse.headers.get('set-cookie').split(';', 1)[0]
  const partUrl = `http://localhost/api/media-intake/sessions/${created.session.id}/files/${file.id}/parts/1`
  const completeUrl = `http://localhost/api/media-intake/sessions/${created.session.id}/files/${file.id}/complete`

  const part = await handleMediaIntake(new Request(partUrl, {
    method: 'PUT',
    headers: {
      cookie: sessionCookie,
      'content-length': String(png.length),
    },
    body: png,
  }), env)
  assert.equal(part.status, 200)

  const interrupted = await handleMediaIntake(new Request(completeUrl, {
    method: 'POST',
    headers: { cookie: sessionCookie },
  }), env)
  assert.equal(interrupted.status, 503)

  const recovered = await handleMediaIntake(new Request(completeUrl, {
    method: 'POST',
    headers: { cookie: sessionCookie },
  }), env)
  assert.equal(recovered.status, 200)
  const recoveredPayload = await recovered.json()
  assert.equal(recoveredPayload.status, 'pending_review')
  assert.equal(recoveredPayload.recovered, true)
})
