import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bindPageLifecycle,
  createEventLifecycleController,
  createTwitchRefreshController,
  isLivePayload,
  projectEventRuntime,
} from '../src/lib/runtime-freshness.mjs'

const wholeEvent = {
  sourceStatus: 'upcoming',
  eventStartsAt: '2026-09-20T12:00:00Z',
  eventEndsAt: '2026-09-20T18:00:00Z',
  countdownStartsAt: '2026-09-20T12:00:00Z',
  countdownEndsAt: '2026-09-20T18:00:00Z',
}

function fakeClock(start = 0) {
  let current = start
  let nextId = 1
  const timers = new Map()

  const setTimeoutFn = (callback, delay) => {
    const id = nextId++
    timers.set(id, { at: current + Math.max(0, delay), callback })
    return id
  }

  const clearTimeoutFn = (id) => timers.delete(id)

  const advance = async (milliseconds) => {
    const target = current + milliseconds

    while (true) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, left], [, right]) => left.at - right.at)[0]
      if (!due) break

      const [id, timer] = due
      timers.delete(id)
      current = timer.at
      timer.callback()
      await flush()
    }

    current = target
    await flush()
  }

  return {
    now: () => current,
    setTimeoutFn,
    clearTimeoutFn,
    advance,
    pendingCount: () => timers.size,
  }
}

async function flush() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function liveResponse(payload, ok = true) {
  return {
    ok,
    json: async () => payload,
  }
}

function validPayload(mainLive = false, altLive = false) {
  return {
    channels: {
      noasaitoshii: { live: mainLive },
      noasaii: { live: altLive },
    },
  }
}

class EventTargetFixture {
  constructor() {
    this.listeners = new Map()
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, ...event })
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0
  }
}

function twitchController({ clock, visible = true, request, onSuccess, onUnavailable, timeoutMs }) {
  let pageVisible = visible
  const controller = createTwitchRefreshController({
    request,
    onSuccess,
    onUnavailable,
    isVisible: () => pageVisible,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    validatePayload: (payload) => isLivePayload(payload, ['noasaitoshii', 'noasaii']),
    timeoutMs,
  })

  return {
    controller,
    setVisible(nextVisible) {
      pageVisible = nextVisible
      controller.visibilityChanged(nextVisible)
    },
  }
}

test('projects lifecycle at before-start, during, and at-or-after-end boundaries', () => {
  assert.equal(
    projectEventRuntime({ ...wholeEvent, now: '2026-09-20T11:00:00Z' }).status,
    'upcoming',
  )
  assert.equal(
    projectEventRuntime({ ...wholeEvent, now: '2026-09-20T12:00:00Z' }).status,
    'live',
  )
  assert.equal(
    projectEventRuntime({ ...wholeEvent, now: '2026-09-20T17:59:59Z' }).status,
    'live',
  )
  assert.equal(
    projectEventRuntime({ ...wholeEvent, now: '2026-09-20T18:00:00Z' }).status,
    'past',
  )
  assert.equal(
    projectEventRuntime({ ...wholeEvent, now: '2026-09-20T19:00:00Z' }).status,
    'past',
  )
})

test('published follows the time-derived lifecycle and past/completed normalize to past', () => {
  assert.equal(
    projectEventRuntime({
      ...wholeEvent,
      sourceStatus: 'published',
      now: '2026-09-20T13:00:00Z',
    }).status,
    'live',
  )
  assert.equal(
    projectEventRuntime({
      ...wholeEvent,
      sourceStatus: 'past',
      now: '2026-09-20T13:00:00Z',
    }).status,
    'past',
  )
  assert.equal(
    projectEventRuntime({
      ...wholeEvent,
      sourceStatus: 'completed',
      now: '2026-09-20T13:00:00Z',
    }).status,
    'past',
  )
})

test('cancelled and postponed statuses are preserved and suppress countdown copy', () => {
  for (const sourceStatus of ['cancelled', 'postponed']) {
    assert.deepEqual(
      projectEventRuntime({
        ...wholeEvent,
        sourceStatus,
        now: '2026-09-20T13:00:00Z',
      }),
      { status: sourceStatus, countdown: null },
    )
  }
})

