const RECOVERY_KEY = 'noa-media-intake-recovery-v1'
const RECOVERY_VERSION = 1
const TERMINAL_STATUSES = new Set(['pending_review', 'ready', 'held', 'rejected', 'delivered'])
const ACCEPTED = new Map([
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
  ['.png', ['image/png']],
  ['.heic', ['image/heic', 'image/heif']],
  ['.heif', ['image/heic', 'image/heif']],
  ['.mov', ['video/quicktime', 'video/mp4']],
  ['.mp4', ['video/mp4', 'video/quicktime']],
  ['.m4v', ['video/mp4', 'video/quicktime']],
])

class IntakeApiError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'IntakeApiError'
    this.code = code
    this.status = status
  }
}

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** order)
  return `${value >= 10 || order === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[order]}`
}

const extensionOf = (name) => name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''

const descriptorFromFile = (file) => ({
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
})

const descriptorMatches = (descriptor, file) =>
  descriptor.name === file.name
  && descriptor.size === file.size
  && (!descriptor.type || !file.type || descriptor.type === file.type)

function uploadPart(url, blob, onProgress, registerRequest) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    registerRequest(request)
    request.open('PUT', url)
    request.setRequestHeader('content-type', 'application/octet-stream')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded)
    })
    request.addEventListener('load', () => {
      registerRequest(null)
      if (request.status >= 200 && request.status < 300) {
        resolve()
        return
      }
      let payload = {}
      try { payload = JSON.parse(request.responseText) } catch {}
      reject(new IntakeApiError(
        payload.message ?? 'This upload part could not be saved.',
        payload.error ?? 'upload_failed',
        request.status,
      ))
    })
    request.addEventListener('error', () => {
      registerRequest(null)
      reject(new IntakeApiError('The network connection was interrupted.', 'network_error', 0))
    })
    request.addEventListener('abort', () => {
      registerRequest(null)
      reject(Object.assign(new Error('Upload paused.'), { paused: true }))
    })
    request.send(blob)
  })
}

