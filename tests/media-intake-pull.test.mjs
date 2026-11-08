import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  pullReadyMedia,
  safeStoredFilename,
  validateOrigin,
} from '../tools/pull-show-media.mjs'

test('validates operator origins and collision-safe stored names', () => {
  assert.equal(validateOrigin('http://127.0.0.1:8787'), 'http://127.0.0.1:8787')
  assert.equal(validateOrigin('https://noasaitoshii.com'), 'https://noasaitoshii.com')
  assert.throws(() => validateOrigin('http://noasaitoshii.com'))
  assert.throws(() => validateOrigin('https://example.com/path'))
  assert.equal(safeStoredFilename({
    createdAt: '2026-07-28T12:00:00.000Z',
    sessionId: 'session-123456',
    fileId: 'file-abcdef',
    originalName: '../../café clip.mov',
  }), '2026-07-28_session1_fileabcd_cafe-clip.mov')
})

test('pulls ready media atomically, records a manifest, and acknowledges delivery', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'show-media-pull-'))
  const fixture = new TextEncoder().encode('verified-media-fixture')
  const etag = createHash('md5').update(fixture).digest('hex')
  let delivered = false
  const requests = []

  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })
    if (url.endsWith('/api/media-intake/operator/sessions')) {
      return Response.json({
        sessions: [{
          id: 'session-123456',
          createdAt: '2026-07-28T12:00:00.000Z',
          contributorName: 'Friend',
          handle: '@friend',
          eventLabel: 'Pilot show',
          files: [{
            id: 'file-abcdef',
            originalName: 'clip.mov',
            bytes: fixture.length,
            status: delivered ? 'delivered' : 'ready',
          }],
        }],
      })
    }
    if (url.endsWith('/delivered')) {
      delivered = true
      return Response.json({ status: 'delivered' })
    }
    return new Response(fixture, {
      headers: {
        'content-length': String(fixture.length),
        'content-type': 'video/quicktime',
        'x-media-source-etag': etag,
      },
    })
  }

  const summary = await pullReadyMedia({
    origin: 'http://127.0.0.1:8787',
    outputDir,
    fetchImpl,
  })
  assert.equal(summary.downloaded, 1)
  assert.equal(delivered, true)
  assert.equal(new Uint8Array(await readFile(summary.results[0].path)).toString(), fixture.toString())

  const manifest = (await readFile(summary.manifestPath, 'utf8')).trim().split('\n').map(JSON.parse)
  assert.equal(manifest.length, 1)
  assert.equal(manifest[0].fileId, 'file-abcdef')
  assert.equal(manifest[0].sha256, createHash('sha256').update(fixture).digest('hex'))
  assert.equal(requests.some((request) => request.url.endsWith('/delivered')), true)

  const second = await pullReadyMedia({
    origin: 'http://127.0.0.1:8787',
    outputDir,
    fetchImpl,
  })
  assert.equal(second.downloaded, 0)
})

test('dry-run reports ready media without downloading or acknowledging', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'show-media-dry-run-'))
  let writes = 0
  const fetchImpl = async (url) => {
    if (url.endsWith('/api/media-intake/operator/sessions')) {
      return Response.json({
        sessions: [{
          id: 'session',
          createdAt: '2026-07-28T12:00:00.000Z',
          files: [{ id: 'file', originalName: 'photo.jpg', bytes: 5, status: 'ready' }],
        }],
      })
    }
    writes += 1
    return Response.json({})
  }
  const summary = await pullReadyMedia({
    origin: 'http://127.0.0.1:8787',
    outputDir,
    fetchImpl,
    dryRun: true,
  })
  assert.equal(summary.pending, 1)
  assert.equal(writes, 0)
})

test('recovers from an acknowledgement failure without downloading a duplicate', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'show-media-recovery-'))
  const fixture = new TextEncoder().encode('delivery-recovery-fixture')
  const etag = createHash('md5').update(fixture).digest('hex')
  let acknowledgements = 0
  let downloads = 0

  const fetchImpl = async (url) => {
    if (url.endsWith('/api/media-intake/operator/sessions')) {
      return Response.json({
        sessions: [{
          id: 'recovery-session',
          createdAt: '2026-07-28T12:00:00.000Z',
          files: [{
            id: 'recovery-file',
            originalName: 'recovery.mov',
            bytes: fixture.length,
            status: 'ready',
          }],
        }],
      })
    }
    if (url.endsWith('/delivered')) {
      acknowledgements += 1
      return acknowledgements === 1
        ? Response.json({ message: 'temporary acknowledgement failure' }, { status: 503 })
        : Response.json({ status: 'delivered' })
    }
    downloads += 1
    return new Response(fixture, {
      headers: {
        'content-length': String(fixture.length),
        'x-media-source-etag': etag,
      },
    })
  }

  await assert.rejects(
    pullReadyMedia({
      origin: 'http://127.0.0.1:8787',
      outputDir,
      fetchImpl,
    }),
    /temporary acknowledgement failure/,
  )
  assert.equal(downloads, 1)

  const recovered = await pullReadyMedia({
    origin: 'http://127.0.0.1:8787',
    outputDir,
    fetchImpl,
  })
  assert.equal(recovered.downloaded, 0)
  assert.equal(recovered.acknowledged, 1)
  assert.equal(downloads, 1)
})

test('removes a partial download when eligible-store integrity verification fails', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'show-media-integrity-'))
  const fixture = new TextEncoder().encode('tampered-media-fixture')
  const fetchImpl = async (url) => {
    if (url.endsWith('/api/media-intake/operator/sessions')) {
      return Response.json({
        sessions: [{
          id: 'integrity-session',
          createdAt: '2026-07-28T12:00:00.000Z',
          files: [{
            id: 'integrity-file',
            originalName: 'integrity.mov',
            bytes: fixture.length,
            status: 'ready',
          }],
        }],
      })
    }
    return new Response(fixture, {
      headers: {
        'content-length': String(fixture.length),
        'x-media-source-etag': '0'.repeat(32),
      },
    })
  }

  await assert.rejects(
    pullReadyMedia({
      origin: 'http://127.0.0.1:8787',
      outputDir,
      fetchImpl,
    }),
    /does not match/,
  )
  assert.deepEqual(await readdir(outputDir), [])
})
