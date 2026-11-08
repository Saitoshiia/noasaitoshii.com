import {
  cleanText,
  IntakeError,
  MEDIA_INTAKE_CONSENT,
  MEDIA_INTAKE_DEFAULTS,
  safeDownloadName,
  safeStorageSegment,
  signatureMatchesExtension,
  sniffMediaType,
  validateSessionRequest,
} from './media-intake-contract.js'

const encoder = new TextEncoder()

const SESSION_COOKIE = 'noa_media_upload'
const INVITATION_COOKIE = 'noa_media_invitation'
const MEDIA_CONTROL_PLANE_SCHEMA_VERSION = 'show-media-control.v1'

const apiJson = (data, status = 200, extraHeaders = {}) => Response.json(data, {
  status,
  headers: {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  },
})

async function readJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new IntakeError('invalid_json', 'A JSON request body is required.', 400)
  }
  try {
    return await request.json()
  } catch {
    throw new IntakeError('invalid_json', 'The JSON request body is malformed.', 400)
  }
}

function isLoopback(url) {
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]'
}

function isLocalMode(request, env) {
  return env.MEDIA_INTAKE_MODE === 'local' && isLoopback(new URL(request.url))
}

function intakeEnabled(request, env) {
  if (isLocalMode(request, env)) return true
  const turnstileReady = env.MEDIA_INTAKE_REQUIRE_TURNSTILE !== 'true'
    || Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY)
  return env.MEDIA_INTAKE_ENABLED === 'true'
    && Boolean(env.MEDIA_QUARANTINE && env.MEDIA_ELIGIBLE && env.MEDIA_INTAKE_LEDGER)
    && Boolean(env.MEDIA_INTAKE_RATE_LIMIT_SECRET)
    && turnstileReady
}

function sameOrigin(request) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function invitationToken(request, env, requestId) {
  if (!requestId) return crypto.randomUUID() + crypto.randomUUID()
  const secret = isLocalMode(request, env)
    ? env.MEDIA_INTAKE_INVITATION_SIGNING_SECRET || 'local-media-intake-fixture-secret'
    : env.MEDIA_INTAKE_INVITATION_SIGNING_SECRET
  if (!secret) {
    throw new IntakeError(
      'invitation_idempotency_not_configured',
      'Idempotent invitation generation is not configured.',
      503,
    )
  }
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`show-media-invitation:${requestId}`))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function timingSafeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

async function readPersonalInvitation(request, env) {
  const cookie = readCookie(request, INVITATION_COOKIE)
  const separator = cookie.indexOf('.')
  if (separator < 1) return null
  const id = cookie.slice(0, separator)
  const token = cookie.slice(separator + 1)
  let invitation
  try {
    invitation = (await ledgerJson(env, `/invitations/${encodeURIComponent(id)}`)).invitation
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
  const active = !invitation.revokedAt
    && Date.parse(invitation.expiresAt) > Date.now()
    && invitation.useCount < invitation.maxUses
    && timingSafeEqual(await sha256(token), invitation.tokenHash)
  return active ? { invitation, tokenHash: invitation.tokenHash } : null
}

async function inviteAllowed(request, env) {
  const personalized = await readPersonalInvitation(request, env)
  if (personalized) return { type: 'personalized', ...personalized }
  if (isLocalMode(request, env)) {
    return request.headers.get('x-media-invite') === 'friends-preview'
      ? { type: 'shared' }
      : null
  }
  if (!env.MEDIA_INTAKE_INVITE_HASH || !env.MEDIA_INTAKE_INVITE_EXPIRES_AT) return false
  const expiresAt = Date.parse(env.MEDIA_INTAKE_INVITE_EXPIRES_AT)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false
  const supplied = request.headers.get('x-media-invite') ?? ''
  return timingSafeEqual(await sha256(supplied), env.MEDIA_INTAKE_INVITE_HASH)
    ? { type: 'shared' }
    : null
}

async function turnstileAllowed(request, env, token) {
  if (env.MEDIA_INTAKE_REQUIRE_TURNSTILE !== 'true') return true
  if (!env.TURNSTILE_SECRET_KEY || !token) return false

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: request.headers.get('cf-connecting-ip') ?? '',
    }),
  })
  if (!response.ok) return false
  const result = await response.json()
  const expectedHostname = new URL(request.url).hostname
  return result.success === true
    && result.hostname === expectedHostname
    && result.action === 'media-intake'
}

