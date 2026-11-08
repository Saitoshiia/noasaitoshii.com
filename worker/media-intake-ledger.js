const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { 'cache-control': 'no-store' },
})

const METADATA_RETENTION_DAYS = 45
const ATTEMPT_RETENTION_HOURS = 48
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export class MediaIntakeLedger {
  constructor(state) {
    this.storage = state.storage
  }

  async listAll(prefix, cap = 10_000) {
    const entries = new Map()
    let startAfter
    while (entries.size < cap) {
      const batchLimit = Math.min(1_000, cap - entries.size)
      const batch = await this.storage.list({
        prefix,
        limit: batchLimit,
        ...(startAfter ? { startAfter } : {}),
      })
      for (const [key, value] of batch) entries.set(key, value)
      if (batch.size < batchLimit) break
      startAfter = [...batch.keys()].at(-1)
      if (!startAfter) break
    }
    return entries
  }

  async fetch(request) {
    const url = new URL(request.url)
    let body = null
    if (request.method !== 'GET') {
      try {
        body = await request.json()
      } catch {
        return json({ error: 'invalid_json', message: 'The JSON request body is malformed.' }, 400)
      }
    }

    if (request.method === 'POST' && url.pathname === '/reserve') {
      await this.maybeCleanup()
      return this.reserve(body)
    }
    if (request.method === 'POST' && url.pathname === '/invitations') {
      return this.createInvitation(body)
    }
    if (request.method === 'GET' && url.pathname === '/operator/invitations') {
      return this.listInvitations()
    }
    if (request.method === 'GET' && url.pathname.startsWith('/invitations/')) {
      return this.readInvitation(decodeURIComponent(url.pathname.slice('/invitations/'.length)))
    }
    if (request.method === 'POST' && url.pathname.match(/^\/invitations\/[^/]+\/revoke$/)) {
      const id = decodeURIComponent(url.pathname.split('/')[2])
      return this.revokeInvitation(id)
    }
    if (request.method === 'POST' && url.pathname === '/attempt') {
      return this.recordAttempt(body)
    }
    if (request.method === 'GET' && url.pathname.startsWith('/sessions/')) {
      return this.readSession(decodeURIComponent(url.pathname.slice('/sessions/'.length)))
    }
    if (request.method === 'PATCH' && url.pathname.startsWith('/sessions/')) {
      return this.updateSession(decodeURIComponent(url.pathname.slice('/sessions/'.length)), body)
    }
    if (request.method === 'GET' && url.pathname === '/operator/sessions') {
      return this.listSessions()
    }
    if (request.method === 'GET' && url.pathname === '/operator/summary') {
      await this.maybeCleanup()
      return this.operatorSummary()
    }
    return json({ error: 'not_found' }, 404)
  }

  async maybeCleanup(now = new Date()) {
    const cleanupDay = now.toISOString().slice(0, 10)
    const markerKey = `maintenance:cleanup:${cleanupDay}`
    if (await this.storage.get(markerKey)) return

    const remove = []
    const attemptCutoff = new Date(now.getTime() - ATTEMPT_RETENTION_HOURS * HOUR_MS)
      .toISOString()
      .slice(0, 13)
    const attempts = await this.listAll('attempt:')
    for (const key of attempts.keys()) {
      const window = key.slice('attempt:'.length, 'attempt:'.length + 13)
      if (window < attemptCutoff) remove.push(key)
    }

    const sessionCutoff = now.getTime() - METADATA_RETENTION_DAYS * DAY_MS
    const sessions = await this.listAll('session:')
    for (const [key, session] of sessions) {
      const updatedAt = Date.parse(session.updatedAt ?? session.expiresAt ?? session.createdAt ?? '')
      if (Number.isFinite(updatedAt) && updatedAt < sessionCutoff) remove.push(key)
    }

    const invitations = await this.listAll('invitation:')
    for (const [key, invitation] of invitations) {
      const inactiveAt = Date.parse(invitation.revokedAt ?? invitation.expiresAt ?? '')
      if (Number.isFinite(inactiveAt) && inactiveAt < sessionCutoff) {
        remove.push(key)
        if (invitation.requestId) remove.push(`invitation-request:${invitation.requestId}`)
      }
    }

    const markers = await this.listAll('maintenance:cleanup:', 100)
    for (const key of markers.keys()) {
      const day = key.slice('maintenance:cleanup:'.length)
      const markerDate = Date.parse(`${day}T00:00:00.000Z`)
      if (Number.isFinite(markerDate) && markerDate < now.getTime() - 7 * DAY_MS) remove.push(key)
    }

    if (remove.length) await this.storage.delete(remove)
    await this.storage.put(markerKey, {
      completedAt: now.toISOString(),
      removed: remove.length,
    })
  }

  async recordAttempt(body) {
    if (
      typeof body?.key !== 'string'
      || !body.key
      || typeof body?.window !== 'string'
      || !body.window
      || !Number.isSafeInteger(body?.maxAttempts)
      || body.maxAttempts < 1
    ) {
      return json({ error: 'invalid_attempt' }, 400)
    }

    const storageKey = `attempt:${body.window}:${body.key}`
    const attempts = Number(await this.storage.get(storageKey) ?? 0) + 1
    await this.storage.put(storageKey, attempts)
    if (attempts > body.maxAttempts) {
      return json({
        error: 'attempt_limit',
        message: 'Too many upload attempts. Try again later.',
      }, 429)
    }
    return json({ attempts, remaining: body.maxAttempts - attempts })
  }

  async reserve(body) {
    const dayKey = `day:${body.day}`
    const used = Number(await this.storage.get(dayKey) ?? 0)
    if (used + body.totalBytes > body.maxDailyBytes) {
      return json({ error: 'daily_limit', message: 'Today’s intake capacity has been reached.' }, 429)
    }

    const existing = await this.storage.get(`session:${body.session.id}`)
    if (existing) return json({ error: 'session_exists' }, 409)

    const writes = {
      [dayKey]: used + body.totalBytes,
      [`session:${body.session.id}`]: body.session,
    }

    if (body.invitation) {
      const invitationKey = `invitation:${body.invitation.id}`
      const invitation = await this.storage.get(invitationKey)
      if (
        !invitation
        || invitation.tokenHash !== body.invitation.tokenHash
        || invitation.revokedAt
        || Date.parse(invitation.expiresAt) <= Date.now()
        || invitation.useCount >= invitation.maxUses
      ) {
        return json({ error: 'invalid_invite', message: 'This personalized upload link is no longer active.' }, 403)
      }
      invitation.useCount += 1
      invitation.lastUsedAt = new Date().toISOString()
      writes[invitationKey] = invitation
    }

    await this.storage.put(writes)
    return json({ reserved: true })
  }

  async createInvitation(body) {
    if (body.requestId) {
      const existingId = await this.storage.get(`invitation-request:${body.requestId}`)
      if (existingId) {
        const existing = await this.storage.get(`invitation:${existingId}`)
        if (!existing) return json({ error: 'invitation_request_inconsistent' }, 409)
        const comparable = ['kind', 'expectedHandle', 'expectedName', 'eventLabel', 'lifetimeDays', 'maxUses']
        if (comparable.some((field) => existing[field] !== body[field])) {
          return json({ error: 'invitation_request_conflict' }, 409)
        }
        return json({ invitation: existing, replayed: true })
      }
    }
    const key = `invitation:${body.id}`
    if (await this.storage.get(key)) return json({ error: 'invitation_exists' }, 409)
    if (body.requestId) {
      await this.storage.put({
        [key]: body,
        [`invitation-request:${body.requestId}`]: body.id,
      })
    } else {
      await this.storage.put(key, body)
    }
    return json({ invitation: body, replayed: false }, 201)
  }

  async readInvitation(id) {
    const invitation = await this.storage.get(`invitation:${id}`)
    return invitation ? json({ invitation }) : json({ error: 'not_found' }, 404)
  }

  async listInvitations() {
    const entries = await this.listAll('invitation:')
    const invitations = [...entries.values()]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return json({ invitations })
  }

  async revokeInvitation(id) {
    const key = `invitation:${id}`
    const invitation = await this.storage.get(key)
    if (!invitation) return json({ error: 'not_found' }, 404)
    if (!invitation.revokedAt) invitation.revokedAt = new Date().toISOString()
    await this.storage.put(key, invitation)
    return json({ invitation })
  }

  async readSession(id) {
    const session = await this.storage.get(`session:${id}`)
    return session ? json({ session }) : json({ error: 'not_found' }, 404)
  }

  async updateSession(id, body) {
    const key = `session:${id}`
    const session = await this.storage.get(key)
    if (!session) return json({ error: 'not_found' }, 404)

    if (body.tokenHash !== session.tokenHash) {
      return json({ error: 'unauthorized' }, 403)
    }

    const file = session.files.find((candidate) => candidate.id === body.fileId)
    if (!file) return json({ error: 'file_not_found' }, 404)

    if (body.operation === 'part') {
      file.parts = file.parts.filter((part) => part.partNumber !== body.part.partNumber)
      file.parts.push(body.part)
      file.parts.sort((a, b) => a.partNumber - b.partNumber)
      file.status = 'uploading'
    } else if (body.operation === 'status') {
      file.status = body.status
      file.detectedType = body.detectedType ?? file.detectedType ?? null
      file.eligibleKey = body.eligibleKey ?? file.eligibleKey ?? null
      file.eligibleEtag = body.eligibleEtag ?? file.eligibleEtag ?? null
      file.message = body.message ?? null
      file.completedAt = body.completedAt ?? file.completedAt ?? null
      file.deliveredAt = body.deliveredAt ?? file.deliveredAt ?? null
      file.deliveredName = body.deliveredName ?? file.deliveredName ?? null
      file.deliveredSha256 = body.deliveredSha256 ?? file.deliveredSha256 ?? null
      file.reviewedAt = body.reviewedAt ?? file.reviewedAt ?? null
      file.reviewDecision = body.reviewDecision ?? file.reviewDecision ?? null
    } else {
      return json({ error: 'invalid_operation' }, 400)
    }

    session.updatedAt = new Date().toISOString()
    await this.storage.put(key, session)
    return json({ session })
  }

  async listSessions() {
    const entries = await this.listAll('session:')
    const sessions = [...entries.values()]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt ?? session.createdAt,
        expiresAt: session.expiresAt,
        contributorName: session.contributorName,
        handle: session.handle,
        email: session.email ?? '',
        creditPreference: session.creditPreference ?? null,
        note: session.note,
        eventLabel: session.eventLabel ?? null,
        invitation: session.invitation ?? null,
        consent: session.consent ?? null,
        totalBytes: session.totalBytes,
        files: session.files.map((file) => ({
          id: file.id,
          originalName: file.originalName,
          bytes: file.bytes,
          status: file.status,
          detectedType: file.detectedType ?? null,
          message: file.message ?? null,
          completedAt: file.completedAt ?? null,
          reviewedAt: file.reviewedAt ?? null,
          reviewDecision: file.reviewDecision ?? null,
          deliveredAt: file.deliveredAt ?? null,
          deliveredName: file.deliveredName ?? null,
        })),
      }))
    return json({ sessions })
  }

  async operatorSummary() {
    const entries = await this.listAll('session:')
    const sessions = [...entries.values()]
    const counts = {
      authorized: 0,
      uploading: 0,
      validating: 0,
      completing: 0,
      ready: 0,
      pending_review: 0,
      rejected: 0,
      held: 0,
      delivered: 0,
      expired: 0,
    }
    let reservedBytes = 0
    let oldestPendingAt = null
    for (const session of sessions) {
      reservedBytes += Number(session.totalBytes) || 0
      for (const file of session.files) {
        counts[file.status] = (counts[file.status] ?? 0) + 1
        if (!['delivered', 'expired', 'rejected'].includes(file.status)) {
          if (!oldestPendingAt || session.createdAt < oldestPendingAt) {
            oldestPendingAt = session.createdAt
          }
        }
      }
    }
    const day = new Date().toISOString().slice(0, 10)
    const todayReservedBytes = Number(await this.storage.get(`day:${day}`) ?? 0)
    return json({
      generatedAt: new Date().toISOString(),
      sessions: sessions.length,
      reservedBytes,
      todayReservedBytes,
      oldestPendingAt,
      counts,
      attentionRequired: counts.held > 0 || counts.pending_review > 0,
    })
  }
}
