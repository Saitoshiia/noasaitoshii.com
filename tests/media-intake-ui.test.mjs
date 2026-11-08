import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('contributor UI requires explicit permission and an attributable credit choice', async () => {
  const component = await read('src/components/MediaUploadQueue.astro')
  assert.match(component, /name="creditPreference"[\s\S]*required/)
  assert.match(component, /name="confirmsAuthority" required/)
  assert.match(component, /name="grantsMediaLicense" required/)
  assert.match(component, /data-intake-invitation/)
  assert.doesNotMatch(component, /By sending files/)
})

test('contributor client submits the server-owned consent version and supports pending review', async () => {
  const client = await read('src/lib/media-intake-client.js')
  assert.match(client, /consentVersion: config\.consent\.version/)
  assert.match(client, /confirmsAuthority: body\.get\('confirmsAuthority'\) === 'on'/)
  assert.match(client, /grantsMediaLicense: body\.get\('grantsMediaLicense'\) === 'on'/)
  assert.match(client, /'pending_review'/)
})

test('private review UI exposes invitation creation and explicit file decisions', async () => {
  const page = await read('src/pages/send/review.astro')
  const client = await read('src/lib/media-intake-review-client.js')
  assert.match(page, /data-invitation-form/)
  assert.match(page, /One-time recipient/)
  assert.match(page, /Trusted friend/)
  assert.match(client, /actionButton\('Approve', 'approve'/)
  assert.match(client, /actionButton\('Reject', 'reject'/)
  assert.match(client, /JSON\.stringify\(\{ decision \}\)/)
  assert.match(client, /operator\/invitations/)
})

test('media intake surfaces remain out of public navigation and search', async () => {
  const header = await read('src/components/Header.astro')
  const send = await read('src/pages/send.astro')
  const review = await read('src/pages/send/review.astro')

  assert.doesNotMatch(header, /\['\/send', 'Send media'\]/)
  assert.match(send, /noindex=\{true\}/)
  assert.match(review, /noindex=\{true\}/)
})
