import { access, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'
import {
  artifactDigest,
  deferredPublicRoutes,
  htmlUrlAttributes,
  PUBLIC_ARTIFACT_MANIFEST_SCHEMA,
  srcsetCandidates,
  walkFiles,
} from './exclude-deferred-routes.mjs'

const exists = async (path) => {
  try { await access(path); return true } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

const isFile = async (path) => {
  try { return (await stat(path)).isFile() } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

const localTarget = (value, sourceFile, outputDirectory, attribute) => {
  const raw = value.trim()
  if (!raw || raw.startsWith('#') || raw.startsWith('?') || raw.startsWith('//')
    || /^[a-z][a-z\d+.-]*:/i.test(raw)) return null
  if (raw.includes('${')) throw new Error(`Unresolved retained local target: ${raw}`)

  const withoutSuffix = raw.split(/[?#]/, 1)[0]
  let decoded
  try { decoded = decodeURIComponent(withoutSuffix) } catch {
    throw new Error(`Invalid retained local target encoding: ${raw}`)
  }
  const target = decoded.startsWith('/')
    ? resolve(outputDirectory, `.${decoded}`)
    : resolve(dirname(sourceFile), decoded)
  const output = resolve(outputDirectory)
  if (target !== output && !target.startsWith(`${output}${sep}`)) {
    throw new Error(`Retained local target escapes public artifact: ${raw}`)
  }
  return { target, routeLike: attribute === 'href', raw }
}

const targetExists = async ({ target, routeLike }) => {
  if (await isFile(target)) return true
  if (!routeLike) return false
  if (await isFile(`${target}.html`)) return true
  return isFile(join(target, 'index.html'))
}

const verifyRetainedTargets = async (outputDirectory) => {
  const output = resolve(outputDirectory)
  const htmlFiles = (await walkFiles(output)).filter((path) => path.endsWith('.html'))
  for (const file of htmlFiles) {
    const source = await readFile(file, 'utf8')
    for (const attribute of htmlUrlAttributes(source)) {
      const values = attribute.name.endsWith('srcset')
        ? srcsetCandidates(attribute.value)
        : [attribute.value]
      for (const value of values) {
        const target = localTarget(value, file, output, attribute.name)
        if (target && !await targetExists(target)) {
          throw new Error(`Retained local target missing from ${relative(output, file)}: ${target.raw}`)
        }
      }
    }
  }
}

const readManifest = async (manifestPath) => {
  let manifest
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Public artifact prune manifest missing')
    throw new Error(`Public artifact prune manifest invalid: ${error.message}`)
  }
  if (manifest?.schema !== PUBLIC_ARTIFACT_MANIFEST_SCHEMA
    || !Array.isArray(manifest.removedAssets)
    || !Array.isArray(manifest.retainedAssets)
    || typeof manifest.artifactDigest !== 'string') {
    throw new Error('Public artifact prune manifest invalid')
  }
  return manifest
}

export const verifyPublicArtifact = async (outputDirectory, { manifestPath } = {}) => {
  const output = resolve(outputDirectory)
  for (const route of deferredPublicRoutes) {
    for (const path of [route, `${route}.html`]) {
      if (await exists(join(output, path))) {
        throw new Error(`Deferred public artifact remains: ${path}`)
      }
    }
  }
  for (const path of ['index.html', 'events/index.html', 'book/index.html', '404.html', 'favicon.svg']) {
    if (!await isFile(join(output, path))) {
      throw new Error(`Required public artifact missing: ${path}`)
    }
  }

  const manifest = await readManifest(manifestPath)
  for (const path of manifest.removedAssets) {
    if (await exists(join(output, path.slice(1)))) {
      throw new Error(`Deferred-only asset remains: ${path}`)
    }
  }
  for (const path of manifest.retainedAssets) {
    if (!await isFile(join(output, path.slice(1)))) {
      throw new Error(`Retained asset missing: ${path}`)
    }
  }
  await verifyRetainedTargets(output)
  if (await artifactDigest(output) !== manifest.artifactDigest) {
    throw new Error('Public artifact changed after deferred-route exclusion')
  }
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const projectRoot = dirname(dirname(scriptPath))
  await verifyPublicArtifact(join(projectRoot, 'dist'), {
    manifestPath: join(projectRoot, 'build', 'public-artifact-prune.json'),
  })
  process.stdout.write('Public artifact verified: required pages and local targets present, deferred routes and assets absent.\n')
}
