import {
  BOOKING_INQUIRY_MAX_BODY_BYTES,
  BOOKING_INQUIRY_PATH,
  BookingInquiryError,
  buildBookingInquiryQueuePacket,
  normalizeBookingInquiry,
} from './booking-inquiry-contract.js'

const encoder = new TextEncoder()
const LOCAL_MAX_RECORDS = 100
const localIdempotency = new Map()
const localMessages = []
const localRateLimits = new Map()

function response(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  })
}

function productionMode(env) {
  return env.BOOKING_INQUIRY_MODE !== 'local'
}

function exactSameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

async function readBoundedJson(request) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    throw new BookingInquiryError('unsupported_media_type', 'Content-Type must be application/json.', 415)
  }
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > BOOKING_INQUIRY_MAX_BODY_BYTES) {
    throw new BookingInquiryError('body_too_large', 'The request body is too large.', 413)
  }
  if (!request.body) throw new BookingInquiryError('malformed_json', 'A JSON request body is required.')

  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > BOOKING_INQUIRY_MAX_BODY_BYTES) {
        await reader.cancel()
        throw new BookingInquiryError('body_too_large', 'The request body is too large.', 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new BookingInquiryError('malformed_json', 'The JSON request body is malformed.')
  }
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function stableIdentity(inquiry) {
  const digest = await sha256Base64Url(JSON.stringify(inquiry))
  return {
    inquiryId: `inq_${digest.slice(0, 22)}`,
    idempotencyKey: `booking-v1:${digest}`,
  }
}

function clientKey(request) {
  return request.headers.get('cf-connecting-ip') ?? 'missing-client-address'
}

function boundedMapPut(map, key, value, limit = LOCAL_MAX_RECORDS) {
  if (!map.has(key) && map.size >= limit) {
    map.delete(map.keys().next().value)
  }
  map.set(key, value)
}

function localAdapters() {
  return {
    idempotency: {
      get: async (key) => localIdempotency.get(key) ?? null,
      put: async (key, value) => boundedMapPut(localIdempotency, key, structuredClone(value)),
    },
    queue: {
      send: async (message) => {
        if (localMessages.length >= LOCAL_MAX_RECORDS) localMessages.shift()
        localMessages.push(structuredClone(message))
      },
    },
    rateLimit: {
      consume: async ({ key, limit, windowSeconds }) => {
        const now = Date.now()
        const prior = localRateLimits.get(key)
        const current = !prior || prior.resetAt <= now
          ? { count: 0, resetAt: now + windowSeconds * 1000 }
          : prior
        current.count += 1
        boundedMapPut(localRateLimits, key, current)
        return current.count <= limit
      },
    },
    turnstile: { verify: async () => true },
  }
}

function defaultAdapters(env) {
  const local = productionMode(env) ? {} : localAdapters()
  return {
    idempotency: env.BOOKING_INQUIRY_IDEMPOTENCY
      ? {
          get: (key) => env.BOOKING_INQUIRY_IDEMPOTENCY.get(key, 'json'),
          put: (key, value) => env.BOOKING_INQUIRY_IDEMPOTENCY.put(
            key,
            JSON.stringify(value),
            { expirationTtl: 7 * 24 * 60 * 60 },
          ),
        }
      : local.idempotency ?? null,
    queue: env.BOOKING_INQUIRY_QUEUE
      ? { send: (message) => env.BOOKING_INQUIRY_QUEUE.send(message) }
      : local.queue ?? null,
    rateLimit: env.BOOKING_INQUIRY_RATE_LIMIT
      ? {
          consume: async ({ key }) => {
            const result = await env.BOOKING_INQUIRY_RATE_LIMIT.limit({ key })
            return result?.success === true
          },
        }
      : local.rateLimit ?? null,
    turnstile: env.TURNSTILE_SECRET_KEY
      ? {
          verify: async ({ token, request }) => {
            if (!token) return false
            const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
              method: 'POST',
              body: new URLSearchParams({
                secret: env.TURNSTILE_SECRET_KEY,
                response: token,
                remoteip: request.headers.get('cf-connecting-ip') ?? '',
              }),
            })
            if (!verification.ok) return false
            const result = await verification.json()
            return result.success === true
              && result.action === 'booking-inquiry'
              && result.hostname === new URL(request.url).hostname
          },
        }
      : local.turnstile ?? null,
  }
}

