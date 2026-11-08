import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'

export const deferredPublicRoutes = ['epk', 'send']
export const PUBLIC_ARTIFACT_MANIFEST_SCHEMA = 'noa-public-artifact-prune/v1'

export const walkFiles = async (directory) => {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walkFiles(path))
    else files.push(path)
  }
  return files
}

const isDeferredPath = (path) => deferredPublicRoutes.some((route) => (
  path === `${route}.html` || path === route || path.startsWith(`${route}${sep}`)
))

const URL_ATTRIBUTE_RE = /\b(src|href|srcset|imagesrcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi

export const htmlUrlAttributes = (source) => [...source.matchAll(URL_ATTRIBUTE_RE)].map((match) => ({
  name: match[1].toLowerCase(),
  value: match[2] ?? match[3] ?? match[4] ?? '',
}))

export const srcsetCandidates = (value) => value.split(',')
  .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
  .filter(Boolean)

const cleanAssetReference = (value) => value.trim().split(/[?#]/, 1)[0]
const isPotentialAssetReference = (value) => value.startsWith('/_astro/')
  || value.startsWith('./')
  || value.startsWith('../')

const isDynamicLiteral = (source, match) => {
  const before = source.slice(0, match.index)
  const after = source.slice(match.index + match[0].length)
  return /\+\s*$/.test(before)
    || /^\s*\+/.test(after)
    || /^\s*\.concat\s*\(/.test(after)
}

export const sourceAssetReferences = (source) => {
  const references = new Set()
  const unresolved = new Set()

  const add = (rawValue) => {
    const value = cleanAssetReference(rawValue)
    if (!isPotentialAssetReference(value)) return
    if (value.includes('${')) {
      unresolved.add(value)
      return
    }
    if (/[\s,]/.test(value)) return
    references.add(value)
  }

  for (const attribute of htmlUrlAttributes(source)) {
    const values = attribute.name.endsWith('srcset')
      ? srcsetCandidates(attribute.value)
      : [attribute.value]
    for (const value of values) add(value)
  }

  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s"')]+))\s*\)/gi)) {
    add(match[1] ?? match[2] ?? match[3] ?? '')
  }

  for (const match of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
    const value = match[1] ?? match[2] ?? match[3] ?? ''
    const cleaned = cleanAssetReference(value)
    if (isPotentialAssetReference(cleaned) && isDynamicLiteral(source, match)) {
      unresolved.add(cleaned)
    } else {
      add(value)
    }
  }

  return { references: [...references], unresolved: [...unresolved] }
}

const resolveAstroAsset = (reference, sourceFile, outputDirectory) => {
  const assetRoot = resolve(outputDirectory, '_astro')
  const path = reference.startsWith('/_astro/')
    ? resolve(outputDirectory, `.${reference}`)
    : resolve(dirname(sourceFile), reference)
  return path.startsWith(`${assetRoot}${sep}`) ? path : null
}

const collectDirectAstroAssetReferences = async (files, outputDirectory) => {
  const references = new Set()

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const extracted = sourceAssetReferences(source)
    if (extracted.unresolved.length) {
      throw new Error(`Unresolved Astro asset reference in ${relative(outputDirectory, file)}: ${extracted.unresolved.join(', ')}`)
    }
    for (const reference of extracted.references) {
      const asset = resolveAstroAsset(reference, file, outputDirectory)
      if (asset) references.add(asset)
    }
  }
  return references
}

const expandAstroAssetGraph = async (entryAssets, outputDirectory) => {
  const reachable = new Set()
  const pending = [...entryAssets]

  while (pending.length) {
    const asset = pending.pop()
    if (reachable.has(asset)) continue
    reachable.add(asset)
    if (!/\.(?:css|js|mjs)$/.test(asset)) continue

    let source
    try { source = await readFile(asset, 'utf8') } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    const extracted = sourceAssetReferences(source)
    if (extracted.unresolved.length) {
      throw new Error(`Unresolved Astro asset reference in ${relative(outputDirectory, asset)}: ${extracted.unresolved.join(', ')}`)
    }
    for (const reference of extracted.references) {
      const dependency = resolveAstroAsset(reference, asset, outputDirectory)
      if (dependency && !reachable.has(dependency)) pending.push(dependency)
    }
  }
  return reachable
}

export const artifactDigest = async (outputDirectory) => {
  const output = resolve(outputDirectory)
  const files = (await walkFiles(output)).sort((left, right) => relative(output, left).localeCompare(relative(output, right)))
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(output, file))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

const relativeAssetPaths = (paths, output) => [...paths]
  .map((path) => `/${relative(output, path)}`)
  .sort()

export const excludeDeferredRoutes = async (outputDirectory, { manifestPath } = {}) => {
  const output = resolve(outputDirectory)
  const files = await walkFiles(output)
  const deferredFiles = files.filter((path) => isDeferredPath(relative(output, path)))
  const deferredHtml = deferredFiles.filter((path) => path.endsWith('.html'))
  const retainedHtml = files.filter((path) => (
    path.endsWith('.html') && !isDeferredPath(relative(output, path))
  ))
  const deferredEntries = await collectDirectAstroAssetReferences(deferredHtml, output)
  const retainedEntries = await collectDirectAstroAssetReferences(retainedHtml, output)
  const deferredAssets = await expandAstroAssetGraph(deferredEntries, output)
  const retainedAssets = await expandAstroAssetGraph(retainedEntries, output)
  const emittedAssets = new Set(files.filter((path) => (
    relative(output, path).startsWith(`_astro${sep}`)
  )))
  const routeOnlyAssets = [...deferredAssets].filter((path) => (
    emittedAssets.has(path) && !retainedAssets.has(path)
  ))

  await Promise.all([
    ...deferredPublicRoutes.flatMap((route) => [
      rm(join(output, route), { recursive: true, force: true }),
      rm(join(output, `${route}.html`), { force: true }),
    ]),
    ...routeOnlyAssets.map((path) => rm(path, { force: true })),
  ])

  const result = {
    schema: PUBLIC_ARTIFACT_MANIFEST_SCHEMA,
    removedAssets: relativeAssetPaths(routeOnlyAssets, output),
    retainedAssets: relativeAssetPaths(retainedAssets, output),
    artifactDigest: await artifactDigest(output),
  }

  if (manifestPath) {
    await mkdir(dirname(manifestPath), { recursive: true })
    await writeFile(manifestPath, `${JSON.stringify(result, null, 2)}\n`)
  }

  return result
}

const scriptPath = fileURLToPath(import.meta.url)
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null

if (invokedPath === scriptPath) {
  const projectRoot = dirname(dirname(scriptPath))
  const result = await excludeDeferredRoutes(join(projectRoot, 'dist'), {
    manifestPath: join(projectRoot, 'build', 'public-artifact-prune.json'),
  })
  const assetSummary = result.removedAssets.length
    ? `; removed route-only assets: ${result.removedAssets.join(', ')}`
    : ''
  process.stdout.write(`Excluded deferred public routes: ${deferredPublicRoutes.map((route) => `/${route}`).join(', ')}${assetSummary}\n`)
}
