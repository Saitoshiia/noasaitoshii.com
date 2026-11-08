import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('booking route fails over honestly to approved direct contact paths', async () => {
  const page = await read('src/pages/book.astro')
  assert.match(page, /<BaseLayout/)
  assert.match(page, /noindex=\{true\}/)
  assert.match(page, /mailto:contact@saitoshii\.com/)
  assert.match(page, /https:\/\/www\.instagram\.com\/noasaitoshii/)
  assert.doesNotMatch(page, /<BookingInquiryForm \/>/)
  assert.match(page, /booking-inquiry\.css/)
})

test('shared top navigation does not advertise the unactivated booking route', async () => {
  const header = await read('src/components/Header.astro')
  assert.doesNotMatch(header, /\['\/book', 'Book'\]/)
})

test('booking form exposes the stable request contract and accessible flow', async () => {
  const form = await read('src/components/BookingInquiryForm.astro')
  for (const name of [
    'eventName', 'inquiryType', 'locationType', 'contactName', 'contactEmail',
    'organization', 'website', 'startAt', 'endAt', 'timezone', 'feeAccepted',
    'genres', 'vibe', 'notes',
  ]) {
    assert.match(form, new RegExp(`name="${name}"`), `missing ${name}`)
  }
  assert.match(form, /data-location-section="irl"/)
  assert.match(form, /data-location-section="ffxiv"/)
  assert.match(form, /data-location-section="stream"/)
  assert.match(form, /role="alert"/)
  assert.match(form, /aria-live="polite"/)
  assert.match(form, /name="companyFax"/)
})

test('client posts JSON to the booking endpoint and handles all visible states', async () => {
  const client = await read('src/lib/booking-inquiry-client.js')
  assert.match(client, /fetch\('\/api\/booking-inquiries'/)
  assert.match(client, /'content-type': 'application\/json'/)
  assert.match(client, /JSON\.stringify/)
  assert.match(client, /toRequestPayload/)
  assert.match(client, /companyFax/)
  assert.match(client, /turnstileToken/)
  for (const state of ['pending', 'success', 'error']) {
    assert.match(client, new RegExp(`dataset\\.state = '${state}'`))
  }
  assert.match(client, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/)
})

test('booking styles are responsive and reduced-motion aware', async () => {
  const form = await read('src/components/BookingInquiryForm.astro')
  const css = await read('src/styles/booking-inquiry.css')
  assert.match(css, /@media \(max-width: 42rem\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /\.booking-inquiry__/)
  assert.match(form, /class="button booking-inquiry__button"[^>]*data-review-button/)
  assert.match(form, /class="button button--secondary booking-inquiry__button"[^>]*data-edit-button/)
  assert.doesNotMatch(css, /\.booking-inquiry__button\s*\{[^}]*border-radius/s)
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i)
  assert.doesNotMatch(css, /rgba?\(/i)
})
