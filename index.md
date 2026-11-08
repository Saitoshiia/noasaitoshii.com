# noasaitoshii.com Index

Implementation workspace for Noa Saitoshii's artist website.

## File Map

| Path | Purpose |
|---|---|
| `AGENTS.md` | Project-local agent contract. |
| `package.json` | Scripts and JavaScript dependencies. |
| `package-lock.json` | Locked npm dependency graph. |
| `astro.config.mjs` | Astro static-site configuration. |
| `wrangler.jsonc` | Cloudflare Worker and Static Assets configuration. |
| `worker/index.js` | Static asset handler, Twitch live-status endpoint, and media-intake router. |
| `worker/media-intake*.js` | Media intake contracts, state ledger, quarantine/promotion flow, and tests. |
| `docs/cloudflare-deployment-runbook.md` | Exact Cloudflare staging, deployment, security, cutover, validation, and rollback state. |
| `docs/design-implementation.md` | Site-specific mapping from the Saitoshii kernel to the Noa Saitoshii L7 brand layer. |
| `docs/epk-page-brief.md` | Product, content, evidence, design, SEO, proof, and public-release gates for the implemented private `/epk` preview. |
| `docs/events-archive-design-proof-2026-08-12.yaml` | Functional, responsive, accessibility, and visual proof receipt for `/events`. |
| `docs/media-intake-v1.md` | Trusted-friends media intake architecture, threat model, local use, proof, and production gate. |
| `docs/media-intake-operator-runbook.md` | Local/remote pull operation, private folder rules, delivery manifest, event close, and incident stops. |
| `../../../../../ops/notion/contracts/show-media-command-center.md` | Production Notion mobile command center, invitation generator, submission projection, and remaining synchronization gates. |
| `docs/booking-inquiries-v1.md` | Public booking form, Worker boundary, local proof, automation handoff, and production gates. |
| `config/media-intake/` | Reviewed production binding example and R2 quarantine/eligible lifecycle templates. |
| `tools/pull-show-media.mjs` | Atomic checksum-verified on-demand or foreground-watch Mac delivery tool. |
| `tools/media-intake-operator-key.sh` | Keychain-only remote operator-key status/create/hash helper. |
| `assets/` | Committed brand/site assets. |
| `public/` | Public static assets. |
| `socials.md` | Social/platform reference. |
| `src/layouts/` | Shared Astro page shell and document metadata. |
| `src/components/` | Reusable Astro components. |
| `src/pages/` | File-based routes, including `/events`, `/epk`, `/book`, and generated event detail pages. |
| `src/components/EventRow.astro` | Shared timezone-aware event ledger row used by the homepage and complete archive. |
| `src/pages/epk.astro` | Private-preview electronic press kit route with artist positioning, music, biography, performance evidence, press readiness, and booking paths. |
| `src/data/` | Committed sanitized public event and listening content. |
| `src/lib/validate-events.mjs` | Public event allowlist and all-or-nothing lineup validator. |
| `tests/` | Event publication and Cloudflare access regression tests. |
| `src/styles/` | Global design tokens, layout, motion, and responsive styles. |
| `public/fonts/` | Licensed, self-hosted Noa display font assets. |
| `data/` | Local data/export artifacts; ignored. |
| `scripts/` | Local/internal tooling; ignored. |
| `node_modules/`, `dist/`, `build/` | Generated dependency/build output. |

## Local Preview

Launch `/Applications/Miinrva Apps/Noa Saitoshii Website WIP.app` to start or
reuse the repo dev server at `http://127.0.0.1:5173/`. The shared launcher source
is `../../../../apps/website-previews/`.

## Strategic Memory

See `../../../../brain/projects/noasaitoshii-com.md`.

## Brand Source of Truth

See `../../../../docs/saitoshii-ui/noa-saitoshii-brand/README.md`. AI-generated imagery is not a production asset source for this website.
