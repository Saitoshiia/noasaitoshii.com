const encoder = new TextEncoder()
const jwksCache = new Map()
const clockToleranceSeconds = 30
const jwksTtlMilliseconds = 60 * 60 * 1000

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)))
}

function audienceMatches(audience, expectedAudience) {
  return typeof audience === 'string'
    ? audience === expectedAudience
    : Array.isArray(audience) && audience.includes(expectedAudience)
}

async function getSigningKey(teamDomain, keyId, fetchImpl) {
  const cached = jwksCache.get(teamDomain)
  let keys = cached?.expiresAt > Date.now() ? cached.keys : null

  if (!keys) {
    const response = await fetchImpl(`${teamDomain}/cdn-cgi/access/certs`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error('Unable to load Access signing keys')

    const payload = await response.json()
    if (!Array.isArray(payload.keys)) throw new Error('Invalid Access signing keys')

    keys = payload.keys
    jwksCache.set(teamDomain, {
      keys,
      expiresAt: Date.now() + jwksTtlMilliseconds,
    })
  }

  const key = keys.find((candidate) =>
    candidate.kid === keyId
    && candidate.kty === 'RSA'
    && candidate.alg === 'RS256'
    && candidate.use === 'sig')

  if (!key) throw new Error('Access signing key not found')
  return key
}

export async function verifyAccessJwt(token, {
  teamDomain,
  policyAudience,
  fetchImpl = fetch,
  now = Math.floor(Date.now() / 1000),
}) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed Access token')

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = decodeJsonPart(encodedHeader)
  const payload = decodeJsonPart(encodedPayload)

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Unsupported Access token')
  }

  const jwk = await getSigningKey(teamDomain, header.kid, fetchImpl)
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const signatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`),
  )

  if (!signatureValid) throw new Error('Invalid Access token signature')
  if (payload.iss !== teamDomain) throw new Error('Invalid Access token issuer')
  if (!audienceMatches(payload.aud, policyAudience)) {
    throw new Error('Invalid Access token audience')
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= now - clockToleranceSeconds) {
    throw new Error('Expired Access token')
  }
  if (Number.isFinite(payload.nbf) && payload.nbf > now + clockToleranceSeconds) {
    throw new Error('Access token is not active')
  }

  return payload
}

export async function authorizeAccess(request, env) {
  if (env.ACCESS_AUTH_REQUIRED !== 'true') return null

  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
    return new Response('Private preview is not configured.', {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
    })
  }

  const token = request.headers.get('cf-access-jwt-assertion')
  if (!token) {
    return new Response('Cloudflare Access authentication required.', {
      status: 403,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
    })
  }

  try {
    await verifyAccessJwt(token, {
      teamDomain: env.TEAM_DOMAIN.replace(/\/+$/, ''),
      policyAudience: env.POLICY_AUD,
    })
    return null
  } catch {
    return new Response('Cloudflare Access authentication required.', {
      status: 403,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
    })
  }
}
