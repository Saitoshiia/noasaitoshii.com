export const BOOKING_INQUIRY_PATH = '/api/booking-inquiries'
export const BOOKING_INQUIRY_SCHEMA_VERSION = 'noa-booking-inquiry.v1'
export const BOOKING_INQUIRY_MAX_BODY_BYTES = 32 * 1024

export class BookingInquiryError extends Error {
  constructor(code, message, status = 400, fields = undefined) {
    super(message)
    this.name = 'BookingInquiryError'
    this.code = code
    this.status = status
    this.fields = fields
  }
}

const TEXT_LIMITS = Object.freeze({
  contactName: 100,
  organization: 120,
  eventName: 160,
  inquiryType: 40,
  locationType: 24,
  venueName: 160,
  venueAddress: 240,
  city: 100,
  country: 100,
  ageRestriction: 80,
  productionProvided: 500,
  dataCenter: 100,
  world: 100,
  wardPlot: 100,
  region: 3,
  platform: 100,
  techRequirements: 1000,
  alternateDateNotes: 2000,
  feeNotes: 2000,
  genres: 240,
  vibe: 500,
  notes: 2000,
})

const OPPORTUNITY_TYPES = new Set(['performance', 'collaboration', 'press', 'other'])
const LOCATION_TYPES = new Set(['irl', 'ffxiv', 'stream', 'undecided'])
const REGION_VALUES = new Set(['EU', 'JP', 'NA', 'OCE'])
const OPPORTUNITY_MAP = Object.freeze({
  performance: 'DJ Set',
  collaboration: 'Collab Stream',
  press: 'Interview',
  other: 'Other',
})
const LOCATION_MAP = Object.freeze({
  ffxiv: 'FFXIV',
  stream: 'Stream Only',
  irl: 'IRL',
  undecided: 'Other',
})
const URL_PROTOCOLS = new Set(['https:', 'http:'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BookingInquiryError('invalid_request', `${field} is required.`, 400, [field])
  }
  return value
}

function text(value, field, { required = false, limit = TEXT_LIMITS[field] ?? 255 } = {}) {
  if (value == null || value === '') {
    if (required) throw new BookingInquiryError('validation_failed', `${field} is required.`, 422, [field])
    return ''
  }
  if (typeof value !== 'string') {
    throw new BookingInquiryError('validation_failed', `${field} must be text.`, 422, [field])
  }
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (required && !normalized) {
    throw new BookingInquiryError('validation_failed', `${field} is required.`, 422, [field])
  }
  if (normalized.length > limit) {
    throw new BookingInquiryError('validation_failed', `${field} is too long.`, 422, [field])
  }
  return normalized
}

function url(value, field, { required = false } = {}) {
  const normalized = text(value, field, { required, limit: 500 })
  if (!normalized) return ''
  try {
    const parsed = new URL(normalized)
    if (!URL_PROTOCOLS.has(parsed.protocol) || parsed.username || parsed.password) throw new Error()
    return parsed.href
  } catch {
    throw new BookingInquiryError('validation_failed', `${field} must be a valid HTTP(S) URL.`, 422, [field])
  }
}

function enumValue(value, field, allowed) {
  const normalized = text(value, field, { required: true }).toLowerCase()
  if (!allowed.has(normalized)) {
    throw new BookingInquiryError('validation_failed', `${field} is not supported.`, 422, [field])
  }
  return normalized
}

function email(value) {
  const normalized = text(value, 'email', { required: true, limit: 254 }).toLowerCase()
  if (!EMAIL_PATTERN.test(normalized) || normalized.includes('..')) {
    throw new BookingInquiryError('validation_failed', 'email must be valid.', 422, ['email'])
  }
  return normalized
}

function timezone(value) {
  const normalized = text(value, 'timezone', { required: true, limit: 64 })
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(0)
    return normalized
  } catch {
    throw new BookingInquiryError('validation_failed', 'timezone must be a valid IANA time zone.', 422, ['timezone'])
  }
}

function offsetMinutesAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant)
  const name = parts.find((part) => part.type === 'timeZoneName')?.value
  if (name === 'GMT' || name === 'UTC') return 0
  const match = name?.match(/^GMT([+-])(\d{2}):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

function positiveInteger(value, field, { required = false, max = 24 * 60 } = {}) {
  if ((value == null || value === '') && !required) return null
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(number) || number <= 0 || number > max) {
    throw new BookingInquiryError('validation_failed', `${field} is invalid.`, 422, [field])
  }
  return number
}