function ledger(env) {
  if (!env.MEDIA_INTAKE_LEDGER) throw new IntakeError('not_configured', 'Upload storage is not configured.', 503)
  const id = env.MEDIA_INTAKE_LEDGER.idFromName('show-media-intake')
  return env.MEDIA_INTAKE_LEDGER.get(id)
}

async function ledgerJson(env, path, init = {}) {
  const response = await ledger(env).fetch(`https://ledger.internal${path}`, init)
  const payload = await response.json()
  if (!response.ok) {
    throw new IntakeError(payload.error ?? 'ledger_error', payload.message ?? 'Upload state is unavailable.', response.status)
  }
  return payload
}

async function readSession(env, sessionId) {
  const payload = await ledgerJson(env, `/sessions/${encodeURIComponent(sessionId)}`)
  return payload.session
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? ''
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (separator < 0) continue
    if (pair.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(pair.slice(separator + 1).trim())
      } catch {
        return ''
      }
    }
  }
  return ''
}

function sessionCookie(request, env, sessionId, token) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(`${sessionId}.${token}`)}`,
    `Path=/api/media-intake/sessions/${sessionId}`,
    `Max-Age=${MEDIA_INTAKE_DEFAULTS.sessionLifetimeSeconds}`,
    'HttpOnly',
    'SameSite=Strict',
  ]
  if (!isLocalMode(request, env)) attributes.push('Secure')
  return attributes.join('; ')
}

function invitationCookie(request, env, id, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))
  const attributes = [
    `${INVITATION_COOKIE}=${encodeURIComponent(`${id}.${token}`)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
  ]
  if (!isLocalMode(request, env)) attributes.push('Secure')
  return attributes.join('; ')
}

async function authenticateSession(request, env, sessionId) {
  const cookie = readCookie(request, SESSION_COOKIE)
  const separator = cookie.indexOf('.')
  if (separator < 1 || cookie.slice(0, separator) !== sessionId) {
    throw new IntakeError('unauthorized', 'This upload session is not authorized.', 403)
  }
  const token = cookie.slice(separator + 1)
  const session = await readSession(env, sessionId)
  if (!timingSafeEqual(await sha256(token), session.tokenHash)) {
    throw new IntakeError('unauthorized', 'This upload session is not authorized.', 403)
  }
  if (Date.parse(session.expiresAt) <= Date.now()) {
    throw new IntakeError('session_expired', 'This upload session has expired.', 410)
  }
  return { session, tokenHash: session.tokenHash }
}

async function rateLimitSessionAttempt(request, env, bucket, maxAttempts) {
  if (isLocalMode(request, env)) return
  const address = request.headers.get('cf-connecting-ip')
  if (!address || !env.MEDIA_INTAKE_RATE_LIMIT_SECRET) {
    throw new IntakeError('rate_limit_not_configured', 'Upload throttling is not configured.', 503)
  }
  const window = new Date().toISOString().slice(0, 13)
  const key = await sha256(`${env.MEDIA_INTAKE_RATE_LIMIT_SECRET}:${bucket}:${address}`)
  await ledgerJson(env, '/attempt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key,
      window,
      maxAttempts,
    }),
  })
}

function requireBindings(env) {
  if (!env.MEDIA_QUARANTINE || !env.MEDIA_ELIGIBLE || !env.MEDIA_INTAKE_LEDGER) {
    throw new IntakeError('not_configured', 'Upload storage is not configured.', 503)
  }
}

function publicSession(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    files: session.files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      bytes: file.bytes,
      browserType: file.browserType,
      lastModified: file.lastModified ?? 0,
      status: file.status,
      detectedType: file.detectedType ?? null,
      message: file.message ?? null,
      uploadedParts: file.parts?.map((part) => part.partNumber) ?? [],
    })),
    eventLabel: session.eventLabel ?? null,
  }
}

