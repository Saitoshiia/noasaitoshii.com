export const DEFAULT_TWITCH_INTERVAL_MS = 60_000
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000
export const DEFAULT_EVENT_LIFECYCLE_INTERVAL_MS = 60_000

const TIME_DERIVED_STATUSES = new Set(['upcoming', 'live', 'published'])
const NORMALIZED_PAST_STATUSES = new Set(['past', 'completed'])
const WITHDRAWN_STATUSES = new Set(['cancelled', 'postponed'])

function toMillis(value) {
  if (value instanceof Date) {
    const millis = value.getTime()
    return Number.isFinite(millis) ? millis : null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const millis = Date.parse(value)
    return Number.isFinite(millis) ? millis : null
  }

  return null
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function formatCountdownText(start, end, now) {
  const startMillis = toMillis(start)
  const endMillis = toMillis(end)
  const nowMillis = toMillis(now)

  if (
    startMillis === null ||
    endMillis === null ||
    nowMillis === null ||
    endMillis <= startMillis
  ) {
    return null
  }

  if (nowMillis < startMillis) {
    const totalHours = Math.floor((startMillis - nowMillis) / 3_600_000)
    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24

    if (days > 0) {
      return `In ${days} day${days === 1 ? '' : 's'} · ${hours} hour${hours === 1 ? '' : 's'}`
    }

    return `In ${hours} hour${hours === 1 ? '' : 's'}`
  }

  if (nowMillis < endMillis) {
    return 'Happening now'
  }

  return 'This set has ended'
}

export function projectEventRuntime({
  sourceStatus,
  eventStartsAt,
  eventEndsAt,
  countdownStartsAt,
  countdownEndsAt,
  now,
}) {
  const status = typeof sourceStatus === 'string' ? sourceStatus : ''
  const nowMillis = toMillis(now)
  const eventStartMillis = toMillis(eventStartsAt)
  const eventEndMillis = toMillis(eventEndsAt)
  const eventTimesValid =
    nowMillis !== null &&
    eventStartMillis !== null &&
    eventEndMillis !== null &&
    eventEndMillis > eventStartMillis

  let projectedStatus = status

  if (WITHDRAWN_STATUSES.has(status)) {
    return { status: projectedStatus, countdown: null }
  }

  if (NORMALIZED_PAST_STATUSES.has(status)) {
    projectedStatus = 'past'
  } else if (TIME_DERIVED_STATUSES.has(status) && eventTimesValid) {
    if (nowMillis < eventStartMillis) {
      projectedStatus = 'upcoming'
    } else if (nowMillis < eventEndMillis) {
      projectedStatus = 'live'
    } else {
      projectedStatus = 'past'
    }
  }

  if (!eventTimesValid) {
    return { status: projectedStatus, countdown: null }
  }

  return {
    status: projectedStatus,
    countdown: formatCountdownText(countdownStartsAt, countdownEndsAt, now),
  }
}

export function createEventLifecycleController({
  sourceStatus,
  eventStartsAt,
  eventEndsAt,
  countdownStartsAt,
  countdownEndsAt,
  render = () => {},
  isVisible = () => true,
  now = () => Date.now(),
  setTimeoutFn = (callback, delay) => setTimeout(callback, delay),
  clearTimeoutFn = (timer) => clearTimeout(timer),
  intervalMs = DEFAULT_EVENT_LIFECYCLE_INTERVAL_MS,
} = {}) {
  let started = false
  let stopped = false
  let visible = Boolean(isVisible())
  let timer = null

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeoutFn(timer)
      timer = null
    }
  }

  const schedule = () => {
    clearTimer()
    if (stopped || !visible) return

    timer = setTimeoutFn(() => {
      timer = null
      if (!stopped && visible) reconcile()
    }, intervalMs)
  }

  const reconcile = (force = false) => {
    if (stopped || (!visible && !force)) return

    render(
      projectEventRuntime({
        sourceStatus,
        eventStartsAt,
        eventEndsAt,
        countdownStartsAt,
        countdownEndsAt,
        now: now(),
      }),
    )
    schedule()
  }

  const start = () => {
    if (started || stopped) return
    started = true
    visible = Boolean(isVisible())
    reconcile(true)
  }

  const visibilityChanged = (nextVisible) => {
    if (stopped) return

    const wasVisible = visible
    visible = Boolean(nextVisible)

    if (!visible) {
      clearTimer()
      return
    }

    if (started && !wasVisible) reconcile()
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimer()
  }

  return {
    start,
    visibilityChanged,
    stop,
    cleanup: stop,
  }
}

