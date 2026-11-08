const EVENT_TYPES = new Set(['metaverse', 'irl', 'stream'])
const LINEUP_STATUSES = new Set(['tba', 'confirmed', 'not-applicable'])
const EVENT_STATUSES = new Set(['upcoming', 'live', 'past', 'cancelled', 'postponed', 'published'])
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const SLUG = /^[a-z0-9][a-z0-9-]*$/
const FORBIDDEN_KEY = /notion|token|secret|staff|private|apiKey/i
const EVENT_KEYS = new Set([
  'slug', 'title', 'subtitle', 'type', 'startsAt', 'endsAt', 'noaStartsAt',
  'noaEndsAt', 'eventTimeZone', 'venue', 'location', 'address', 'genre',
  'theme', 'status', 'cta', 'primaryUrl', 'secondaryUrl', 'lineupStatus',
  'lineup', 'setTimes', 'topic', 'streamUrl', 'venueSlug',
  'isLivestream',
])
const ARTIST_KEYS = new Set(['name', 'url'])
const SET_KEYS = new Set(['name', 'startsAtUtc', 'endsAtUtc', 'stage', 'stageOrder', 'streamUrl'])

const isString = (value) => typeof value === 'string' && value.trim().length > 0
const isUtcIso = (value) => typeof value === 'string' && UTC_ISO.test(value) && Number.isFinite(Date.parse(value))
const isUrl = (value) => {
  if (value === null || value === undefined) return true
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
const hasForbiddenKey = (value) => value && typeof value === 'object' && Object.entries(value).some(
  ([key, child]) => FORBIDDEN_KEY.test(key) || hasForbiddenKey(child),
)
const exactKeys = (value, allowed, label, errors) => {
  for (const key of Object.keys(value ?? {})) {
    if (!allowed.has(key)) errors.push(`${label}.${key} is not an allowed public field`)
  }
}

export function validateEvents(events) {
  const errors = []
  const slugs = new Set()
  if (!Array.isArray(events)) return { errors: ['events must be an array'] }

  events.forEach((event, index) => {
    const label = `events[${index}]`
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (hasForbiddenKey(event)) errors.push(`${label} contains a forbidden private key`)
    exactKeys(event, EVENT_KEYS, label, errors)
    if (!isString(event.slug) || !SLUG.test(event.slug)) errors.push(`${label}.slug is invalid`)
    if (slugs.has(event.slug)) errors.push(`${label}.slug duplicates ${event.slug}`)
    slugs.add(event.slug)
    for (const key of ['title', 'subtitle', 'venue', 'location', 'status', 'cta', 'eventTimeZone']) {
      if (!isString(event[key])) errors.push(`${label}.${key} is required`)
    }
    if (event.type !== 'stream' && !isString(event.address)) errors.push(`${label}.address is required`)
    if (event.type !== 'stream' && !isString(event.genre)) errors.push(`${label}.genre is required`)
    if (event.type === 'stream' && !isString(event.topic)) errors.push(`${label}.topic is required for streams`)
    if (event.type === 'stream' && (!isString(event.primaryUrl) || !isUrl(event.primaryUrl))) errors.push(`${label}.primaryUrl is required for streams`)
    if (!EVENT_TYPES.has(event.type)) errors.push(`${label}.type is invalid`)
    if (event.isLivestream !== undefined && typeof event.isLivestream !== 'boolean') errors.push(`${label}.isLivestream must be boolean`)
    if (event.isLivestream === true && event.type === 'irl') errors.push(`${label}.isLivestream is only valid for virtual events`)
    if (!LINEUP_STATUSES.has(event.lineupStatus)) errors.push(`${label}.lineupStatus is invalid`)
    if (!EVENT_STATUSES.has(event.status)) errors.push(`${label}.status is invalid`)
    for (const key of ['startsAt', 'endsAt']) {
      if (!isUtcIso(event[key])) errors.push(`${label}.${key} must be an ISO-8601 UTC timestamp ending in Z`)
    }
    if (isUtcIso(event.startsAt) && isUtcIso(event.endsAt) && Date.parse(event.startsAt) >= Date.parse(event.endsAt)) {
      errors.push(`${label}.startsAt must be before endsAt`)
    }
    if ((event.noaStartsAt === null) !== (event.noaEndsAt === null)) {
      errors.push(`${label}.noaStartsAt and noaEndsAt must both be null or both be timestamps`)
    }
    if (event.noaStartsAt !== null && (!isUtcIso(event.noaStartsAt) || !isUtcIso(event.noaEndsAt))) {
      errors.push(`${label}.noaStartsAt and noaEndsAt must be UTC timestamps`)
    }
    if (isUtcIso(event.noaStartsAt) && isUtcIso(event.noaEndsAt)) {
      if (Date.parse(event.noaStartsAt) >= Date.parse(event.noaEndsAt)) errors.push(`${label}.noaStartsAt must be before noaEndsAt`)
      if (Date.parse(event.noaStartsAt) < Date.parse(event.startsAt) || Date.parse(event.noaEndsAt) > Date.parse(event.endsAt)) {
        errors.push(`${label}.Noa set must be within the event window`)
      }
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: event.eventTimeZone })
    } catch {
      errors.push(`${label}.eventTimeZone must be a valid IANA time zone`)
    }
    for (const key of ['primaryUrl', 'secondaryUrl', 'streamUrl']) {
      if (!isUrl(event[key])) errors.push(`${label}.${key} must be null or an http(s) URL`)
    }
    if (!Array.isArray(event.lineup) || !Array.isArray(event.setTimes)) {
      errors.push(`${label}.lineup and setTimes must be arrays`)
      return
    }
    event.lineup.forEach((artist, artistIndex) => {
      exactKeys(artist, ARTIST_KEYS, `${label}.lineup[${artistIndex}]`, errors)
      if (!isString(artist?.name)) errors.push(`${label}.lineup[${artistIndex}].name is required`)
      if (!isUrl(artist?.url)) errors.push(`${label}.lineup[${artistIndex}].url must be an http(s) URL`)
    })
    let previous = -Infinity
    let previousStageOrder = -Infinity
    const staged = event.setTimes.some((set) => Boolean(set?.stage))
    const names = new Set(event.lineup.map((artist) => artist.name))
    event.setTimes.forEach((set, setIndex) => {
      const setLabel = `${label}.setTimes[${setIndex}]`
      exactKeys(set, SET_KEYS, setLabel, errors)
      if (!isString(set?.name)) errors.push(`${setLabel}.name is required`)
      if (staged && !isString(set?.stage)) errors.push(`${setLabel}.stage is required for a multi-stage event`)
      if (staged && (!Number.isInteger(set?.stageOrder) || set.stageOrder < 1)) {
        errors.push(`${setLabel}.stageOrder must be an integer >= 1 for a multi-stage event`)
      }
      if (!staged && (set?.stage !== undefined || set?.stageOrder !== undefined)) {
        errors.push(`${setLabel}.stage and stageOrder must either be present on every set or omitted`)
      }
      if (!isUtcIso(set?.startsAtUtc) || !isUtcIso(set?.endsAtUtc)) errors.push(`${setLabel} requires UTC start and end`)
      if (!isUrl(set?.streamUrl)) errors.push(`${setLabel}.streamUrl must be an http(s) URL`)
      if (isUtcIso(set?.startsAtUtc) && isUtcIso(set?.endsAtUtc)) {
        const start = Date.parse(set.startsAtUtc)
        const end = Date.parse(set.endsAtUtc)
        if (start >= end) errors.push(`${setLabel}.startsAtUtc must be before endsAtUtc`)
        if (start < Date.parse(event.startsAt) || end > Date.parse(event.endsAt)) errors.push(`${setLabel} must be within the event window`)
        if (staged && set.stageOrder < previousStageOrder) {
          errors.push(`${label}.setTimes must be ordered by stageOrder, then startsAtUtc`)
        }
        if (staged && set.stageOrder === previousStageOrder && start < previous) {
          errors.push(`${label}.setTimes must be ordered by stageOrder, then startsAtUtc`)
        }
        if (!staged && start < previous) errors.push(`${label}.setTimes must be ordered`)
        if (staged && set.stageOrder !== previousStageOrder) previous = -Infinity
        previousStageOrder = staged ? set.stageOrder : previousStageOrder
        previous = start
      }
      if (set?.name && !names.has(set.name)) errors.push(`${setLabel}.name is missing from lineup`)
      if (event.type === 'irl' && set?.streamUrl) errors.push(`${setLabel}.streamUrl must be omitted for IRL events`)
    })
    if (event.lineupStatus === 'tba' && (event.lineup.length || event.setTimes.length)) {
      errors.push(`${label} must not expose lineup or set times while lineupStatus is tba`)
    }
    if (event.lineupStatus === 'confirmed' && (!event.lineup.length || !event.setTimes.length)) {
      errors.push(`${label} must include lineup and set times while lineupStatus is confirmed`)
    }
    if (event.lineupStatus === 'not-applicable' && (event.type !== 'stream' || event.lineup.length || event.setTimes.length)) {
      errors.push(`${label} must be a stream without lineup or set times while lineupStatus is not-applicable`)
    }
  })
  return { errors }
}
