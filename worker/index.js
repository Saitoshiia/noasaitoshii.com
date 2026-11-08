import { authorizeAccess } from './access.js'
import { handleBookingInquiry } from './booking-inquiry.js'
import { handleMediaIntake } from './media-intake.js'

export { MediaIntakeLedger } from './media-intake-ledger.js'

const CHANNELS = ['noasaitoshii', 'noasaii']

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
      'x-content-type-options': 'nosniff',
      ...extraHeaders,
    },
  })

async function getTwitchToken(env) {
  const cache = caches.default
  const key = new Request('https://noasaitoshii.com/__internal/twitch-token')
  const cached = await cache.match(key)
  if (cached) return cached.text()

  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  })
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error('Twitch authentication failed')
  const payload = await response.json()
  const ttl = Math.max(60, Math.min(payload.expires_in - 60, 3600))
  await cache.put(key, new Response(payload.access_token, {
    headers: { 'cache-control': `max-age=${ttl}` },
  }))
  return payload.access_token
}

async function getLiveStatus(env) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return json({ configured: false, channels: {} }, 503)
  }

  const cache = caches.default
  const key = new Request('https://noasaitoshii.com/__internal/twitch-live')
  const cached = await cache.match(key)
  if (cached) return cached

  const token = await getTwitchToken(env)
  const query = new URLSearchParams()
  CHANNELS.forEach((channel) => query.append('user_login', channel))
  const response = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
    headers: {
      authorization: `Bearer ${token}`,
      'client-id': env.TWITCH_CLIENT_ID,
    },
  })
  if (!response.ok) throw new Error('Twitch status request failed')
  const payload = await response.json()
  const live = new Map(payload.data.map((stream) => [stream.user_login.toLowerCase(), stream]))
  const channels = Object.fromEntries(CHANNELS.map((channel) => {
    const stream = live.get(channel)
    return [channel, {
      live: Boolean(stream),
      title: stream?.title ?? null,
      game: stream?.game_name ?? null,
      startedAt: stream?.started_at ?? null,
    }]
  }))
  const result = json({ configured: true, channels })
  await cache.put(key, result.clone())
  return result
}

export default {
  async fetch(request, env) {
    const unauthorized = await authorizeAccess(request, env)
    if (unauthorized) return unauthorized

    const url = new URL(request.url)
    const mediaIntakeResponse = await handleMediaIntake(request, env)
    if (mediaIntakeResponse) return mediaIntakeResponse

    const bookingInquiryResponse = await handleBookingInquiry(request, env)
    if (bookingInquiryResponse) return bookingInquiryResponse

    if (url.pathname === '/api/live') {
      try {
        return await getLiveStatus(env)
      } catch {
        return json({ configured: true, channels: {}, error: 'status unavailable' }, 502)
      }
    }

    const response = await env.ASSETS.fetch(request)
    const headers = new Headers(response.headers)
    headers.set('x-content-type-options', 'nosniff')
    headers.set('referrer-policy', 'strict-origin-when-cross-origin')
    headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    headers.set('x-frame-options', 'SAMEORIGIN')
    headers.set('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src https://player.twitch.tv; frame-ancestors 'self'; base-uri 'self'; form-action 'self'")
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
}
