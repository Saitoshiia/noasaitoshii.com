// Release marker for the publish step: the live site serves the fingerprint of the event data it was
// built from, so "Synced" in Notion can wait until visitors actually see the new data.
// The fingerprint covers everything visitors see from the bundle and skips the export timestamp.
// Same file as saitoshiia.com/src/pages/sync.json.js. Keep in step with releaseChecksum() in ops/n8n/scripts/lib/public-event-site-publish.mjs (Miinrva root).
import { createHash } from 'node:crypto'
import bundle from '../data/public-events.generated.json' with { type: 'json' }

export function GET() {
  const { schemaVersion, sourceWindow, events, semanticChecksum } = bundle
  const releaseChecksum = createHash('sha256').update(JSON.stringify({ schemaVersion, sourceWindow, events })).digest('hex')
  return new Response(JSON.stringify({ schemaVersion: 1, releaseChecksum, semanticChecksum, exportedEvents: events.length }) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