async function createSession(request, env) {
  requireBindings(env)
  if (!intakeEnabled(request, env)) {
    throw new IntakeError('closed', 'Media intake is currently closed.', 503)
  }
  const invitationAccess = await inviteAllowed(request, env)
  if (!invitationAccess) {
    await rateLimitSessionAttempt(
      request,
      env,
      'failed-invite',
      Number(env.MEDIA_INTAKE_MAX_FAILED_INVITE_ATTEMPTS_PER_HOUR)
        || MEDIA_INTAKE_DEFAULTS.maxFailedInviteAttemptsPerHour,
    )
    throw new IntakeError('invalid_invite', 'This upload link or invite code is not active.', 403)
  }
  await rateLimitSessionAttempt(
    request,
    env,
    'session',
    Number(env.MEDIA_INTAKE_MAX_SESSIONS_PER_IP_PER_HOUR)
      || MEDIA_INTAKE_DEFAULTS.maxSessionsPerIpPerHour,
  )

  const rawPayload = await readJson(request)
  if (!await turnstileAllowed(request, env, rawPayload.turnstileToken)) {
    throw new IntakeError('challenge_failed', 'The security check could not be verified.', 403)
  }
  const payload = validateSessionRequest(rawPayload)
  const now = new Date()
  const sessionId = crypto.randomUUID()
  const token = crypto.randomUUID() + crypto.randomUUID()
  const tokenHash = await sha256(token)
  const day = now.toISOString().slice(0, 10)
  const createdUploads = []

  try {
    const files = []
    for (const file of payload.files) {
      const id = crypto.randomUUID()
      const key = `quarantine/${day}/${safeStorageSegment(sessionId)}/${safeStorageSegment(id)}${file.extension}`
      const upload = await env.MEDIA_QUARANTINE.createMultipartUpload(key, {
        httpMetadata: { contentType: file.browserType || 'application/octet-stream' },
        customMetadata: {
          originalName: file.originalName,
          sessionId,
          fileId: id,
        },
      })
      createdUploads.push(upload)
      files.push({
        id,
        originalName: file.originalName,
        extension: file.extension,
        browserType: file.browserType,
        lastModified: file.lastModified,
        bytes: file.bytes,
        key,
        uploadId: upload.uploadId,
        parts: [],
        status: 'authorized',
      })
    }

    const session = {
      id: sessionId,
      tokenHash,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + MEDIA_INTAKE_DEFAULTS.sessionLifetimeSeconds * 1000).toISOString(),
      contributorName: payload.contributorName,
      handle: payload.handle,
      email: payload.email,
      creditPreference: payload.creditPreference,
      note: payload.note,
      consent: {
        ...payload.consent,
        acceptedAt: now.toISOString(),
        sourceIpHash: request.headers.get('cf-connecting-ip') && env.MEDIA_INTAKE_RATE_LIMIT_SECRET
          ? await sha256(`${env.MEDIA_INTAKE_RATE_LIMIT_SECRET}:consent:${request.headers.get('cf-connecting-ip')}`)
          : null,
      },
      invitation: invitationAccess.type === 'personalized'
        ? {
            id: invitationAccess.invitation.id,
            kind: invitationAccess.invitation.kind,
            expectedHandle: invitationAccess.invitation.expectedHandle,
            expectedName: invitationAccess.invitation.expectedName,
            eventLabel: invitationAccess.invitation.eventLabel,
            identityMismatch: Boolean(
              invitationAccess.invitation.expectedHandle
              && payload.handle
              && invitationAccess.invitation.expectedHandle.toLowerCase() !== payload.handle.toLowerCase(),
            ),
          }
        : { kind: 'shared' },
      eventLabel: invitationAccess.type === 'personalized'
        ? invitationAccess.invitation.eventLabel
        : isLocalMode(request, env)
          ? 'Local pilot fixture'
          : String(env.MEDIA_INTAKE_EVENT_LABEL ?? '').slice(0, 120),
      totalBytes: payload.totalBytes,
      files,
    }

    await ledgerJson(env, '/reserve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        day,
        totalBytes: payload.totalBytes,
        maxDailyBytes: Number(env.MEDIA_INTAKE_MAX_DAILY_BYTES) || MEDIA_INTAKE_DEFAULTS.maxDailyBytes,
        invitation: invitationAccess.type === 'personalized'
          ? {
              id: invitationAccess.invitation.id,
              tokenHash: invitationAccess.tokenHash,
            }
          : null,
        session,
      }),
    })

    return apiJson({
      session: publicSession(session),
      partBytes: MEDIA_INTAKE_DEFAULTS.partBytes,
    }, 201, {
      'set-cookie': sessionCookie(request, env, sessionId, token),
    })
  } catch (error) {
    await Promise.allSettled(createdUploads.map((upload) => upload.abort()))
    throw error
  }
}

