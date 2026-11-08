import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeAccess, verifyAccessJwt } from './access.js'

const encoder = new TextEncoder()
const teamDomain = 'https://noa-test.cloudflareaccess.com'
const policyAudience = 'test-audience'
const keyId = 'test-key'

function encodeBase64Url(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function makeFixture(overrides = {}) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', kid: keyId, typ: 'JWT' }
  const payload = {
    iss: teamDomain,
    aud: policyAudience,
    exp: now + 300,
    nbf: now - 10,
    email: 'noa@example.com',
    ...overrides,
  }
  const encodedHeader = encodeBase64Url(JSON.stringify(header))
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    encoder.encode(signingInput),
  )

  return {
    now,
    payload,
    token: `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`,
    fetchImpl: async () => Response.json({
      keys: [{ ...publicJwk, kid: keyId, alg: 'RS256', use: 'sig' }],
    }),
  }
}

test('verifies a valid Cloudflare Access JWT', async () => {
  const fixture = await makeFixture()
  const payload = await verifyAccessJwt(fixture.token, {
    teamDomain,
    policyAudience,
    fetchImpl: fixture.fetchImpl,
    now: fixture.now,
  })

  assert.equal(payload.email, fixture.payload.email)
})

test('rejects a token for another Access application', async () => {
  const fixture = await makeFixture()

  await assert.rejects(() => verifyAccessJwt(fixture.token, {
    teamDomain,
    policyAudience: 'wrong-audience',
    fetchImpl: fixture.fetchImpl,
    now: fixture.now,
  }))
})

test('rejects an expired Access token', async () => {
  const fixture = await makeFixture({ exp: 1 })

  await assert.rejects(() => verifyAccessJwt(fixture.token, {
    teamDomain,
    policyAudience,
    fetchImpl: fixture.fetchImpl,
    now: fixture.now,
  }))
})

test('fails closed when Access identifiers are absent', async () => {
  const response = await authorizeAccess(new Request('https://example.com'), {
    ACCESS_AUTH_REQUIRED: 'true',
  })

  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('rejects a request without an Access assertion', async () => {
  const response = await authorizeAccess(new Request('https://example.com'), {
    ACCESS_AUTH_REQUIRED: 'true',
    TEAM_DOMAIN: teamDomain,
    POLICY_AUD: policyAudience,
  })

  assert.equal(response.status, 403)
})