test('invalid instants retain source status and suppress a misleading countdown', () => {
  assert.deepEqual(
    projectEventRuntime({
      ...wholeEvent,
      sourceStatus: 'live',
      eventStartsAt: 'not-a-time',
      now: '2026-09-20T13:00:00Z',
    }),
    { status: 'live', countdown: null },
  )
  assert.deepEqual(
    projectEventRuntime({
      ...wholeEvent,
      sourceStatus: 'upcoming',
      countdownStartsAt: 'not-a-time',
      now: '2026-09-20T11:00:00Z',
    }),
    { status: 'upcoming', countdown: null },
  )
})

test('whole-event status timing stays independent from the Noa set countdown window', () => {
  assert.deepEqual(
    projectEventRuntime({
      ...wholeEvent,
      countdownStartsAt: '2026-09-20T15:00:00Z',
      countdownEndsAt: '2026-09-20T16:00:00Z',
      now: '2026-09-20T13:00:00Z',
    }),
    { status: 'live', countdown: 'In 2 hours' },
  )
})

test('countdown preserves representative existing wording', () => {
  assert.equal(
    projectEventRuntime({
      ...wholeEvent,
      now: '2026-09-20T11:30:00Z',
    }).countdown,
    'In 0 hours',
  )
  assert.equal(
    projectEventRuntime({
      ...wholeEvent,
      now: '2026-09-20T08:00:00Z',
    }).countdown,
    'In 4 hours',
  )
  assert.equal(
    projectEventRuntime({
      ...wholeEvent,
      eventStartsAt: '2026-09-23T04:00:00Z',
      eventEndsAt: '2026-09-23T06:00:00Z',
      countdownStartsAt: '2026-09-23T04:00:00Z',
      countdownEndsAt: '2026-09-23T06:00:00Z',
      now: '2026-09-20T00:00:00Z',
    }).countdown,
    'In 3 days · 4 hours',
  )
  assert.equal(
    projectEventRuntime({ ...wholeEvent, now: '2026-09-20T13:00:00Z' }).countdown,
    'Happening now',
  )
  assert.equal(
    projectEventRuntime({ ...wholeEvent, now: '2026-09-20T18:00:00Z' }).countdown,
    'This set has ended',
  )
})

test('event lifecycle controller reconciles immediately, on its minute timer, on return, and stops cleanly', async () => {
  const clock = fakeClock()
  let visible = true
  const renders = []
  const controller = createEventLifecycleController({
    ...wholeEvent,
    now: () => 0,
    isVisible: () => visible,
    render: (value) => renders.push(value),
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  })

  controller.start()
  assert.equal(renders.length, 1)
  assert.equal(clock.pendingCount(), 1)

  await clock.advance(60_000)
  assert.equal(renders.length, 2)

  visible = false
  controller.visibilityChanged(false)
  assert.equal(clock.pendingCount(), 0)
  await clock.advance(60_000)
  assert.equal(renders.length, 2)

  visible = true
  controller.visibilityChanged(true)
  assert.equal(renders.length, 3)
  controller.stop()
  await clock.advance(60_000)
  assert.equal(renders.length, 3)
  assert.equal(clock.pendingCount(), 0)
})

test('event lifecycle controller renders once on a hidden initial load without starting its timer', () => {
  const clock = fakeClock()
  let visible = false
  const renders = []
  const controller = createEventLifecycleController({
    ...wholeEvent,
    now: () => 0,
    isVisible: () => visible,
    render: (value) => renders.push(value),
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  })

  controller.start()
  assert.equal(renders.length, 1)
  assert.equal(clock.pendingCount(), 0)
  visible = true
  controller.visibilityChanged(true)
  assert.equal(renders.length, 2)
  assert.equal(clock.pendingCount(), 1)
  controller.stop()
})