async function uploadPart(request, env, sessionId, fileId, rawPartNumber) {
  requireBindings(env)
  const { session, tokenHash } = await authenticateSession(request, env, sessionId)
  const file = session.files.find((candidate) => candidate.id === fileId)
  if (!file) throw new IntakeError('file_not_found', 'Upload file not found.', 404)
  if (!['authorized', 'uploading'].includes(file.status)) {
    throw new IntakeError('invalid_state', 'This file no longer accepts upload parts.', 409)
  }

  const partNumber = Number(rawPartNumber)
  const expectedParts = Math.ceil(file.bytes / MEDIA_INTAKE_DEFAULTS.partBytes)
  if (!Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > expectedParts) {
    throw new IntakeError('invalid_part', 'Upload part number is invalid.')
  }
  const existingPart = file.parts.find((part) => part.partNumber === partNumber)
  if (existingPart) {
    await request.body?.cancel()
    return apiJson({
      partNumber,
      etag: existingPart.etag,
      alreadyUploaded: true,
    })
  }

  const expectedBytes = Math.min(
    MEDIA_INTAKE_DEFAULTS.partBytes,
    file.bytes - ((partNumber - 1) * MEDIA_INTAKE_DEFAULTS.partBytes),
  )
  const contentLength = Number(request.headers.get('content-length'))
  if (contentLength !== expectedBytes || !request.body) {
    throw new IntakeError('invalid_part_size', 'Upload part has the wrong size.', 400)
  }

  const upload = env.MEDIA_QUARANTINE.resumeMultipartUpload(file.key, file.uploadId)
  const uploaded = await upload.uploadPart(partNumber, request.body)
  await ledgerJson(env, `/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tokenHash,
      fileId,
      operation: 'part',
      part: { partNumber: uploaded.partNumber, etag: uploaded.etag, bytes: expectedBytes },
    }),
  })
  return apiJson({ partNumber: uploaded.partNumber, etag: uploaded.etag })
}

async function updateFileStatus(env, sessionId, tokenHash, fileId, status, details = {}) {
  return ledgerJson(env, `/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tokenHash, fileId, operation: 'status', status, ...details }),
  })
}

