// Builds one RFC 5545 calendar file for a site event (the shape from src/data/events.js).

const icsText = (value = '') =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

const icsStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// Lines over 75 octets fold with CRLF plus a space, without splitting a character.
const fold = (line) => {
  const parts = []
  let rest = line
  const limit = () => (parts.length === 0 ? 75 : 74)
  while (Buffer.byteLength(rest) > limit()) {
    let cut = limit()
    while (Buffer.byteLength(rest.slice(0, cut)) > limit()) cut -= 1
    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  parts.push(rest)
  return parts.join('\r\n ')
}

const isUpcoming = (event, now) => Date.parse(event.endsAt ?? event.startsAt) > now.getTime()

export const hasCalendarFile = (event, now = new Date()) =>
  Boolean(event?.startsAt) && !['cancelled', 'postponed'].includes(event.status) && isUpcoming(event, now)

export const buildEventIcs = ({ event, url }) => {
  const watch = event.streamUrl || (event.type === 'stream' ? event.primaryUrl : null)
  const description = [
    event.subtitle,
    event.address && event.type !== 'stream' && `Address: ${event.address}`,
    watch && `Watch: ${watch}`,
    `Details: ${url}`,
  ].filter(Boolean).join('\n')
  const location = event.type === 'stream'
    ? 'Online'
    : [event.venue, event.address || event.location].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Noa Saitoshii//noasaitoshii.com//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.slug}@noasaitoshii.com`,
    `DTSTAMP:${icsStamp(event.startsAt)}`,
    `DTSTART:${icsStamp(event.startsAt)}`,
    `DTEND:${icsStamp(event.endsAt ?? event.startsAt)}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(description)}`,
    location && `LOCATION:${icsText(location)}`,
    `URL:${url}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return `${lines.map(fold).join('\r\n')}\r\n`
}
