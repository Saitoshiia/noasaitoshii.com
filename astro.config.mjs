import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://noasaitoshii.com',
  output: 'static',
  trailingSlash: 'never',
  // Astro 7's default HTML compaction can drop the line break before an inline link that starts a
  // source line ("Its\n<a>" became "Its<a>" on saitoshiia.com). src/lib/check-inline-spacing.mjs guards it.
  compressHTML: false,
  vite: {
    build: {
      cssMinify: 'lightningcss',
    },
  },
})
