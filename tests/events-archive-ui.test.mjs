import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('event archive exposes upcoming and past appearance ledgers', async () => {
  const page = await read('src/pages/events/index.astro')

  assert.match(page, /getPastEvents, getUpcomingEvents/)
  assert.match(page, /id="upcoming"/)
  assert.match(page, /id="past"/)
  assert.match(page, /data-event-list="upcoming"/)
  assert.match(page, /data-event-list="past"/)
  assert.match(page, /Date\.parse\(row\.dataset\.eventEnd\) > now/)
  assert.match(page, /Date\.parse\(row\.dataset\.eventEnd\) <= now/)
})

test('event presentation uses one shared row component everywhere', async () => {
  const home = await read('src/pages/index.astro')
  const archive = await read('src/pages/events/index.astro')
  const row = await read('src/components/EventRow.astro')

  assert.match(home, /import EventRow/)
  assert.match(home, /<EventRow event=\{event\}/)
  assert.match(archive, /<EventRow event=\{event\} archive/)
  assert.match(row, /<EventTime/)
  assert.match(row, /data-event-archive-row/)
})

test('site navigation and event detail pages route through the archive', async () => {
  const header = await read('src/components/Header.astro')
  const detail = await read('src/pages/events/[slug].astro')

  assert.match(header, /\['\/events', 'Events'\]/)
  assert.match(detail, /href="\/events"/)
  assert.match(detail, /projectEventLifecycle\(event, buildClock\)/)
})

test('compact header follows the adopted symbol-only lockup', async () => {
  const header = await read('src/components/Header.astro')

  assert.match(header, /aria-label="Noa Saitoshii home"/)
  assert.match(header, /<img src="\/favicon\.svg" alt=""/)
  assert.doesNotMatch(header, /<span>Noa Saitoshii<\/span>/)
})

test('event archive styling remains token-governed and responsive', async () => {
  const css = await read('src/styles/events-archive.css')

  assert.match(css, /var\(--/)
  assert.match(css, /@media \(max-width: 42rem\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i)
  assert.doesNotMatch(css, /rgba?\(/i)
  assert.doesNotMatch(css, /hsla?\(/i)
})

test('compact event headings preserve the viewer timezone without clipping', async () => {
  const css = await read('src/styles/global.css')

  assert.match(css, /@media \(max-width: 34rem\)[\s\S]*\.section-heading\s*\{[\s\S]*flex-direction:\s*column/)
  assert.match(css, /\.section-heading \.timezone-note\s*\{[\s\S]*overflow-wrap:\s*anywhere/)
})
