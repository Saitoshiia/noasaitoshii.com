#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import {
  access,
  link,
  mkdir,
  open,
  readFile,
  rm,
  stat,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, parse, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)
const KEYCHAIN_SERVICE = 'miinrva.show-media-intake.operator-key'
const KEYCHAIN_ACCOUNT = 'noasaitoshii'
const MANIFEST_NAME = 'show-media-intake-manifest.jsonl'

function isLoopbackOrigin(origin) {
  const url = new URL(origin)
  return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
}

export function validateOrigin(value) {
  const origin = new URL(value)
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Origin must contain only scheme, host, and optional port.')
  }
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && isLoopbackOrigin(origin))) {
    throw new Error('Remote media intake requires HTTPS; HTTP is allowed only on loopback.')
  }
  return origin.origin
}

export function safeStoredFilename({
  createdAt,
  sessionId,
  fileId,
  originalName,
}) {
  const date = new Date(createdAt)
  if (!Number.isFinite(date.getTime())) throw new Error('Submission date is invalid.')
  const day = date.toISOString().slice(0, 10)
  const safeOriginal = basename(String(originalName))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, '-')
    .slice(0, 160) || 'media'
  const session = String(sessionId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
  const file = String(fileId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
  return `${day}_${session}_${file}_${safeOriginal}`
}

async function keychainOperatorKey() {
  const { stdout } = await execFileAsync('security', [
    'find-generic-password',
    '-s', KEYCHAIN_SERVICE,
    '-a', KEYCHAIN_ACCOUNT,
    '-w',
  ], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024,
  })
  const key = stdout.trim()
  if (!key) throw new Error('The media-intake operator key is empty.')
  return key
}

async function operatorHeaders(origin, suppliedKey) {
  if (isLoopbackOrigin(new URL(origin))) return {}
  const key = suppliedKey ?? await keychainOperatorKey()
  return { 'x-media-operator': key }
}

async function readManifest(manifestPath) {
  try {
    const content = await readFile(manifestPath, 'utf8')
    const entries = content.split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    return {
      entries,
      byFileId: new Map(entries.map((entry) => [entry.fileId, entry])),
    }
  } catch (error) {
    if (error.code === 'ENOENT') return { entries: [], byFileId: new Map() }
    throw error
  }
}

async function appendManifest(manifestPath, entry) {
  const handle = await open(manifestPath, 'a', 0o600)
  try {
    await handle.write(`${JSON.stringify(entry)}\n`, null, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function uniqueDestination(outputDir, candidate) {
  const parsed = parse(candidate)
  for (let index = 0; index < 10_000; index += 1) {
    const name = index === 0
      ? candidate
      : `${parsed.name}-${String(index + 1).padStart(2, '0')}${parsed.ext}`
    const destination = join(outputDir, name)
    try {
      await access(destination)
    } catch (error) {
      if (error.code === 'ENOENT') return destination
      throw error
    }
  }
  throw new Error('Unable to allocate a collision-free destination filename.')
}

async function acknowledgeDelivery({
  fetchImpl,
  origin,
  headers,
  sessionId,
  fileId,
  entry,
}) {
  const response = await fetchImpl(
    `${origin}/api/media-intake/operator/sessions/${sessionId}/files/${fileId}/delivered`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        storedName: entry.storedName,
        sha256: entry.sha256,
      }),
    },
  )
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message ?? `Delivery acknowledgement failed (${response.status}).`)
  }
}

async function downloadOne({
  fetchImpl,
  origin,
  headers,
  outputDir,
  session,
  file,
}) {
  const response = await fetchImpl(
    `${origin}/api/media-intake/operator/sessions/${session.id}/files/${file.id}`,
    { headers },
  )
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message ?? `Download failed (${response.status}).`)
  }

  const candidate = safeStoredFilename({
    createdAt: session.createdAt,
    sessionId: session.id,
    fileId: file.id,
    originalName: file.originalName,
  })
  const destination = await uniqueDestination(outputDir, candidate)
  const partial = join(outputDir, `.${basename(destination)}.${randomUUID()}.partial`)
  const sha256 = createHash('sha256')
  const md5 = createHash('md5')
  let bytes = 0

  const verifier = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length
      sha256.update(chunk)
      md5.update(chunk)
      callback(null, chunk)
    },
  })

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      verifier,
      createWriteStream(partial, { flags: 'wx', mode: 0o600 }),
    )

    const expectedBytes = Number(response.headers.get('content-length'))
    if (Number.isSafeInteger(expectedBytes) && expectedBytes >= 0 && expectedBytes !== bytes) {
      throw new Error(`Downloaded byte count mismatch: expected ${expectedBytes}, received ${bytes}.`)
    }

    const expectedEtag = (response.headers.get('x-media-source-etag') ?? '')
      .replace(/^"|"$/g, '')
      .toLowerCase()
    const md5Hex = md5.digest('hex')
    if (/^[a-f0-9]{32}$/.test(expectedEtag) && expectedEtag !== md5Hex) {
      throw new Error('Downloaded content does not match the eligible-store ETag.')
    }

    await link(partial, destination)
    await rm(partial)
    return {
      bytes,
      sha256: sha256.digest('hex'),
      storedName: basename(destination),
      path: destination,
    }
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
}

