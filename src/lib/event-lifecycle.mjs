// Shared with noasaitoshii.com and saitoshiia.com: keep both copies identical.
const PRESERVED_STATUSES = new Set(['past', 'cancelled', 'postponed'])
const UPCOMING_STATUS_ORDER = {
  live: 0,
  upcoming: 1,
  postponed: 2,
  cancelled: 3,
}

export const isPreservedEventStatus = (status) => PRESERVED_STATUSES.has(status)

export const toEpoch = (value) => {
  const epoch = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(epoch) ? epoch : null
}

export const hasValidEventWindow = (event) => {
  const starts = toEpoch(event?.startsAtUtc)
  const ends = toEpoch(event?.endsAtUtc)
  return starts !== null && ends !== null && starts < ends
}

export const getEffectiveEventStatus = (event, now = new Date()) => {
  if (isPreservedEventStatus(event?.status)) return event.status

  const current = toEpoch(now)
  const starts = toEpoch(event?.startsAtUtc)
  const ends = toEpoch(event?.endsAtUtc)
  if (current === null || starts === null || ends === null || starts >= ends) return 'past'
  if (current < starts) return 'upcoming'
  if (current < ends) return 'live'
  return 'past'
}

export const getEventLifecycle = (event, now = new Date()) => {
  const status = getEffectiveEventStatus(event, now)
  return {
    status,
    bucket: status === 'past' ? 'past' : 'upcoming',
    isLive: status === 'live',
    hasValidWindow: hasValidEventWindow(event),
  }
}

const compareEpochs = (left, right) => {
  const leftEpoch = toEpoch(left)
  const rightEpoch = toEpoch(right)
  if (leftEpoch === null && rightEpoch === null) return 0
  if (leftEpoch === null) return 1
  if (rightEpoch === null) return -1
  return leftEpoch - rightEpoch
}

const compareSlugs = (left, right) => String(left?.slug ?? '').localeCompare(String(right?.slug ?? ''))

export const compareUpcomingEvents = (left, right) =>
  (UPCOMING_STATUS_ORDER[left.status] ?? Number.MAX_SAFE_INTEGER) -
    (UPCOMING_STATUS_ORDER[right.status] ?? Number.MAX_SAFE_INTEGER) ||
  compareEpochs(left.startsAtUtc, right.startsAtUtc) ||
  compareSlugs(left, right)

export const comparePastEvents = (left, right) =>
  compareEpochs(right.startsAtUtc, left.startsAtUtc) || compareSlugs(left, right)
