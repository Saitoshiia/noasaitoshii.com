import { events, getEventBySlug } from '../../data/events.js'
import { buildEventIcs, hasCalendarFile } from '../../lib/event-ics.mjs'

const buildClock = new Date()

export function getStaticPaths() {
  return events
    .filter((event) => hasCalendarFile(event, buildClock))
    .map((event) => ({ params: { slug: event.slug } }))
}

export function GET({ params, site }) {
  const event = getEventBySlug(params.slug)
  const body = buildEventIcs({ event, url: new URL(`/events/${event.slug}`, site).href })
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } })
}