export async function pullReadyMedia({
  origin: rawOrigin,
  outputDir: rawOutputDir,
  operatorKey,
  fetchImpl = fetch,
  dryRun = false,
}) {
  const origin = validateOrigin(rawOrigin)
  if (!isAbsolute(rawOutputDir)) throw new Error('Output folder must be an absolute path.')
  const outputDir = resolve(rawOutputDir)
  if (outputDir === '/' || outputDir === resolve(homedir())) {
    throw new Error('Refusing to use a filesystem root or the entire home folder as the holding bin.')
  }
  await mkdir(outputDir, { recursive: true, mode: 0o700 })
  const outputStats = await stat(outputDir)
  if (!outputStats.isDirectory()) throw new Error('Output target is not a directory.')
  if ((outputStats.mode & 0o077) !== 0) {
    throw new Error('Holding folder must be private (mode 700, with no group/world access).')
  }

  const headers = await operatorHeaders(origin, operatorKey)
  const listingResponse = await fetchImpl(
    `${origin}/api/media-intake/operator/sessions`,
    { headers },
  )
  if (!listingResponse.ok) {
    const payload = await listingResponse.json().catch(() => ({}))
    throw new Error(payload.message ?? `Operator listing failed (${listingResponse.status}).`)
  }
  const payload = await listingResponse.json()
  const manifestPath = join(outputDir, MANIFEST_NAME)
  const manifest = await readManifest(manifestPath)
  const results = []

  for (const session of payload.sessions ?? []) {
    for (const file of session.files ?? []) {
      if (file.status !== 'ready') continue

      const previous = manifest.byFileId.get(file.id)
      if (previous) {
        if (!dryRun) {
          await acknowledgeDelivery({
            fetchImpl,
            origin,
            headers,
            sessionId: session.id,
            fileId: file.id,
            entry: previous,
          })
        }
        results.push({ status: dryRun ? 'would-acknowledge' : 'acknowledged', ...previous })
        continue
      }

      if (dryRun) {
        results.push({
          status: 'would-download',
          sessionId: session.id,
          fileId: file.id,
          originalName: file.originalName,
          bytes: file.bytes,
        })
        continue
      }

      const downloaded = await downloadOne({
        fetchImpl,
        origin,
        headers,
        outputDir,
        session,
        file,
      })
      const entry = {
        schemaVersion: 1,
        sessionId: session.id,
        fileId: file.id,
        contributorName: session.contributorName || null,
        handle: session.handle || null,
        eventLabel: session.eventLabel || null,
        originalName: file.originalName,
        storedName: downloaded.storedName,
        bytes: downloaded.bytes,
        sha256: downloaded.sha256,
        downloadedAt: new Date().toISOString(),
      }
      await appendManifest(manifestPath, entry)
      manifest.byFileId.set(file.id, entry)
      await acknowledgeDelivery({
        fetchImpl,
        origin,
        headers,
        sessionId: session.id,
        fileId: file.id,
        entry,
      })
      results.push({ status: 'downloaded', ...entry, path: downloaded.path })
    }
  }

  return {
    origin,
    outputDir,
    manifestPath,
    downloaded: results.filter((result) => result.status === 'downloaded').length,
    acknowledged: results.filter((result) => result.status === 'acknowledged').length,
    pending: results.filter((result) => result.status.startsWith('would-')).length,
    results,
  }
}

function parseArguments(argv) {
  const options = {
    origin: 'http://127.0.0.1:8787',
    intervalSeconds: 60,
    watch: false,
    dryRun: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--origin') options.origin = argv[++index]
    else if (argument === '--output') options.outputDir = argv[++index]
    else if (argument === '--watch') options.watch = true
    else if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--interval-seconds') options.intervalSeconds = Number(argv[++index])
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.outputDir) throw new Error('--output /absolute/private/folder is required.')
  if (!Number.isSafeInteger(options.intervalSeconds) || options.intervalSeconds < 15) {
    throw new Error('--interval-seconds must be an integer of at least 15.')
  }
  return options
}

async function runCli() {
  const options = parseArguments(process.argv.slice(2))
  do {
    const summary = await pullReadyMedia(options)
    console.log(JSON.stringify({
      checkedAt: new Date().toISOString(),
      outputDir: summary.outputDir,
      downloaded: summary.downloaded,
      acknowledged: summary.acknowledged,
      pending: summary.pending,
    }))
    if (!options.watch) break
    await new Promise((resolvePromise) => setTimeout(resolvePromise, options.intervalSeconds * 1000))
  } while (true)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    console.error(`Media pull failed: ${error.message}`)
    process.exitCode = 1
  })
}
