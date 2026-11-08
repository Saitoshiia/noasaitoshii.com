import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? sourceFiles(path) : [path]
  }).filter((path) => /\.(astro|css|js|mjs)$/.test(path))
}

test('decorative eyebrow and numbered-overline patterns stay opt-in', () => {
  const violations = sourceFiles(sourceRoot).filter((path) => {
    const source = readFileSync(path, 'utf8')
    return /(?:eyebrow|kicker|section-index)/i.test(source)
  })

  assert.deepEqual(violations, [], `Remove decorative overline patterns from: ${violations.join(', ')}`)
})