export function bindPageLifecycle({
  controller,
  documentRef = globalThis.document,
  windowRef = globalThis,
  isVisible = () => !documentRef.hidden,
} = {}) {
  if (!controller || typeof controller.visibilityChanged !== 'function' || typeof controller.stop !== 'function') {
    throw new TypeError('bindPageLifecycle requires a lifecycle controller')
  }

  let pageSuspended = false
  let stopped = false
  let lastVisible = Boolean(isVisible())

  const removeListeners = () => {
    documentRef.removeEventListener('visibilitychange', onVisibilityChange)
    windowRef.removeEventListener('pagehide', onPageHide)
    windowRef.removeEventListener('pageshow', onPageShow)
  }

  const reconcileVisibility = () => {
    if (stopped || pageSuspended) return

    const nextVisible = Boolean(isVisible())
    if (nextVisible === lastVisible) return
    lastVisible = nextVisible
    controller.visibilityChanged(nextVisible)
  }

  const onVisibilityChange = () => reconcileVisibility()

  const onPageHide = (event) => {
    if (stopped) return

    if (event?.persisted) {
      if (pageSuspended) return
      pageSuspended = true
      lastVisible = false
      controller.visibilityChanged(false)
      return
    }

    stopped = true
    removeListeners()
    controller.stop()
  }

  const onPageShow = () => {
    if (stopped || !pageSuspended) return
    pageSuspended = false
    reconcileVisibility()
  }

  documentRef.addEventListener('visibilitychange', onVisibilityChange)
  windowRef.addEventListener('pagehide', onPageHide)
  windowRef.addEventListener('pageshow', onPageShow)

  const stop = () => {
    if (stopped) return
    stopped = true
    removeListeners()
    controller.stop()
  }

  return { stop, cleanup: stop }
}

export function isLivePayload(payload, channelNames = []) {
  if (!isRecord(payload) || !isRecord(payload.channels)) return false

  return channelNames.every((channelName) => {
    const channel = payload.channels[channelName]
    return isRecord(channel) && typeof channel.live === 'boolean'
  })
}

