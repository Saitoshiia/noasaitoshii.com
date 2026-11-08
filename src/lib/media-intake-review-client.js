const formatBytes = (bytes) => {
  const units = ['B', 'KB', 'MB', 'GB']
  const order = Math.min(Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** order)).toFixed(order > 1 ? 1 : 0)} ${units[order]}`
}

export function mountMediaIntakeReview(root) {
  const focusedSubmissionId = new URL(window.location.href).searchParams.get('submission')
  const sessionsNode = root.querySelector('[data-review-sessions]')
  const metricsNode = root.querySelector('[data-review-metrics]')
  const notice = root.querySelector('[data-review-notice]')
  const noticeCopy = root.querySelector('[data-review-notice-copy]')
  const invitationForm = root.querySelector('[data-invitation-form]')
  const invitationList = root.querySelector('[data-invitation-list]')
  const generated = root.querySelector('[data-generated-invitation]')
  const generatedUrl = root.querySelector('[data-generated-invitation-url]')
  const copyInvitation = root.querySelector('[data-copy-invitation]')

  const setNotice = (copy, tone) => {
    notice.dataset.tone = tone
    noticeCopy.textContent = copy
  }

  const api = async (path, options = {}) => {
    const response = await fetch(path, options)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || 'Private review is unavailable.')
    return payload
  }

  const actionButton = (label, tone, onClick) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.tone = tone
    button.addEventListener('click', onClick)
    return button
  }

  const renderSessions = (sessions) => {
    sessionsNode.replaceChildren()
    if (!sessions.length) {
      const empty = document.createElement('p')
      empty.className = 'media-review__empty'
      empty.textContent = focusedSubmissionId
        ? 'That submission is not available in this private review console.'
        : 'No uploads have arrived in this local holding bin yet.'
      sessionsNode.append(empty)
      return
    }

    sessions.forEach((session) => {
      const article = document.createElement('article')
      article.className = 'media-review__session'
      const header = document.createElement('header')
      const identity = document.createElement('div')
      const title = document.createElement('h2')
      title.textContent = session.contributorName || session.handle || 'Unnamed contributor'
      const meta = document.createElement('p')
      const expected = session.invitation?.expectedHandle || session.invitation?.expectedName
      const provenance = expected ? ` · invited as ${expected}` : ''
      meta.textContent = `${new Date(session.createdAt).toLocaleString()} · ${formatBytes(session.totalBytes)}${provenance}`
      const consent = document.createElement('small')
      consent.textContent = session.consent
        ? `Permission ${session.consent.version} · ${session.creditPreference || 'credit unspecified'}${session.email ? ` · ${session.email}` : ''}`
        : 'Legacy submission · no recorded consent'
      if (session.invitation?.identityMismatch) consent.dataset.tone = 'warning'
      identity.append(title, meta, consent)
      const note = document.createElement('p')
      note.textContent = session.note || 'No note'
      header.append(identity, note)

      const list = document.createElement('ul')
      session.files.forEach((file) => {
        const row = document.createElement('li')
        const fileIdentity = document.createElement('div')
        const name = document.createElement('strong')
        name.textContent = file.originalName
        const fileMeta = document.createElement('span')
        fileMeta.textContent = `${formatBytes(file.bytes)} · ${file.detectedType || file.status}`
        fileIdentity.append(name, fileMeta)
        const actions = document.createElement('div')
        actions.className = 'media-review__file-actions'
        if (file.status === 'pending_review') {
          actions.append(
            actionButton('Approve', 'approve', () => decide(session.id, file.id, 'approve')),
            actionButton('Reject', 'reject', () => decide(session.id, file.id, 'reject')),
          )
        } else if (file.status === 'ready') {
          const download = document.createElement('a')
          download.textContent = 'Download original'
          download.href = `/api/media-intake/operator/sessions/${session.id}/files/${file.id}`
          actions.append(download)
        } else {
          const state = document.createElement('span')
          state.textContent = file.status.replaceAll('_', ' ')
          actions.append(state)
        }
        row.append(fileIdentity, actions)
        list.append(row)
      })
      article.append(header, list)
      sessionsNode.append(article)
    })
  }

  const renderMetrics = (summary) => {
    const values = [
      ['Needs review', summary.counts?.pending_review ?? 0],
      ['Ready to pull', summary.counts?.ready ?? 0],
      ['Held', summary.counts?.held ?? 0],
      ['Reserved today', formatBytes(summary.todayReservedBytes ?? 0)],
    ]
    metricsNode.replaceChildren()
    values.forEach(([label, value]) => {
      const group = document.createElement('div')
      const term = document.createElement('dt')
      term.textContent = label
      const description = document.createElement('dd')
      description.textContent = String(value)
      group.append(term, description)
      metricsNode.append(group)
    })
  }

  const renderInvitations = (invitations) => {
    invitationList.replaceChildren()
    invitations.forEach((invitation) => {
      const row = document.createElement('article')
      const copy = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = invitation.expectedHandle || invitation.expectedName
      const state = invitation.revokedAt
        ? 'revoked'
        : invitation.useCount >= invitation.maxUses
          ? 'used'
          : Date.parse(invitation.expiresAt) <= Date.now()
            ? 'expired'
            : 'active'
      const meta = document.createElement('small')
      meta.textContent = `${invitation.kind} · ${invitation.useCount}/${invitation.maxUses} uses · ${state}`
      copy.append(title, meta)
      row.append(copy)
      if (state === 'active') {
        row.append(actionButton('Revoke', 'reject', async () => {
          await api(`/api/media-intake/operator/invitations/${invitation.id}/revoke`, { method: 'POST' })
          await refresh()
        }))
      }
      invitationList.append(row)
    })
  }

  const refresh = async () => {
    const [payload, summary, invitationPayload] = await Promise.all([
      api('/api/media-intake/operator/sessions'),
      api('/api/media-intake/operator/summary'),
      api('/api/media-intake/operator/invitations'),
    ])
    const visibleSessions = focusedSubmissionId
      ? payload.sessions.filter((session) => session.id === focusedSubmissionId)
      : payload.sessions
    renderSessions(visibleSessions)
    renderMetrics(summary)
    renderInvitations(invitationPayload.invitations)
    setNotice(
      visibleSessions.length
        ? `${visibleSessions.length} private ${visibleSessions.length === 1 ? 'submission' : 'submissions'} loaded.`
        : focusedSubmissionId
          ? 'The requested submission was not found or has expired.'
        : 'The local holding bin is ready and currently empty.',
      visibleSessions.length || !focusedSubmissionId ? 'ready' : 'error',
    )
  }

  const decide = async (sessionId, fileId, decision) => {
    await api(`/api/media-intake/operator/sessions/${sessionId}/files/${fileId}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    await refresh()
  }

  invitationForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(invitationForm))
    try {
      const payload = await api('/api/media-intake/operator/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, lifetimeDays: Number(body.lifetimeDays) }),
      })
      generated.hidden = false
      generatedUrl.value = payload.url
      generatedUrl.select()
      setNotice('Private link created. Copy it now; its secret will not be shown again.', 'success')
      await refresh()
    } catch (error) {
      setNotice(error.message, 'error')
    }
  })

  invitationForm.elements.kind.addEventListener('change', () => {
    const trusted = invitationForm.elements.kind.value === 'trusted'
    invitationForm.elements.lifetimeDays.max = trusted ? '365' : '30'
    if (trusted && Number(invitationForm.elements.lifetimeDays.value) < 30) {
      invitationForm.elements.lifetimeDays.value = '90'
    }
  })

  copyInvitation.addEventListener('click', async () => {
    await navigator.clipboard.writeText(generatedUrl.value)
    copyInvitation.textContent = 'Copied'
  })

  api('/api/media-intake/config')
    .then((config) => {
      if (!config.local) throw new Error('This browser review surface is available only on Noa’s local machine.')
      return refresh()
    })
    .catch((error) => setNotice(error.message, 'error'))
}
