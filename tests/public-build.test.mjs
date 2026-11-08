import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { deferredPublicRoutes, excludeDeferredRoutes } from '../tools/exclude-deferred-routes.mjs'
import { verifyPublicArtifact } from '../tools/verify-public-artifact.mjs'

const exists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const writeFiles = async (output, files) => {
  for (const [file, contents] of Object.entries(files)) {
    await mkdir(join(output, file, '..'), { recursive: true })
    await writeFile(join(output, file), contents)
  }
}

const requiredPublicFiles = (index = 'public') => ({
  'index.html': index,
  'events/index.html': '<a href="../book/?from=events#contact">Book</a>',
  'book/index.html': '<a href="/">Home</a>',
  '404.html': 'not found',
  'favicon.svg': '<svg/>',
})

test('public build exclusion preserves retained srcset, backtick and unquoted assets', async () => {
  const output = await mkdtemp(join(tmpdir(), 'noa-public-build-'))
  const manifestPath = `${output}.manifest.json`
  const retained = [
    '_astro/public.js',
    '_astro/shared.js',
    '_astro/shared.webp',
    '_astro/shared@2x.webp',
    '_astro/unquoted.js',
    '_astro/backtick.js',
    '_astro/unreferenced.css',
    'outside.css',
  ]
  const routeOnlyAssets = [
    '_astro/epk.css',
    '_astro/epk-theme.css',
    '_astro/send.css',
    '_astro/send-font.woff2',
    '_astro/send.js',
    '_astro/review.js',
  ]
  await writeFiles(output, {
    ...requiredPublicFiles([
      '<script src="/_astro/public.js"></script>',
      '<img srcset="/_astro/shared.webp 1x, /_astro/shared@2x.webp?size=2 2x">',
      '<link imagesrcset="/_astro/shared.webp 1x, /_astro/shared@2x.webp 2x">',
      '<script src=/_astro/unquoted.js></script>',
      '<script>const chunk = `/_astro/backtick.js#module`</script>',
    ].join('')),
    '_astro/public.js': 'import "./shared.js"',
    '_astro/shared.js': 'shared',
    '_astro/shared.webp': 'shared image',
    '_astro/shared@2x.webp': 'shared image 2x',
    '_astro/unquoted.js': 'unquoted',
    '_astro/backtick.js': 'backtick',
    '_astro/unreferenced.css': 'unrelated',
    'outside.css': 'outside',
    'epk/index.html': '<img src="/_astro/shared.webp"><link href="/_astro/epk.css"><link href="/_astro/../favicon.svg"><link href="../../outside.css">',
    'epk/bios.txt': 'private route copy',
    'send/index.html': '<link href="/_astro/send.css"><script src="/_astro/send.js"></script>',
    'send/review/index.html': '<link href="/_astro/send.css"><script src="/_astro/review.js"></script>',
    '_astro/epk.css': '@import "./epk-theme.css"',
    '_astro/epk-theme.css': 'epk',
    '_astro/send.css': 'src: url("./send-font.woff2")',
    '_astro/send-font.woff2': 'font',
    '_astro/send.js': 'send',
    '_astro/review.js': 'review',
  })

  const result = await excludeDeferredRoutes(output, { manifestPath })

  assert.deepEqual(deferredPublicRoutes, ['epk', 'send'])
  for (const file of [...Object.keys(requiredPublicFiles()), ...retained]) {
    assert.equal(await exists(join(output, file)), true, file)
  }
  for (const file of ['epk/index.html', 'epk/bios.txt', 'send/index.html', 'send/review/index.html', ...routeOnlyAssets]) {
    assert.equal(await exists(join(output, file)), false, file)
  }
  assert.deepEqual(result.removedAssets, routeOnlyAssets.map((file) => `/${file}`).sort())
  await verifyPublicArtifact(output, { manifestPath })
})

test('public build exclusion fails closed without deleting unresolved retained assets', async () => {
  const output = await mkdtemp(join(tmpdir(), 'noa-public-unresolved-'))
  await writeFiles(output, {
    ...requiredPublicFiles('<script>const chunk = `/_astro/${name}.js`</script>'),
    'epk/index.html': '<link href="/_astro/epk.css">',
    '_astro/epk.css': 'epk',
  })

  await assert.rejects(excludeDeferredRoutes(output), /Unresolved Astro asset reference in index.html/)
  assert.equal(await exists(join(output, 'epk/index.html')), true)
  assert.equal(await exists(join(output, '_astro/epk.css')), true)
})

