import { events } from '../data/events.js'

const SITE_URL = 'https://noasaitoshii.com'

const escapeXml = (value) => String(value).replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}[character]))

export const GET = ({ site }) => {
  const origin = (site ?? new URL(SITE_URL)).origin
  const paths = [
    '/',
    '/events',
    '/privacy',
    ...events.map((event) => `/events/${event.slug}`),
  ]
  const uniquePaths = [...new Set(paths)]
  const urls = uniquePaths.map((path) => `  <url><loc>${escapeXml(new URL(path, origin).href)}</loc></url>`)
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n')

  return new Response(`${body}\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