async function completeFile(request, env, sessionId, fileId) {
  requireBindings(env)
  const { session, tokenHash } = await authenticateSession(request, env, sessionId)
  const file = session.files.find((candidate) => candidate.id === fileId)
  if (!file) throw new IntakeError('file_not_found', 'Upload file not found.', 404)
  if (!['authorized', 'uploading', 'completing', 'validating'].includes(file.status)) {
    throw new IntakeError('invalid_state', 'This file cannot be completed from its current state.', 409)
  }

  const expectedParts = Math.ceil(file.bytes / MEDIA_INTAKE_DEFAULTS.partBytes)
  if (file.parts.length !== expectedParts) {
    throw new IntakeError('missing_parts', 'Some upload parts are still missing.', 409)
  }

  if (['authorized', 'uploading'].includes(file.status)) {
    await updateFileStatus(env, sessionId, tokenHash, fileId, 'completing')
  }

  let quarantineObject = await env.MEDIA_QUARANTINE.get(file.key)
  if (!quarantineObject && file.status !== 'validating') {
    const upload = env.MEDIA_QUARANTINE.resumeMultipartUpload(file.key, file.uploadId)
    await upload.complete(file.parts.map(({ partNumber, etag }) => ({ partNumber, etag })))
    quarantineObject = await env.MEDIA_QUARANTINE.get(file.key)
  }
  await updateFileStatus(env, sessionId, tokenHash, fileId, 'validating')

  const eligibleKey = file.key.replace(/^quarantine\//, 'eligible/')
  const existingEligible = await env.MEDIA_ELIGIBLE.get(eligibleKey, {
    range: { offset: 0, length: MEDIA_INTAKE_DEFAULTS.sniffBytes },
  })
  if (existingEligible) {
    const detected = sniffMediaType(await existingEligible.arrayBuffer())
    if (!signatureMatchesExtension(file.extension, detected)) {
      throw new IntakeError('eligible_mismatch', 'Recovered eligible media failed verification.', 500)
    }
    await env.MEDIA_QUARANTINE.delete(file.key)
    await updateFileStatus(env, sessionId, tokenHash, fileId, 'pending_review', {
      detectedType: detected.mime,
      eligibleKey,
      eligibleEtag: existingEligible.etag,
      completedAt: new Date().toISOString(),
    })
    return apiJson({ status: 'pending_review', detectedType: detected.mime, recovered: true })
  }

  const head = await env.MEDIA_QUARANTINE.get(file.key, {
    range: { offset: 0, length: MEDIA_INTAKE_DEFAULTS.sniffBytes },
  })
  if (!head) throw new IntakeError('missing_object', 'Uploaded media could not be read.', 500)
  const detected = sniffMediaType(await head.arrayBuffer())
  if (!signatureMatchesExtension(file.extension, detected)) {
    await updateFileStatus(env, sessionId, tokenHash, fileId, 'held', {
      detectedType: detected?.mime ?? null,
      message: 'The file contents did not match an approved photo or video format.',
      completedAt: new Date().toISOString(),
    })
    return apiJson({ status: 'held', message: 'This file could not be verified as an approved media format.' }, 422)
  }

  if (!quarantineObject?.body) {
    quarantineObject = await env.MEDIA_QUARANTINE.get(file.key)
  }
  if (!quarantineObject?.body) throw new IntakeError('missing_object', 'Uploaded media could not be promoted.', 500)
  const eligible = await env.MEDIA_ELIGIBLE.put(eligibleKey, quarantineObject.body, {
    httpMetadata: { contentType: detected.mime },
    customMetadata: {
      originalName: file.originalName,
      sessionId,
      fileId,
      verifiedType: detected.mime,
    },
  })
  await env.MEDIA_QUARANTINE.delete(file.key)
  await updateFileStatus(env, sessionId, tokenHash, fileId, 'pending_review', {
    detectedType: detected.mime,
    eligibleKey,
    eligibleEtag: eligible.etag,
    completedAt: new Date().toISOString(),
  })
  return apiJson({ status: 'pending_review', detectedType: detected.mime })
}

async function sessionStatus(request, env, sessionId) {
  const { session } = await authenticateSession(request, env, sessionId)
  return apiJson({ session: publicSession(session) })
}

async function operatorAllowed(request, env) {
  if (isLocalMode(request, env)) return true
  if (!env.MEDIA_INTAKE_OPERATOR_HASH) return false
  const supplied = request.headers.get('x-media-operator') ?? ''
  return timingSafeEqual(await sha256(supplied), env.MEDIA_INTAKE_OPERATOR_HASH)
}

async function operatorSessions(request, env) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const payload = await ledgerJson(env, '/operator/sessions')
  return apiJson(payload)
}

function publicInvitation(invitation) {
  const status = invitation.revokedAt
    ? 'revoked'
    : invitation.useCount >= invitation.maxUses
      ? 'used'
      : Date.parse(invitation.expiresAt) <= Date.now()
        ? 'expired'
        : 'active'
  return {
    id: invitation.id,
    kind: invitation.kind,
    expectedHandle: invitation.expectedHandle,
    expectedName: invitation.expectedName,
    eventLabel: invitation.eventLabel,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    maxUses: invitation.maxUses,
    useCount: invitation.useCount,
    lastUsedAt: invitation.lastUsedAt ?? null,
    revokedAt: invitation.revokedAt ?? null,
    status,
  }
}

function publicOperatorSession(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
    contributorName: session.contributorName,
    handle: session.handle,
    email: session.email,
    creditPreference: session.creditPreference,
    note: session.note,
    eventLabel: session.eventLabel,
    invitation: session.invitation
      ? {
          id: session.invitation.id,
          kind: session.invitation.kind,
          expectedHandle: session.invitation.expectedHandle,
          expectedName: session.invitation.expectedName,
          identityMismatch: session.invitation.identityMismatch === true,
        }
      : null,
    consent: session.consent
      ? {
          version: session.consent.version,
          acceptedAt: session.consent.acceptedAt,
          confirmsAuthority: session.consent.confirmsAuthority === true,
          grantsMediaLicense: session.consent.grantsMediaLicense === true,
        }
      : null,
    totalBytes: session.totalBytes,
    files: session.files,
    reviewPath: `/send/review/?submission=${encodeURIComponent(session.id)}`,
  }
}