export function mountMediaIntake(root) {
  const form = root.querySelector('[data-intake-form]')
  const picker = root.querySelector('[data-intake-files]')
  const drop = root.querySelector('[data-intake-drop]')
  const dropTitle = root.querySelector('[data-intake-drop-title]')
  const dropSecondary = root.querySelector('[data-intake-drop-secondary]')
  const queueNode = root.querySelector('[data-intake-queue]')
  const submit = root.querySelector('[data-intake-submit]')
  const pause = root.querySelector('[data-intake-pause]')
  const summary = root.querySelector('[data-intake-summary]')
  const notice = root.querySelector('[data-intake-notice]')
  const noticeCopy = root.querySelector('[data-intake-notice-copy]')
  const invite = root.querySelector('[data-intake-invite]')
  const inviteField = root.querySelector('.media-intake__field--invite')
  const invitationNode = root.querySelector('[data-intake-invitation]')
  const invitationTitle = root.querySelector('[data-intake-invitation-title]')
  const invitationCopy = root.querySelector('[data-intake-invitation-copy]')
  const nameField = form.elements.namedItem('contributorName')
  const handleField = form.elements.namedItem('handle')

  let config = null
  let items = []
  let session = null
  let activeRequest = null
  let paused = false
  let uploading = false

  const setNotice = (message, tone = 'quiet') => {
    notice.dataset.tone = tone
    noticeCopy.textContent = message
  }

  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new IntakeApiError(
        payload.message ?? 'The upload service is unavailable.',
        payload.error ?? 'request_failed',
        response.status,
      )
    }
    return payload
  }

  const itemDescriptor = (item) => item.descriptor ?? descriptorFromFile(item.file)

  const calculateProgress = (serverFile, partBytes) => {
    if (TERMINAL_STATUSES.has(serverFile.status) || serverFile.status === 'validating') return 100
    const uploaded = new Set(serverFile.uploadedParts ?? [])
    let bytes = 0
    for (const partNumber of uploaded) {
      bytes += Math.min(partBytes, serverFile.bytes - ((partNumber - 1) * partBytes))
    }
    return serverFile.bytes ? (bytes / serverFile.bytes) * 100 : 0
  }

  const writeRecovery = () => {
    if (!session) return
    if (items.every((item) => TERMINAL_STATUSES.has(item.status))) {
      localStorage.removeItem(RECOVERY_KEY)
      return
    }

    localStorage.setItem(RECOVERY_KEY, JSON.stringify({
      version: RECOVERY_VERSION,
      sessionId: session.session.id,
      expiresAt: session.session.expiresAt,
      partBytes: session.partBytes,
      files: items.map((item) => ({
        serverId: item.serverId,
        descriptor: itemDescriptor(item),
        status: item.status,
      })),
    }))
  }

  const clearRecovery = () => localStorage.removeItem(RECOVERY_KEY)

  const readRecovery = () => {
    try {
      const recovery = JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? 'null')
      if (
        recovery?.version !== RECOVERY_VERSION
        || typeof recovery.sessionId !== 'string'
        || Date.parse(recovery.expiresAt) <= Date.now()
        || !Number.isSafeInteger(recovery.partBytes)
      ) {
        clearRecovery()
        return null
      }
      return recovery
    } catch {
      clearRecovery()
      return null
    }
  }

  const canSubmit = () => {
    if (!config?.enabled || !items.length || uploading) return false
    if (!session) return items.every((item) => item.status !== 'rejected')
    return items.some((item) =>
      item.file
      && !TERMINAL_STATUSES.has(item.status)
      && ['paused', 'error', 'authorized', 'needs_file'].includes(item.status))
  }

  const updateDropLanguage = () => {
    const waiting = session
      ? items.filter((item) => !item.file && !TERMINAL_STATUSES.has(item.status)).length
      : 0
    dropTitle.textContent = waiting ? 'Reselect originals to resume' : 'Choose photos or videos'
    dropSecondary.textContent = waiting
      ? `${waiting} ${waiting === 1 ? 'file needs' : 'files need'} to be matched`
      : 'or drop them here'
  }

  const updateControls = () => {
    submit.disabled = !canSubmit()
    if (!session) {
      submit.textContent = 'Send original files'
    } else if (canSubmit()) {
      submit.textContent = 'Resume selected files'
    } else if (items.every((item) => TERMINAL_STATUSES.has(item.status))) {
      submit.textContent = 'Files received'
    } else {
      submit.textContent = 'Reselect to resume'
    }
    pause.hidden = !uploading
    const bytes = items.reduce((total, item) => total + itemDescriptor(item).size, 0)
    const waiting = items.filter((item) => item.status === 'needs_file').length
    summary.textContent = items.length
      ? `${items.length} ${items.length === 1 ? 'file' : 'files'} · ${formatBytes(bytes)}${waiting ? ` · ${waiting} to reselect` : ''}`
      : 'No files selected'
    updateDropLanguage()
  }

  const render = () => {
    queueNode.replaceChildren()
    items.forEach((item, index) => {
      const descriptor = itemDescriptor(item)
      const row = document.createElement('li')
      row.className = 'media-intake__file'
      row.dataset.status = item.status

      const identity = document.createElement('div')
      identity.className = 'media-intake__file-identity'
      const name = document.createElement('strong')
      name.textContent = descriptor.name
      const meta = document.createElement('span')
      meta.textContent = `${formatBytes(descriptor.size)} · ${extensionOf(descriptor.name).slice(1).toUpperCase()}`
      identity.append(name, meta)

      const progress = document.createElement('div')
      progress.className = 'media-intake__file-progress'
      const track = document.createElement('span')
      const fill = document.createElement('i')
      fill.style.width = `${Math.max(0, Math.min(100, item.progress ?? 0))}%`
      track.append(fill)
      const state = document.createElement('small')
      state.textContent = item.message ?? ({
        queued: 'Queued',
        rejected: 'Not accepted',
        authorizing: 'Authorizing',
        authorized: 'Ready',
        uploading: `${Math.round(item.progress ?? 0)}%`,
        paused: 'Ready to resume',
        needs_file: 'Reselect original',
        validating: 'Checking file',
        pending_review: 'Received for review',
        ready: 'Approved',
        delivered: 'Delivered',
        held: 'Held for review',
        rejected: 'Not approved',
        error: 'Retry needed',
      }[item.status] ?? item.status)
      progress.append(track, state)

      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'media-intake__file-remove'
      remove.textContent = 'Remove'
      remove.setAttribute('aria-label', `Remove ${descriptor.name}`)
      remove.disabled = Boolean(session)
      remove.addEventListener('click', () => {
        items.splice(index, 1)
        render()
      })

      row.append(identity, progress, remove)
      queueNode.append(row)
    })
    updateControls()
  }

  const validateFile = (file) => {
    const extension = extensionOf(file.name)
    const types = ACCEPTED.get(extension)
    if (!types) return 'Only JPG, PNG, HEIC, HEIF, MOV, MP4, and M4V files are accepted.'
    if (file.type && !types.includes(file.type.toLowerCase())) return 'The filename and media type do not match.'
    if (file.size <= 0) return 'This file is empty.'
    if (file.size > config.maxFileBytes) return `This file is over the ${formatBytes(config.maxFileBytes)} limit.`
    return null
  }

  const addRecoveryFiles = (fileList) => {
    let matched = 0
    const unmatched = []
    for (const file of fileList) {
      const item = items.find((candidate) =>
        !candidate.file
        && !TERMINAL_STATUSES.has(candidate.status)
        && descriptorMatches(itemDescriptor(candidate), file))
      if (!item) {
        unmatched.push(file.name)
        continue
      }
      item.file = file
      item.descriptor = descriptorFromFile(file)
      item.status = 'paused'
      item.message = 'Ready to resume'
      matched += 1
    }

    if (matched) {
      setNotice(
        `${matched} ${matched === 1 ? 'original is' : 'originals are'} matched. Resume when ready.`,
        'ready',
      )
    } else {
      setNotice(
        unmatched.length
          ? 'Those files do not match the original names, sizes, and media types for this session.'
          : 'Choose the original files listed below to resume.',
        'error',
      )
    }
    writeRecovery()
    render()
  }

  const addNewFiles = (fileList) => {
    for (const file of fileList) {
      if (items.some((item) => {
        const descriptor = itemDescriptor(item)
        return descriptor.name === file.name
          && descriptor.size === file.size
          && descriptor.lastModified === file.lastModified
      })) continue
      const message = validateFile(file)
      items.push({
        file,
        descriptor: descriptorFromFile(file),
        status: message ? 'rejected' : 'queued',
        message,
        progress: 0,
      })
    }

    if (items.length > config.maxFiles) {
      items.slice(config.maxFiles).forEach((item) => {
        item.status = 'rejected'
        item.message = `Choose no more than ${config.maxFiles} files at once.`
      })
    }
    const total = items.reduce((sum, item) => sum + itemDescriptor(item).size, 0)
    if (total > config.maxSessionBytes) {
      setNotice(`This group is over the ${formatBytes(config.maxSessionBytes)} session limit.`, 'error')
    } else if (items.some((item) => item.status === 'rejected')) {
      setNotice('Remove the files marked “Not accepted” before sending.', 'error')
    } else {
      setNotice('Files stay on this device until you press Send original files.', 'ready')
    }
    render()
  }

  const addFiles = (fileList) => {
    if (!config?.enabled) return
    if (session) addRecoveryFiles([...fileList])
    else addNewFiles([...fileList])
  }

  const syncServerStatus = (serverSession) => {
    session.session = serverSession
    for (const serverFile of serverSession.files) {
      const item = items.find((candidate) => candidate.serverId === serverFile.id)
      if (!item) continue
      if (TERMINAL_STATUSES.has(serverFile.status)) item.status = serverFile.status
      else if (!item.file) item.status = 'needs_file'
      item.progress = calculateProgress(serverFile, session.partBytes)
      item.message = serverFile.message
      item.uploadedParts = serverFile.uploadedParts
    }
    writeRecovery()
    render()
  }

  const restoreRecovery = async () => {
    const recovery = readRecovery()
    if (!recovery) return false
    try {
      const payload = await api(`/api/media-intake/sessions/${recovery.sessionId}`)
      session = {
        session: payload.session,
        partBytes: recovery.partBytes,
      }
      items = payload.session.files.map((serverFile) => ({
        file: null,
        descriptor: {
          name: serverFile.originalName,
          size: serverFile.bytes,
          type: serverFile.browserType,
          lastModified: serverFile.lastModified,
        },
        serverId: serverFile.id,
        status: TERMINAL_STATUSES.has(serverFile.status) ? serverFile.status : 'needs_file',
        message: TERMINAL_STATUSES.has(serverFile.status)
          ? serverFile.message
          : 'Reselect this original to resume',
        progress: calculateProgress(serverFile, recovery.partBytes),
        uploadedParts: serverFile.uploadedParts,
      }))
      setNotice(
        items.some((item) => item.status === 'needs_file')
          ? 'A previous upload can be resumed. Reselect the originals listed below.'
          : 'This previous upload is complete.',
        items.some((item) => item.status === 'needs_file') ? 'active' : 'success',
      )
      writeRecovery()
      render()
      return true
    } catch (error) {
      if ([403, 404, 410].includes(error.status)) clearRecovery()
      else setNotice('A previous upload exists, but its status cannot be checked right now.', 'error')
      return false
    }
  }

  const runUpload = async () => {
    paused = false
    uploading = true
    items.filter((item) => item.file && !TERMINAL_STATUSES.has(item.status)).forEach((item) => {
      if (['queued', 'error', 'paused', 'needs_file', 'authorized'].includes(item.status)) {
        item.status = 'authorizing'
      }
    })
    setNotice(session ? 'Reopening the private upload session…' : 'Opening a private upload session…', 'active')
    render()

    try {
      if (!session) {
        const body = new FormData(form)
        const payload = await api('/api/media-intake/sessions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-media-invite': String(body.get('invite') ?? ''),
          },
          body: JSON.stringify({
            contributorName: body.get('contributorName'),
            handle: body.get('handle'),
            email: body.get('email'),
            creditPreference: body.get('creditPreference'),
            note: body.get('note'),
            consentVersion: config.consent.version,
            confirmsAuthority: body.get('confirmsAuthority') === 'on',
            grantsMediaLicense: body.get('grantsMediaLicense') === 'on',
            files: items.map((item) => itemDescriptor(item)),
          }),
        })
        session = payload
        payload.session.files.forEach((file, index) => {
          items[index].serverId = file.id
          items[index].uploadedParts = file.uploadedParts
        })
        writeRecovery()
      }

      for (const item of items) {
        if (!item.file || TERMINAL_STATUSES.has(item.status)) continue
        const serverFile = session.session.files.find((candidate) => candidate.id === item.serverId)
        if (!serverFile) throw new IntakeApiError('Upload file state is missing.', 'file_state_missing', 409)
        const totalParts = Math.ceil(item.file.size / session.partBytes)
        const uploadedParts = new Set(serverFile.uploadedParts ?? item.uploadedParts ?? [])
        item.status = 'uploading'
        item.message = null
        render()

        for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
          if (paused) throw Object.assign(new Error('Upload paused.'), { paused: true })
          const start = (partNumber - 1) * session.partBytes
          const end = Math.min(item.file.size, start + session.partBytes)
          if (uploadedParts.has(partNumber)) {
            item.progress = (end / item.file.size) * 100
            continue
          }
          await uploadPart(
            `/api/media-intake/sessions/${session.session.id}/files/${serverFile.id}/parts/${partNumber}`,
            item.file.slice(start, end),
            (loaded) => {
              item.progress = ((start + loaded) / item.file.size) * 100
              render()
            },
            (request) => { activeRequest = request },
          )
          uploadedParts.add(partNumber)
          serverFile.uploadedParts = [...uploadedParts]
          item.uploadedParts = [...uploadedParts]
          writeRecovery()
        }

        item.status = 'validating'
        item.progress = 100
        setNotice(`Checking ${item.file.name} before it enters Noa’s library…`, 'active')
        render()
        try {
          const completed = await api(
            `/api/media-intake/sessions/${session.session.id}/files/${serverFile.id}/complete`,
            { method: 'POST' },
          )
          item.status = completed.status
          item.message = completed.status === 'pending_review' ? 'Received for review' : completed.message
        } catch (error) {
          item.status = error.status === 422 ? 'held' : 'error'
          item.message = error.message
        }
        writeRecovery()
        render()
      }

      const latest = await api(`/api/media-intake/sessions/${session.session.id}`)
      syncServerStatus(latest.session)
      const waiting = items.some((item) => item.status === 'needs_file')
      const held = items.some((item) => item.status === 'held')
      setNotice(
        waiting
          ? 'Selected files arrived. Reselect the remaining originals whenever you are ready.'
          : held
            ? 'Your upload arrived. One or more files were held for Noa to review.'
            : 'Everything arrived. Thank you. Noa will privately review the verified originals.',
        waiting || held ? 'error' : 'success',
      )
    } catch (error) {
      if (error.paused || paused || !navigator.onLine) {
        items.filter((item) => ['authorizing', 'uploading'].includes(item.status))
          .forEach((item) => { item.status = 'paused' })
        setNotice(
          'Upload paused. You may resume now, or return to this page and reselect the same originals later.',
          'error',
        )
        paused = true
      } else {
        const active = items.find((item) => ['authorizing', 'uploading'].includes(item.status))
        if (active) {
          active.status = 'error'
          active.message = error.message
        }
        setNotice(error.message, 'error')
      }
      writeRecovery()
    } finally {
      uploading = false
      activeRequest = null
      render()
    }
  }

  picker.addEventListener('change', () => {
    addFiles(picker.files)
    picker.value = ''
  })
  drop.addEventListener('click', (event) => {
    if (event.target !== picker) picker.click()
  })
  drop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      picker.click()
    }
  })
  for (const eventName of ['dragenter', 'dragover']) {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault()
      drop.dataset.dragging = ''
    })
  }
  for (const eventName of ['dragleave', 'drop']) {
    drop.addEventListener(eventName, (event) => {
      event.preventDefault()
      delete drop.dataset.dragging
    })
  }
  drop.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files ?? []))
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!String(nameField.value).trim() && !String(handleField.value).trim()) {
      handleField.setCustomValidity('Add your name or social handle so Noa knows who sent these files.')
    } else {
      handleField.setCustomValidity('')
    }
    if (canSubmit() && form.reportValidity()) runUpload()
  })
  nameField.addEventListener('input', () => handleField.setCustomValidity(''))
  handleField.addEventListener('input', () => handleField.setCustomValidity(''))
  pause.addEventListener('click', () => {
    paused = true
    activeRequest?.abort()
  })
  window.addEventListener('offline', () => {
    if (uploading) {
      paused = true
      activeRequest?.abort()
    }
  })
  window.addEventListener('beforeunload', (event) => {
    if (uploading) {
      event.preventDefault()
      event.returnValue = ''
    }
  })

  api('/api/media-intake/config')
    .then(async (payload) => {
      config = payload
      if (payload.local || payload.invitation) {
        invite.value = 'friends-preview'
        inviteField.hidden = true
      }
      if (payload.invitation) {
        invitationNode.hidden = false
        invitationTitle.textContent = payload.invitation.expectedHandle
          || payload.invitation.expectedName
          || 'This link is for you'
        invitationCopy.textContent = payload.invitation.eventLabel
          ? `For ${payload.invitation.eventLabel}. Confirm or correct your details below.`
          : 'Confirm or correct your details below before sending.'
        if (payload.invitation.expectedHandle) handleField.value = payload.invitation.expectedHandle
        if (payload.invitation.expectedName) nameField.value = payload.invitation.expectedName
      }
      root.querySelector('[data-intake-authority]').textContent = payload.consent.authorityStatement
      root.querySelector('[data-intake-license]').textContent = payload.consent.licenseStatement
      if (!payload.enabled) {
        setNotice('This media drop is not open right now.', 'error')
        updateControls()
        return
      }
      const restored = await restoreRecovery()
      if (restored) inviteField.hidden = true
      if (!restored) {
        setNotice(
          payload.eventLabel
            ? `${payload.eventLabel} · This private drop is open.`
            : 'This private drop is open. Files are accepted only after you press send.',
          'ready',
        )
        updateControls()
      }
    })
    .catch(() => {
      setNotice('The upload service is offline. Try this link again a little later.', 'error')
      updateControls()
    })
}