test('visible Twitch start requests immediately while hidden start waits for visibility', async () => {
  const visibleClock = fakeClock()
  const visibleStarts = []
  const visibleHarness = twitchController({
    clock: visibleClock,
    request: ({ reason }) => {
      visibleStarts.push(reason)
      return Promise.resolve(liveResponse(validPayload(true)))
    },
    onSuccess: () => {},
    onUnavailable: assert.fail,
  })
  visibleHarness.controller.start()
  assert.deepEqual(visibleStarts, ['initial'])
  await flush()
  visibleHarness.controller.stop()

  const hiddenClock = fakeClock()
  const hiddenStarts = []
  const hiddenHarness = twitchController({
    clock: hiddenClock,
    visible: false,
    request: ({ reason }) => {
      hiddenStarts.push(reason)
      return Promise.resolve(liveResponse(validPayload()))
    },
    onSuccess: () => {},
    onUnavailable: assert.fail,
  })
  hiddenHarness.controller.start()
  assert.deepEqual(hiddenStarts, [])
  hiddenHarness.setVisible(true)
  assert.deepEqual(hiddenStarts, ['visibility'])
  await flush()
  hiddenHarness.controller.stop()
})

test('ordinary Twitch starts are separated by at least the shared-cache interval', async () => {
  const clock = fakeClock()
  const starts = []
  const harness = twitchController({
    clock,
    request: () => {
      starts.push(clock.now())
      return Promise.resolve(liveResponse(validPayload()))
    },
    onSuccess: () => {},
    onUnavailable: assert.fail,
  })

  harness.controller.start()
  await flush()
  await clock.advance(59_999)
  assert.deepEqual(starts, [0])
  await clock.advance(1)
  assert.deepEqual(starts, [0, 60_000])
  assert.ok(starts[1] - starts[0] >= 60_000)
  harness.controller.stop()
})

test('hiding with no request in flight clears the pending ordinary timer', async () => {
  const clock = fakeClock()
  const starts = []
  const harness = twitchController({
    clock,
    request: () => {
      starts.push(clock.now())
      return Promise.resolve(liveResponse(validPayload()))
    },
    onSuccess: () => {},
    onUnavailable: assert.fail,
  })

  harness.controller.start()
  await flush()
  assert.equal(clock.pendingCount(), 1)
  harness.setVisible(false)
  assert.equal(clock.pendingCount(), 0)
  await clock.advance(120_000)
  assert.deepEqual(starts, [0])
  harness.controller.stop()
})

test('a slow Twitch promise never permits overlapping ordinary requests', async () => {
  const clock = fakeClock()
  const first = deferred()
  let calls = 0
  let active = 0
  let maximum = 0
  const harness = twitchController({
    clock,
    request: () => {
      calls += 1
      active += 1
      maximum = Math.max(maximum, active)
      if (calls === 1) return first.promise.finally(() => { active -= 1 })
      active -= 1
      return Promise.resolve(liveResponse(validPayload()))
    },
    onSuccess: () => {},
    onUnavailable: assert.fail,
    timeoutMs: 200_000,
  })

  harness.controller.start()
  await clock.advance(120_000)
  assert.equal(calls, 1)
  assert.equal(maximum, 1)

  first.resolve(liveResponse(validPayload()))
  await flush()
  harness.controller.stop()
})

test('hide clears the request timeout, aborts in-flight work, and resume queues one refresh after settlement', async () => {
  const clock = fakeClock()
  const first = deferred()
  const starts = []
  const successes = []
  const unavailable = []
  let firstSignal
  const harness = twitchController({
    clock,
    request: ({ signal }) => {
      starts.push(clock.now())
      if (starts.length === 1) {
        firstSignal = signal
        return first.promise
      }
      return Promise.resolve(liveResponse(validPayload(true)))
    },
    onSuccess: (payload) => successes.push(payload),
    onUnavailable: (error) => unavailable.push(error),
  })

  harness.controller.start()
  assert.equal(clock.pendingCount(), 1)
  harness.setVisible(false)
  assert.equal(firstSignal.aborted, true)
  assert.equal(clock.pendingCount(), 0)
  harness.setVisible(true)
  harness.setVisible(true)
  assert.deepEqual(starts, [0])

  first.resolve(liveResponse(validPayload()))
  await flush()
  assert.deepEqual(starts, [0, 0])
  assert.equal(successes.length, 1)
  assert.equal(unavailable.length, 0)
  harness.controller.stop()
})

