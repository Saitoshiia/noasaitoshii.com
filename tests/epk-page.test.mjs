import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { epk } from '../src/data/epk.js'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('EPK route is an intentionally private preview', async () => {
  const page = await read('src/pages/epk.astro')
  const layout = await read('src/layouts/BaseLayout.astro')

  assert.match(page, /<BaseLayout/)
  assert.match(page, /noindex=\{true\}/)
  assert.match(layout, /noindex = false/)
  assert.match(layout, /noindex, nofollow/)
})

test('EPK presents the buyer-facing essentials', async () => {
  const page = await read('src/pages/epk.astro')
  const data = await read('src/data/epk.js')

  for (const signal of [
    'A journey, not a genre shelf',
    'Performance proof',
    'Short biography',
    'Full biography',
    'Email booking inquiry',
  ]) {
    assert.match(page, new RegExp(signal))
  }

  assert.match(data, /relationship: 'Direct support'/)
  assert.match(data, /artist: 'Daxson'/)
  assert.match(data, /href: '\/events\/drop-daxson-aura-2026-07-25'/)
  assert.match(data, /relationship: 'B2B performance'/)
  assert.match(data, /artist: 'Dave Dresden'/)
})

test('EPK remains available by direct preview URL but is not public navigation', async () => {
  const header = await read('src/components/Header.astro')
  const home = await read('src/pages/index.astro')

  assert.doesNotMatch(header, /\['\/epk', 'EPK'\]/)
  assert.doesNotMatch(home, /href="\/epk"/)
  assert.match(home, /mailto:contact@saitoshii\.com/)
})

test('EPK styling uses tokens and accounts for responsive and motion needs', async () => {
  const css = await read('src/styles/epk.css')

  assert.match(css, /var\(--/)
  assert.match(css, /@media \(max-width: 52rem\)/)
  assert.match(css, /@media \(max-width: 42rem\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i)
  assert.doesNotMatch(css, /rgba?\(/i)
  assert.doesNotMatch(css, /hsla?\(/i)
  assert.match(css, /\.epk-portrait__frame img\s*\{[^}]*height:\s*auto[^}]*aspect-ratio:\s*auto/s)
})

test('EPK music selections link to the exact representative recordings', async () => {
  const sets = await read('src/data/sets.js')

  assert.match(sets, /noasaitoshii\/prominence-christmas-garden-party-2025-12-21/)
  assert.match(sets, /noasaitoshii\/obsidian-rave-to-the-grave-2025-10-31/)
  assert.ok(epk.music.every((set) => set.url !== 'https://soundcloud.com/noasaitoshii/tracks'))
})

test('EPK offers a data-derived downloadable biography sheet', async () => {
  const page = await read('src/pages/epk.astro')
  const endpoint = await read('src/pages/epk/bios.txt.js')

  assert.match(page, /href="\/epk\/bios\.txt" download/)
  assert.match(endpoint, /import \{ epk \} from '\.\.\/\.\.\/data\/epk\.js'/)
  assert.match(endpoint, /epk\.shortBio/)
  assert.match(endpoint, /\.\.\.epk\.longBio/)
  assert.match(endpoint, /text\/plain; charset=utf-8/)
})
