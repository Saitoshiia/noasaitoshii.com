import assert from 'node:assert/strict'
import test from 'node:test'
import { getLivePresentationAt, getTwitchChannel, getTwitchEmbedUrl } from '../src/lib/live-events.mjs'

test('extracts Twitch channel logins and rejects everything else', () => {
  assert.equal(getTwitchChannel('https://www.twitch.tv/NoaSaitoshii'), 'noasaitoshii')
  assert.equal(getTwitchChannel('https://twitch.tv/saitoshiia/'), 'saitoshiia')
  assert.equal(getTwitchChannel('https://www.twitch.tv/videos/123456'), null)
  assert.equal(getTwitchChannel('https://youtube.com/@noasaitoshii'), null)
  assert.equal(getTwitchChannel('https://evil.example/twitch.tv/x'), null)
  assert.equal(getTwitchChannel('not a url'), null)
})

test('builds a muted player URL bound to the embedding host', () => {
  const url = new URL(getTwitchEmbedUrl('https://www.twitch.tv/noasaitoshii', 'noasaitoshii.com'))
  assert.equal(url.origin, 'https://player.twitch.tv')
  assert.equal(url.searchParams.get('channel'), 'noasaitoshii')
  assert.equal(url.searchParams.get('parent'), 'noasaitoshii.com')
  assert.equal(url.searchParams.get('muted'), 'true')
  assert.equal(new URL(getTwitchEmbedUrl('https://www.twitch.tv/noasaitoshii', 'x.com', { muted: false })).searchParams.get('muted'), 'false')
  assert.equal(getTwitchEmbedUrl('https://www.twitch.tv/noasaitoshii', ''), null)
  assert.equal(getTwitchEmbedUrl('https://youtube.com/live', 'noasaitoshii.com'), null)
})

test('current set stream wins over the event stream while live', () => {
  const event = {
    status: 'upcoming',
    title: 'Test Night',
    startsAtUtc: '2026-10-31T02:00:00Z',
    endsAtUtc: '2026-10-31T06:00:00Z',
    streamUrl: 'https://www.twitch.tv/saitoshiia',
    setTimes: [{ name: 'Noa', startsAtUtc: '2026-10-31T03:00:00Z', endsAtUtc: '2026-10-31T04:00:00Z', streamUrl: 'https://www.twitch.tv/noasaitoshii' }],
  }
  const presentation = getLivePresentationAt(event, new Date('2026-10-31T03:30:00Z'))
  assert.equal(presentation.currentSet.name, 'Noa')
  assert.equal(getTwitchChannel(presentation.streamUrl), 'noasaitoshii')
  assert.equal(getLivePresentationAt(event, new Date('2026-10-31T07:00:00Z')), null)
})