test('timeout aborts a visible request and renders unavailable exactly once', async () => {
  const clock = fakeClock()
  const unavailable = []
  const successes = []
  let signal
  const pending = deferred()
  const harness = twitchController({
    clock,
    request: ({ signal: requestSignal }) => {
      signal = requestSignal
      return pending.promise
    },
    onSuccess: (payload) => successes.push(payload),
    onUnavailable: (error) => unavailable.push(error),
  })

  harness.controller.start()
  await clock.advance(9_999)
  assert.equal(unavailable.length, 0)
  await clock.advance(1)
  await flush()
  assert.equal(unavailable.length, 1)
  assert.equal(signal.aborted, true)
  pending.resolve(liveResponse(validPayload()))
  await flush()
  assert.equal(successes.length, 0)
  assert.equal(unavailable.length, 1)
  harness.controller.stop()
  assert.equal(clock.pendingCount(), 0)
})

test('page lifecycle binding handles BFCache suspension, hidden restoration, one resume per return, and final cleanup', () => {
  const documentRef = new EventTargetFixture()
  const windowRef = new EventTargetFixture()
  let hidden = false
  const visibilitySignals = []
  let stopCalls = 0
  const controller = {
    visibilityChanged: (visible) => visibilitySignals.push(visible),
    stop: () => { stopCalls += 1 },
  }
  bindPageLifecycle({
    controller,
    documentRef,
    windowRef,
    isVisible: () => !hidden,
  })

  windowRef.dispatch('pagehide', { persisted: true })
  hidden = true
  documentRef.dispatch('visibilitychange')
  windowRef.dispatch('pageshow', { persisted: true })
  assert.deepEqual(visibilitySignals, [false])

  hidden = false
  documentRef.dispatch('visibilitychange')
  documentRef.dispatch('visibilitychange')
  assert.deepEqual(visibilitySignals, [false, true])

  windowRef.dispatch('pagehide', { persisted: true })
  hidden = true
  documentRef.dispatch('visibilitychange')
  windowRef.dispatch('pageshow', { persisted: true })
  hidden = false
  documentRef.dispatch('visibilitychange')
  windowRef.dispatch('pageshow', { persisted: true })
  assert.deepEqual(visibilitySignals, [false, true, false, true])

  windowRef.dispatch('pagehide', { persisted: false })
  assert.equal(stopCalls, 1)
  assert.equal(documentRef.listenerCount('visibilitychange'), 0)
  assert.equal(windowRef.listenerCount('pagehide'), 0)
  assert.equal(windowRef.listenerCount('pageshow'), 0)
  documentRef.dispatch('visibilitychange')
  windowRef.dispatch('pageshow', { persisted: true })
  windowRef.dispatch('pagehide', { persisted: true })
  assert.deepEqual(visibilitySignals, [false, true, false, true])
  assert.equal(stopCalls, 1)
})

test('non-OK, malformed, and rejected requests all use the unavailable fallback', async () => {
  const cases = [
    () => Promise.resolve(liveResponse(validPayload(), false)),
    () => Promise.resolve(liveResponse({ channels: { noasaitoshii: { live: 'yes' }, noasaii: {} } })),
    () => Promise.reject(new Error('network-like failure')),
  ]

  for (const makeRequest of cases) {
    const clock = fakeClock()
    const unavailable = []
    const harness = twitchController({
      clock,
      request: makeRequest,
      onSuccess: assert.fail,
      onUnavailable: (error) => unavailable.push(error),
    })
    harness.controller.start()
    await flush()
    assert.equal(unavailable.length, 1)
    harness.controller.stop()
  }
})

test('stop aborts and clears all callbacks so stale completion cannot mutate the page', async () => {
  const clock = fakeClock()
  const pending = deferred()
  const successes = []
  const unavailable = []
  const harness = twitchController({
    clock,
    request: () => pending.promise,
    onSuccess: (payload) => successes.push(payload),
    onUnavailable: (error) => unavailable.push(error),
  })

  harness.controller.start()
  assert.equal(clock.pendingCount(), 1)
  harness.controller.stop()
  assert.equal(clock.pendingCount(), 0)
  pending.resolve(liveResponse(validPayload(true)))
  await flush()
  await clock.advance(120_000)
  assert.equal(successes.length, 0)
  assert.equal(unavailable.length, 0)
  assert.equal(clock.pendingCount(), 0)
})
