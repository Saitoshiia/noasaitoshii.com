// Fails the build when an inline link or emphasis is glued to the words around it
// ("Itsfree trial"). Astro's default HTML compaction can drop the line break before a link
// that starts a source line, so astro.config.mjs turns compaction off and this guards the output.
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = new URL('../../dist/', import.meta.url).pathname
const htmlFiles = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true }))
  .map((entry) => entry.isDirectory() ? htmlFiles(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : [])))
  .flat()

const errors = []
for (const file of await htmlFiles(root)) {
  const html = await readFile(file, 'utf8')
  for (const glued of html.matchAll(/[\p{L}\p{N}]<(?:a|strong|em)[\s>]|<\/(?:a|strong|em)>[\p{L}\p{N}]/gu)) {
    errors.push(`${relative(root, file)}: "${html.slice(Math.max(0, glued.index - 30), glued.index + 30).replace(/\s+/g, ' ')}"`)
  }
}
if (errors.length > 0) {
  console.error(`Inline link or emphasis glued to text:\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log('Inline spacing valid: no links or emphasis glued to text.')