async function operatorCreateInvitation(request, env) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const payload = await readJson(request)
  const kind = payload.kind === 'trusted' ? 'trusted' : payload.kind === 'one-time' ? 'one-time' : null
  if (!kind) throw new IntakeError('invalid_invitation_kind', 'Choose a trusted or one-time invitation.')
  const expectedHandle = cleanText(payload.expectedHandle, 'handle')
  const expectedName = cleanText(payload.expectedName, 'contributorName')
  if (!expectedHandle && !expectedName) {
    throw new IntakeError('invitation_identity_required', 'Add the recipient’s name or social handle.')
  }
  const eventLabel = cleanText(payload.eventLabel, 'eventLabel')
  const lifetimeDays = Number(payload.lifetimeDays)
  if (!Number.isSafeInteger(lifetimeDays) || lifetimeDays < 1 || lifetimeDays > (kind === 'trusted' ? 365 : 30)) {
    throw new IntakeError('invalid_invitation_lifetime', 'The invitation lifetime is outside the allowed range.')
  }
  const requestId = payload.requestId == null ? null : String(payload.requestId).trim()
  if (requestId && !/^[a-zA-Z0-9:_-]{8,200}$/.test(requestId)) {
    throw new IntakeError('invalid_invitation_request_id', 'Invitation request ID is invalid.')
  }

  const id = crypto.randomUUID()
  const token = await invitationToken(request, env, requestId)
  const now = new Date()
  const invitation = {
    id,
    tokenHash: await sha256(token),
    kind,
    expectedHandle,
    expectedName,
    eventLabel,
    lifetimeDays,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetimeDays * 24 * 60 * 60 * 1000).toISOString(),
    maxUses: kind === 'trusted' ? 100 : 1,
    useCount: 0,
    revokedAt: null,
    requestId,
  }
  const result = await ledgerJson(env, '/invitations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(invitation),
  })
  const persistedInvitation = result.invitation
  return apiJson({
    invitation: publicInvitation(persistedInvitation),
    url: `${new URL(request.url).origin}/send/invite/${encodeURIComponent(`${persistedInvitation.id}.${token}`)}`,
    replayed: result.replayed === true,
  }, result.replayed ? 200 : 201)
}

async function operatorInvitations(request, env) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const payload = await ledgerJson(env, '/operator/invitations')
  return apiJson({ invitations: payload.invitations.map(publicInvitation) })
}