export function createTwitchRefreshController({
  request,
  onSuccess = () => {},
  onUnavailable = () => {},
  isVisible = () => true,
  now = () => Date.now(),
  setTimeoutFn = (callback, delay) => setTimeout(callback, delay),
  clearTimeoutFn = (timer) => clearTimeout(timer),
  createAbortController = () => new AbortController(),
  validatePayload = (payload) => isLivePayload(payload),
  intervalMs = DEFAULT_TWITCH_INTERVAL_MS,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
} = {}) {
  if (typeof request !== 'function') {
    throw new TypeError('createTwitchRefreshController requires a request function')
  }

  let started = false
  let stopped = false
  let visible = Boolean(isVisible())
  let ordinaryTimer = null
  let activeRequest = null
  let pendingVisibleRefresh = false
  let generation = 0
  let lastRequestStart = null

  const clearOrdinaryTimer = () => {
    if (ordinaryTimer !== null) {
      clearTimeoutFn(ordinaryTimer)
      ordinaryTimer = null
    }
  }

  const isCurrent = (record) =>
    activeRequest === record && record.token === generation && !stopped

  const scheduleOrdinary = () => {
    if (stopped || !visible || activeRequest !== null || ordinaryTimer !== null) return

    const nowMillis = toMillis(now())
    const elapsed =
      lastRequestStart === null || nowMillis === null
        ? 0
        : Math.max(0, nowMillis - lastRequestStart)
    const delay = Math.max(0, intervalMs - elapsed)

    ordinaryTimer = setTimeoutFn(() => {
      ordinaryTimer = null
      if (!stopped && visible && activeRequest === null) beginRequest('ordinary')
    }, delay)
  }

  const finishRequest = (record) => {
    if (record.timeoutTimer !== null) {
      clearTimeoutFn(record.timeoutTimer)
      record.timeoutTimer = null
    }

    if (activeRequest !== record) return

    activeRequest = null
    const shouldRefresh = pendingVisibleRefresh && visible && !stopped
    pendingVisibleRefresh = false

    if (shouldRefresh) {
      beginRequest('visibility')
    } else {
      scheduleOrdinary()
    }
  }

  const handleFailure = (record, error) => {
    if (!isCurrent(record) || record.hiddenAbort || record.stopAbort) return
    if (record.unavailableRendered) return

    record.unavailableRendered = true
    onUnavailable(error)
  }

  const beginRequest = (reason) => {
    if (stopped || !visible || activeRequest !== null) return false

    clearOrdinaryTimer()

    const controller = createAbortController()
    const record = {
      controller,
      reason,
      token: ++generation,
      timeoutTimer: null,
      timedOut: false,
      hiddenAbort: false,
      stopAbort: false,
      unavailableRendered: false,
    }
    activeRequest = record

    const requestStart = toMillis(now())
    if (requestStart !== null) lastRequestStart = requestStart

    record.timeoutTimer = setTimeoutFn(() => {
      if (activeRequest !== record || stopped || record.unavailableRendered) return
      record.timedOut = true
      record.unavailableRendered = true
      generation += 1
      controller.abort()
      onUnavailable(new Error('live request timed out'))
    }, timeoutMs)

    let requestResult
    try {
      requestResult = request({ signal: controller.signal, reason })
    } catch (error) {
      requestResult = Promise.reject(error)
    }

    Promise.resolve(requestResult)
      .then(async (response) => {
        if (!response || response.ok !== true || typeof response.json !== 'function') {
          throw new Error('live request unavailable')
        }

        const payload = await response.json()
        if (!validatePayload(payload)) throw new Error('live response malformed')
        return payload
      })
      .then(
        (payload) => {
          if (!isCurrent(record)) return
          try {
            onSuccess(payload)
          } catch (error) {
            handleFailure(record, error)
          }
        },
        (error) => handleFailure(record, error),
      )
      .finally(() => finishRequest(record))

    return true
  }

  const start = () => {
    if (started || stopped) return
    started = true
    visible = Boolean(isVisible())
    if (visible) beginRequest('initial')
  }

  const visibilityChanged = (nextVisible) => {
    if (stopped) return

    const wasVisible = visible
    visible = Boolean(nextVisible)

    if (!visible) {
      clearOrdinaryTimer()
      pendingVisibleRefresh = false
      if (activeRequest !== null) {
        if (activeRequest.timeoutTimer !== null) {
          clearTimeoutFn(activeRequest.timeoutTimer)
          activeRequest.timeoutTimer = null
        }
        activeRequest.hiddenAbort = true
        generation += 1
        activeRequest.controller.abort()
      }
      return
    }

    if (!wasVisible) {
      if (activeRequest !== null) {
        pendingVisibleRefresh = true
      } else if (started) {
        beginRequest('visibility')
      }
    }
  }

  const stop = () => {
    if (stopped) return

    stopped = true
    visible = false
    pendingVisibleRefresh = false
    clearOrdinaryTimer()
    generation += 1

    if (activeRequest !== null) {
      if (activeRequest.timeoutTimer !== null) {
        clearTimeoutFn(activeRequest.timeoutTimer)
        activeRequest.timeoutTimer = null
      }
      activeRequest.stopAbort = true
      activeRequest.controller.abort()
    }
  }

  return {
    start,
    visibilityChanged,
    stop,
    cleanup: stop,
  }
}
