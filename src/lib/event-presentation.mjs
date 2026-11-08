const unique = (values) => [...new Set(values.filter(Boolean))]
const KNOWN_DJ_VENUES = new Set([
  'glimmerglade',
  'obsidian',
  'prominence-field-trip',
  'prominence-garden-party',
  'prominence-mainstage',
  'prominence-poolside',
  'the-attic',
])
const isExplicitDjProgram = (event = {}) => {
  const topic = String(event.topic || '').toLowerCase()
  return topic === 'dj set' || topic.includes('dj') || KNOWN_DJ_VENUES.has(String(event.venueSlug || '').toLowerCase())
}
const isLivestream = (event = {}) => {
  if (event.isLivestream === true || event.type === 'stream' || event.streamUrl) return true
  try {
    const host = new URL(event.primaryUrl || '').hostname.replace(/^www\./, '')
    return ['twitch.tv', 'youtube.com', 'youtu.be', 'tiktok.com'].some((domain) => host === domain || host.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

export const getExperienceLabel = (event = {}) => {
  const slug = String(event.venueSlug || '').toLowerCase()
  const title = String(event.title || '').toLowerCase()

  if (slug === 'listening-lounge' || title.includes('listening lounge')) return 'Listening session'
  if (slug === 'sundial-cafe' || title.includes('sundial')) return 'Coworking café'
  if (event.type === 'irl') return 'Live appearance'
  if (event.type === 'metaverse' && isExplicitDjProgram(event)) return 'DJ set'
  if (event.type === 'stream') return event.topic && event.topic !== 'DJ Set' ? event.topic : 'Livestream'
  return 'Event'
}

export const getAttendanceLabels = (event = {}) => unique([
  event.type === 'irl' ? 'In person' : null,
  event.type !== 'irl' && (event.type === 'metaverse' || event.venueSlug || (event.venue && event.venue !== 'Online')) ? 'FFXIV' : null,
  isLivestream(event) ? 'Livestream' : null,
])

const locationForRow = (event = {}) => {
  if (event.type !== 'irl') return null
  const location = String(event.location || '').trim()
  return location && location.toLowerCase() !== String(event.venue || '').trim().toLowerCase() ? location : null
}

export const getEventRowMeta = (event = {}) => {
  const experience = getExperienceLabel(event)
  return {
    experience,
    supporting: unique([...getAttendanceLabels(event), locationForRow(event)])
      .filter((value) => value !== experience),
  }
}

export const getEventRowFacts = (event = {}) => {
  const { experience, supporting } = getEventRowMeta(event)
  return [experience, ...supporting]
}