function requireAdapter(adapter, name, env) {
  if (!adapter && productionMode(env)) {
    throw new BookingInquiryError('not_configured', 'Booking intake is unavailable.', 503)
  }
  return adapter
}

export function createBookingInquiryHandler(injected = {}) {
  return async function handleBookingInquiry(request, env = {}) {
    const url = new URL(request.url)
    if (url.pathname !== BOOKING_INQUIRY_PATH) return null

    if (!exactSameOrigin(request)) {
      return response({ ok: false, error: { code: 'cross_origin', message: 'Cross-origin requests are not allowed.' } }, 403)
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          allow: 'POST, OPTIONS',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      })
    }
    if (request.method !== 'POST') {
      return response(
        { ok: false, error: { code: 'method_not_allowed', message: 'Only POST is supported.' } },
        405,
        { allow: 'POST, OPTIONS' },
      )
    }

    try {
      const raw = await readBoundedJson(request)

      // A filled honeypot receives an indistinguishable acceptance without
      // validation, verification, persistence, logging, or queue activity.
      if (typeof raw?.companyFax === 'string' && raw.companyFax.trim()) {
        return response({ ok: true, accepted: true }, 202)
      }

      const defaults = defaultAdapters(env)
      const adapters = { ...defaults, ...injected }
      const rateLimit = requireAdapter(adapters.rateLimit, 'rateLimit', env)
      const turnstile = requireAdapter(adapters.turnstile, 'turnstile', env)
      const idempotency = requireAdapter(adapters.idempotency, 'idempotency', env)
      const queue = requireAdapter(adapters.queue, 'queue', env)

      if (!rateLimit || !await rateLimit.consume({
        key: clientKey(request),
        limit: Number(env.BOOKING_INQUIRY_RATE_LIMIT_MAX) || 5,
        windowSeconds: 60 * 60,
      })) {
        throw new BookingInquiryError('rate_limited', 'Too many inquiries were submitted. Try again later.', 429)
      }
      if (!turnstile || !await turnstile.verify({
        token: typeof raw.turnstileToken === 'string' ? raw.turnstileToken : '',
        request,
      })) {
        throw new BookingInquiryError('challenge_failed', 'The security check could not be verified.', 403)
      }

      const inquiry = normalizeBookingInquiry(raw)
      const identity = await stableIdentity(inquiry)
      const prior = idempotency ? await idempotency.get(identity.idempotencyKey) : null
      if (
        prior?.inquiryId === identity.inquiryId
        && (prior.state === 'accepted' || prior.state == null)
      ) {
        return response({
          ok: true,
          accepted: true,
          duplicate: true,
          inquiry: { id: identity.inquiryId },
        }, 202)
      }

      if (!queue) throw new BookingInquiryError('not_configured', 'Booking intake is unavailable.', 503)
      const submittedAt = prior?.inquiryId === identity.inquiryId && prior?.submittedAt
        ? prior.submittedAt
        : new Date().toISOString()
      const packet = buildBookingInquiryQueuePacket(inquiry, {
        submissionId: identity.inquiryId,
        submittedAt,
      })
      if (idempotency) {
        await idempotency.put(identity.idempotencyKey, {
          inquiryId: identity.inquiryId,
          submittedAt,
          state: 'pending',
        })
      }
      await queue.send(packet)
      if (idempotency) {
        await idempotency.put(identity.idempotencyKey, {
          inquiryId: identity.inquiryId,
          submittedAt,
          acceptedAt: new Date().toISOString(),
          state: 'accepted',
        })
      }

      return response({
        ok: true,
        accepted: true,
        duplicate: false,
        inquiry: { id: identity.inquiryId },
      }, 202)
    } catch (error) {
      if (error instanceof BookingInquiryError) {
        return response({
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.fields ? { fields: error.fields } : {}),
          },
        }, error.status)
      }
      // Do not log the request or thrown adapter object: either can contain
      // contact data, Turnstile tokens, binding details, or queue payloads.
      return response({
        ok: false,
        error: { code: 'service_unavailable', message: 'Booking intake is temporarily unavailable.' },
      }, 503)
    }
  }
}

export const handleBookingInquiry = createBookingInquiryHandler()
