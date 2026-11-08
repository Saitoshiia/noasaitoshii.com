const FALLBACK_TIME_ZONE = 'UTC'

export const isValidTimeZone = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export const normalizeTimeZone = (value, fallback = FALLBACK_TIME_ZONE) =>
  isValidTimeZone(value) ? value : fallback

export const getViewerTimeZone = (intl = globalThis.Intl) => {
  try {
    const zone = intl?.DateTimeFormat?.().resolvedOptions?.().timeZone
    return isValidTimeZone(zone) ? zone : null
  } catch {
    return null
  }
}

export const formatEventWindow = (startsAt, endsAt, timeZone = FALLBACK_TIME_ZONE, locale = 'en-US') => {
  const zone = normalizeTimeZone(timeZone)
  const start = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startsAt))

  if (!endsAt) return start

  const sameDay = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(startsAt)) === new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(endsAt))

  const end = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    ...(sameDay ? {} : { weekday: 'short', month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(endsAt))

  return `${start} – ${end}`
}

export const formatEventDate = (startsAt, timeZone = FALLBACK_TIME_ZONE, locale = 'en-US') =>
  new Intl.DateTimeFormat(locale, {
    timeZone: normalizeTimeZone(timeZone),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(startsAt))

export const formatEventRange = (startsAt, endsAt, timeZone = FALLBACK_TIME_ZONE, locale = 'en-US') => {
  const zone = normalizeTimeZone(timeZone)
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : null
  const time = (date, includeZone = false) => new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
    ...(includeZone ? { timeZoneName: 'short' } : {}),
  }).format(date)
  if (!end || !Number.isFinite(end.getTime())) return time(start, true)
  const sameDate = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(start) === new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(end)
  return `${time(start)}–${time(end, true)}${sameDate ? '' : ' (+1 day)'}`
}

export const formatEventStamp = (startsAt, timeZone = FALLBACK_TIME_ZONE, locale = 'en-US') =>
  new Intl.DateTimeFormat(locale, {
    timeZone: normalizeTimeZone(timeZone),
    month: 'short',
    day: '2-digit',
    weekday: 'short',
  }).format(new Date(startsAt)).replace(',', ' ·')

export const getTimeZoneLabel = (timeZone, valid = isValidTimeZone(timeZone)) =>
  valid ? timeZone : `${FALLBACK_TIME_ZONE} fallback, source timezone unavailable`

export const getReadableTimeZoneLabel = (timeZone, date = new Date(), locale = 'en-US') => {
  if (!isValidTimeZone(timeZone)) return `${FALLBACK_TIME_ZONE} fallback`
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'long',
  }).formatToParts(new Date(date))
  const name = parts.find((part) => part.type === 'timeZoneName')?.value
  return name?.replace(/ (?:Standard|Daylight) Time$/, ' Time') || timeZone
}