test('public build exclusion aborts before deletion on concatenated retained asset overlap', async () => {
  const output = await mkdtemp(join(tmpdir(), 'noa-public-concatenated-'))
  const manifestPath = `${output}.manifest.json`
  await writeFiles(output, {
    ...requiredPublicFiles('<script src="/_astro/public.js"></script>'),
    '_astro/public.js': "const name = 'chunk'; import('/_astro/' + name + '.js')",
    '_astro/chunk.js': 'shared runtime chunk',
    'epk/index.html': '<script src="/_astro/chunk.js"></script>',
  })

  await assert.rejects(
    excludeDeferredRoutes(output, { manifestPath }),
    /Unresolved Astro asset reference in _astro\/public.js: \/_astro\//,
  )
  assert.equal(await exists(join(output, 'epk/index.html')), true)
  assert.equal(await exists(join(output, '_astro/chunk.js')), true)
  assert.equal(await exists(manifestPath), false)
})

test('public artifact verifier checks required book route and retained local destinations', async () => {
  const missingBook = await mkdtemp(join(tmpdir(), 'noa-public-missing-book-'))
  await writeFiles(missingBook, {
    'index.html': 'public',
    'events/index.html': 'events',
    '404.html': 'not found',
    'favicon.svg': '<svg/>',
  })
  await assert.rejects(
    verifyPublicArtifact(missingBook, { manifestPath: `${missingBook}.manifest.json` }),
    /Required public artifact missing: book\/index.html/,
  )

  const brokenTarget = await mkdtemp(join(tmpdir(), 'noa-public-broken-target-'))
  const manifestPath = `${brokenTarget}.manifest.json`
  await writeFiles(brokenTarget, {
    ...requiredPublicFiles('<a href="/events/?view=all#top">Events</a><img srcset="/_astro/retained.webp 1x, /_astro/missing.webp 2x">'),
    '_astro/retained.webp': 'retained',
  })
  await excludeDeferredRoutes(brokenTarget, { manifestPath })
  await assert.rejects(
    verifyPublicArtifact(brokenTarget, { manifestPath }),
    /Retained asset missing: \/_astro\/missing.webp/,
  )
})

test('public artifact verifier rejects deferred residue and post-prune artifact drift', async () => {
  const output = await mkdtemp(join(tmpdir(), 'noa-public-residue-'))
  const manifestPath = `${output}.manifest.json`
  await writeFiles(output, {
    ...requiredPublicFiles(),
    'epk/index.html': '<link href="/_astro/epk.css">',
    '_astro/epk.css': 'epk',
  })
  await excludeDeferredRoutes(output, { manifestPath })

  await writeFiles(output, { '_astro/epk.css': 'resurrected' })
  await assert.rejects(
    verifyPublicArtifact(output, { manifestPath }),
    /Deferred-only asset remains: \/_astro\/epk.css/,
  )
  await rm(join(output, '_astro/epk.css'))
  await mkdir(join(output, 'send'), { recursive: true })
  await assert.rejects(
    verifyPublicArtifact(output, { manifestPath }),
    /Deferred public artifact remains: send/,
  )
  await rm(join(output, 'send'), { recursive: true })
  await writeFile(join(output, 'epk.html'), 'deferred fallback')
  await assert.rejects(
    verifyPublicArtifact(output, { manifestPath }),
    /Deferred public artifact remains: epk.html/,
  )
  await rm(join(output, 'epk.html'))
  await writeFile(join(output, 'index.html'), 'changed after pruning')
  await assert.rejects(
    verifyPublicArtifact(output, { manifestPath }),
    /Public artifact changed after deferred-route exclusion/,
  )
})

test('public artifact verifier rejects a directory masquerading as a required file', async () => {
  const output = await mkdtemp(join(tmpdir(), 'noa-public-guard-'))
  await mkdir(join(output, 'index.html'))
  await assert.rejects(
    verifyPublicArtifact(output, { manifestPath: `${output}.manifest.json` }),
    /Required public artifact missing: index.html/,
  )
})