async function operatorRevokeInvitation(request, env, invitationId) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const payload = await ledgerJson(env, `/invitations/${encodeURIComponent(invitationId)}/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  return apiJson({ invitation: publicInvitation(payload.invitation) })
}

async function acceptInvitation(request, env, encodedCredential) {
  requireBindings(env)
  let credential
  try {
    credential = decodeURIComponent(encodedCredential)
  } catch {
    throw new IntakeError('invalid_invite', 'This personalized upload link is invalid.', 403)
  }
  const separator = credential.indexOf('.')
  if (separator < 1) throw new IntakeError('invalid_invite', 'This personalized upload link is invalid.', 403)
  const id = credential.slice(0, separator)
  const token = credential.slice(separator + 1)
  const invitation = (await ledgerJson(env, `/invitations/${encodeURIComponent(id)}`)).invitation
  const active = !invitation.revokedAt
    && Date.parse(invitation.expiresAt) > Date.now()
    && invitation.useCount < invitation.maxUses
    && timingSafeEqual(await sha256(token), invitation.tokenHash)
  if (!active) throw new IntakeError('invalid_invite', 'This personalized upload link is no longer active.', 403)
  return new Response(null, {
    status: 303,
    headers: {
      location: '/send/',
      'set-cookie': invitationCookie(request, env, id, token, invitation.expiresAt),
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  })
}

async function operatorDecision(request, env, sessionId, fileId) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const payload = await readJson(request)
  if (!['approve', 'reject'].includes(payload.decision)) {
    throw new IntakeError('invalid_decision', 'Choose approve or reject.')
  }
  const session = await readSession(env, sessionId)
  const file = session.files.find((candidate) => candidate.id === fileId)
  if (!file || file.status !== 'pending_review') {
    throw new IntakeError('file_not_pending', 'This file is not awaiting review.', 409)
  }
  const status = payload.decision === 'approve' ? 'ready' : 'rejected'
  await updateFileStatus(env, sessionId, session.tokenHash, fileId, status, {
    reviewedAt: new Date().toISOString(),
    reviewDecision: payload.decision,
    message: payload.decision === 'reject' ? 'Rejected by Noa during private review.' : null,
  })
  return apiJson({ status })
}

async function operatorSummary(request, env) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const payload = await ledgerJson(env, '/operator/summary')
  return apiJson(payload)
}

async function operatorControlPlane(request, env) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const [sessionPayload, invitationPayload, summary] = await Promise.all([
    ledgerJson(env, '/operator/sessions'),
    ledgerJson(env, '/operator/invitations'),
    ledgerJson(env, '/operator/summary'),
  ])
  return apiJson({
    schemaVersion: MEDIA_CONTROL_PLANE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    summary,
    invitations: invitationPayload.invitations.map(publicInvitation),
    submissions: sessionPayload.sessions.map(publicOperatorSession),
  })
}

async function operatorDownload(request, env, sessionId, fileId) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const session = await readSession(env, sessionId)
  const file = session.files.find((candidate) => candidate.id === fileId)
  if (!file || file.status !== 'ready' || !file.eligibleKey) {
    throw new IntakeError('file_not_ready', 'This file is not ready for download.', 404)
  }
  const object = await env.MEDIA_ELIGIBLE.get(file.eligibleKey)
  if (!object?.body) throw new IntakeError('missing_object', 'The approved file is unavailable.', 404)
  return new Response(object.body, {
    headers: {
      'cache-control': 'private, no-store',
      'content-disposition': `attachment; filename="${safeDownloadName(file.originalName)}"`,
      'content-length': String(object.size),
      'content-type': file.detectedType || 'application/octet-stream',
      'x-media-source-etag': file.eligibleEtag ?? '',
      'x-content-type-options': 'nosniff',
    },
  })
}

async function operatorAcknowledgeDelivery(request, env, sessionId, fileId) {
  requireBindings(env)
  if (!await operatorAllowed(request, env)) {
    throw new IntakeError('unauthorized', 'Operator authorization is required.', 403)
  }
  const session = await readSession(env, sessionId)
  const file = session.files.find((candidate) => candidate.id === fileId)
  if (!file || file.status !== 'ready') {
    throw new IntakeError('file_not_ready', 'This file is not awaiting delivery.', 409)
  }
  const payload = await readJson(request)
  const deliveredName = safeDownloadName(payload?.storedName ?? '')
  const deliveredSha256 = String(payload?.sha256 ?? '').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(deliveredSha256)) {
    throw new IntakeError('invalid_checksum', 'Delivery checksum is invalid.')
  }
  await updateFileStatus(env, sessionId, session.tokenHash, fileId, 'delivered', {
    deliveredAt: new Date().toISOString(),
    deliveredName,
    deliveredSha256,
    message: null,
  })
  return apiJson({ status: 'delivered' })
}

export async function handleMediaIntake(request, env) {
  const url = new URL(request.url)
  const invitationMatch = url.pathname.match(/^\/send\/invite\/([^/]+)\/?$/)
  if (!url.pathname.startsWith('/api/media-intake') && !invitationMatch) return null
  if (!sameOrigin(request)) return apiJson({ error: 'cross_origin', message: 'Cross-origin uploads are not allowed.' }, 403)

  try {
    if (request.method === 'GET' && invitationMatch) {
      return await acceptInvitation(request, env, invitationMatch[1])
    }
    if (request.method === 'GET' && url.pathname === '/api/media-intake/config') {
      const personalAccess = await readPersonalInvitation(request, env)
      return apiJson({
        enabled: intakeEnabled(request, env),
        local: isLocalMode(request, env),
        maxFiles: MEDIA_INTAKE_DEFAULTS.maxFilesPerSession,
        maxFileBytes: MEDIA_INTAKE_DEFAULTS.maxFileBytes,
        maxSessionBytes: MEDIA_INTAKE_DEFAULTS.maxSessionBytes,
        partBytes: MEDIA_INTAKE_DEFAULTS.partBytes,
        inviteExpiresAt: isLocalMode(request, env)
          ? null
          : env.MEDIA_INTAKE_INVITE_EXPIRES_AT ?? null,
        eventLabel: isLocalMode(request, env)
          ? personalAccess?.invitation.eventLabel || 'Local pilot fixture'
          : personalAccess?.invitation.eventLabel || env.MEDIA_INTAKE_EVENT_LABEL || null,
        invitation: personalAccess
          ? publicInvitation(personalAccess.invitation)
          : null,
        consent: MEDIA_INTAKE_CONSENT,
        turnstileSiteKey: env.MEDIA_INTAKE_REQUIRE_TURNSTILE === 'true'
          ? env.TURNSTILE_SITE_KEY ?? null
          : null,
      })
    }
    if (request.method === 'POST' && url.pathname === '/api/media-intake/sessions') {
      return await createSession(request, env)
    }
    if (request.method === 'GET' && url.pathname === '/api/media-intake/operator/sessions') {
      return await operatorSessions(request, env)
    }
    if (request.method === 'GET' && url.pathname === '/api/media-intake/operator/summary') {
      return await operatorSummary(request, env)
    }
    if (request.method === 'GET' && url.pathname === '/api/media-intake/operator/control-plane') {
      return await operatorControlPlane(request, env)
    }
    if (request.method === 'POST' && url.pathname === '/api/media-intake/operator/invitations') {
      return await operatorCreateInvitation(request, env)
    }
    if (request.method === 'GET' && url.pathname === '/api/media-intake/operator/invitations') {
      return await operatorInvitations(request, env)
    }
    const revokeMatch = url.pathname.match(/^\/api\/media-intake\/operator\/invitations\/([^/]+)\/revoke$/)
    if (request.method === 'POST' && revokeMatch) {
      return await operatorRevokeInvitation(request, env, revokeMatch[1])
    }

    const partMatch = url.pathname.match(/^\/api\/media-intake\/sessions\/([^/]+)\/files\/([^/]+)\/parts\/(\d+)$/)
    if (request.method === 'PUT' && partMatch) {
      return await uploadPart(request, env, partMatch[1], partMatch[2], partMatch[3])
    }
    const completeMatch = url.pathname.match(/^\/api\/media-intake\/sessions\/([^/]+)\/files\/([^/]+)\/complete$/)
    if (request.method === 'POST' && completeMatch) {
      return await completeFile(request, env, completeMatch[1], completeMatch[2])
    }
    const statusMatch = url.pathname.match(/^\/api\/media-intake\/sessions\/([^/]+)$/)
    if (request.method === 'GET' && statusMatch) {
      return await sessionStatus(request, env, statusMatch[1])
    }
    const downloadMatch = url.pathname.match(/^\/api\/media-intake\/operator\/sessions\/([^/]+)\/files\/([^/]+)$/)
    if (request.method === 'GET' && downloadMatch) {
      return await operatorDownload(request, env, downloadMatch[1], downloadMatch[2])
    }
    const deliveredMatch = url.pathname.match(/^\/api\/media-intake\/operator\/sessions\/([^/]+)\/files\/([^/]+)\/delivered$/)
    if (request.method === 'POST' && deliveredMatch) {
      return await operatorAcknowledgeDelivery(request, env, deliveredMatch[1], deliveredMatch[2])
    }
    const decisionMatch = url.pathname.match(/^\/api\/media-intake\/operator\/sessions\/([^/]+)\/files\/([^/]+)\/decision$/)
    if (request.method === 'POST' && decisionMatch) {
      return await operatorDecision(request, env, decisionMatch[1], decisionMatch[2])
    }
    return apiJson({ error: 'not_found' }, 404)
  } catch (error) {
    if (error instanceof IntakeError) {
      return apiJson({ error: error.code, message: error.message }, error.status)
    }
    return apiJson({ error: 'internal_error', message: 'The upload service hit an unexpected error.' }, 500)
  }
}