function optionalBoolean(value, field, fallback = false) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'boolean') {
    throw new BookingInquiryError('validation_failed', `${field} must be true or false.`, 422, [field])
  }
  return value
}

function nullable(value) {
  return value || null
}

function tags(value, field) {
  const cleaned = text(value, field)
  if (!cleaned) return []
  const values = [...new Set(cleaned
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean))]
  if (values.length > 20 || values.some((entry) => entry.length > 100)) {
    throw new BookingInquiryError(
      'validation_failed',
      `${field} must contain no more than 20 short tags.`,
      422,
      [field],
    )
  }
  return values.sort((left, right) => left.localeCompare(right))
}

function combinedDetails(parts) {
  const value = parts.filter(Boolean).join(' | ')
  return value || null
}

function parseWardPlot(value) {
  const cleaned = text(value, 'wardPlot')
  if (!cleaned) return { ward: null, plot: null }
  const ward = cleaned.match(/\bward\s*#?\s*(\d{1,2})\b/i)?.[1] ?? null
  const plot = cleaned.match(/\bplot\s*#?\s*(\d{1,2})\b/i)?.[1] ?? null
  return ward || plot ? { ward, plot } : { ward: null, plot: null }
}

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

function wallPartsInZone(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

function localTimestamp(value, field, timeZone, { required = true } = {}) {
  const normalized = text(value, field, { required, limit: 30 })
  if (!normalized) return null
  const match = normalized.match(LOCAL_DATETIME_PATTERN)
  if (!match) {
    throw new BookingInquiryError('validation_failed', `${field} must be a local date and time.`, 422, [field])
  }
  const [, year, month, day, hour, minute, rawSecond = '00'] = match
  const wallUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(rawSecond))
  if (!Number.isFinite(wallUtc)) {
    throw new BookingInquiryError('validation_failed', `${field} is invalid.`, 422, [field])
  }

  const offsets = new Set([
    offsetMinutesAt(new Date(wallUtc - 24 * 60 * 60 * 1000), timeZone),
    offsetMinutesAt(new Date(wallUtc), timeZone),
    offsetMinutesAt(new Date(wallUtc + 24 * 60 * 60 * 1000), timeZone),
  ])
  const matches = [...offsets]
    .filter((offset) => offset != null)
    .map((offset) => new Date(wallUtc - offset * 60 * 1000))
    .filter((instant) => {
      const parts = wallPartsInZone(instant, timeZone)
      return parts.year === year
        && parts.month === month
        && parts.day === day
        && parts.hour === hour
        && parts.minute === minute
        && parts.second === rawSecond
    })
  if (matches.length !== 1) {
    throw new BookingInquiryError(
      'validation_failed',
      `${field} is missing or ambiguous in the selected timezone.`,
      422,
      [field, 'timezone'],
    )
  }
  return matches[0].toISOString()
}

export function normalizeBookingInquiry(input) {
  const payload = object(input, 'request')
  const normalizedTimezone = timezone(payload.timezone)
  const start = localTimestamp(payload.startAt, 'startAt', normalizedTimezone)
  const end = localTimestamp(payload.endAt, 'endAt', normalizedTimezone, { required: false })
  if (end && Date.parse(end) <= Date.parse(start)) {
    throw new BookingInquiryError('validation_failed', 'endAt must be after startAt.', 422, ['startAt', 'endAt'])
  }

  const locationType = enumValue(payload.locationType, 'locationType', LOCATION_TYPES)
  const venueName = text(payload.venueName, 'venueName')
  const location = {
    kind: LOCATION_MAP[locationType],
    region: null,
    datacenter: null,
    server: null,
    district: null,
    ward: null,
    plot: null,
    room: null,
    address: null,
  }
  if (locationType === 'irl') {
    const attendance = positiveInteger(payload.estimatedAttendance, 'estimatedAttendance', { max: 10_000_000 })
    location.address = combinedDetails([
      venueName,
      text(payload.venueAddress, 'venueAddress'),
      text(payload.city, 'city'),
      text(payload.country, 'country'),
      attendance ? `Estimated attendance: ${attendance}` : '',
      text(payload.ageRestriction, 'ageRestriction')
        ? `Age restriction: ${text(payload.ageRestriction, 'ageRestriction')}`
        : '',
      text(payload.productionProvided, 'productionProvided')
        ? `Production provided: ${text(payload.productionProvided, 'productionProvided')}`
        : '',
    ])
  }
  if (locationType === 'ffxiv') {
    const rawRegion = text(payload.region, 'region').toUpperCase()
    if (rawRegion && !REGION_VALUES.has(rawRegion)) {
      throw new BookingInquiryError('validation_failed', 'region is not supported.', 422, ['region'])
    }
    const wardPlot = parseWardPlot(payload.wardPlot)
    Object.assign(location, {
      region: nullable(rawRegion),
      datacenter: nullable(text(payload.dataCenter, 'dataCenter')),
      server: nullable(text(payload.world, 'world')),
      ward: wardPlot.ward,
      plot: wardPlot.plot,
      address: combinedDetails([
        venueName,
        !wardPlot.ward && !wardPlot.plot ? text(payload.wardPlot, 'wardPlot') : '',
      ]),
    })
  }
  if (locationType === 'stream') {
    const platform = text(payload.platform, 'platform')
    const channelUrl = url(payload.channelUrl, 'channelUrl')
    if (Boolean(platform) !== Boolean(channelUrl)) {
      throw new BookingInquiryError(
        'validation_failed',
        'Stream platform and channelUrl must be provided together.',
        422,
        ['platform', 'channelUrl'],
      )
    }
    location.address = combinedDetails([
      platform,
      channelUrl,
      text(payload.techRequirements, 'techRequirements'),
    ])
  }
  if (payload.feeAccepted !== true) {
    throw new BookingInquiryError('validation_failed', 'The professional-fee acknowledgement is required.', 422, ['feeAccepted'])
  }
  if (payload.privacyAccepted !== true) {
    throw new BookingInquiryError('validation_failed', 'Privacy consent is required.', 422, ['privacyAccepted'])
  }

  return {
    schemaVersion: BOOKING_INQUIRY_SCHEMA_VERSION,
    source: { channel: 'website' },
    contact: {
      name: text(payload.contactName, 'contactName', { required: true }),
      organization: nullable(text(payload.organization, 'organization')),
      email: email(payload.contactEmail),
      discordUsername: null,
      discordServerUrl: null,
      websiteUrl: nullable(url(payload.website, 'website')),
      otherContact: null,
    },
    opportunity: {
      eventName: text(payload.eventName, 'eventName', { required: true, limit: 240 }),
      inquiryType: OPPORTUNITY_MAP[enumValue(payload.inquiryType, 'inquiryType', OPPORTUNITY_TYPES)],
    },
    schedule: {
      start,
      end,
      timeZone: normalizedTimezone,
      dateFlexible: optionalBoolean(payload.dateFlexible, 'dateFlexible'),
      alternateDateNotes: nullable(text(payload.alternateDateNotes, 'alternateDateNotes')),
    },
    location,
    creative: {
      genres: tags(payload.genres, 'genres'),
      vibes: tags(payload.vibe, 'vibe'),
    },
    commercial: {
      feeAccepted: true,
      feeNotes: nullable(text(payload.feeNotes, 'feeNotes')),
    },
    clientNotes: text(payload.notes, 'notes'),
    consent: {
      privacyAccepted: true,
      contactAllowed: optionalBoolean(payload.contactAllowed, 'contactAllowed', true),
    },
  }
}

export function buildBookingInquiryQueuePacket(inquiry, {
  submissionId,
  submittedAt,
  messageId = submissionId,
  enqueuedAt = submittedAt,
  traceId = null,
} = {}) {
  return {
    schemaVersion: BOOKING_INQUIRY_SCHEMA_VERSION,
    queue: {
      messageId,
      attempt: 1,
      enqueuedAt,
      traceId,
    },
    source: {
      channel: inquiry.source.channel,
      submissionId,
      messageId: null,
      threadId: null,
      submittedAt,
    },
    contact: inquiry.contact,
    opportunity: inquiry.opportunity,
    schedule: inquiry.schedule,
    location: inquiry.location,
    creative: inquiry.creative,
    commercial: inquiry.commercial,
    clientNotes: inquiry.clientNotes,
    consent: inquiry.consent,
  }
}
