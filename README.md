# noasaitoshii.com

Noa Saitoshii's personal artist website. The current redesign is a typography-led Astro site packaged for Cloudflare Workers Static Assets.

## Current lifecycle — September 5, 2026

The existing GitHub Pages site remains public production. The Astro redesign is proven locally and has a separate fail-closed protected-staging boundary; it has not replaced the public domain. Local work includes the show-media intake pilot, booking prototype, private `noindex, nofollow` EPK, and events archive. Current dirty EPK/events source is not a release.

The next proof is one current local review of `/epk`, `/events`, booking, and media intake followed by a protected-staging completion/read-back packet. The cross-project reconciliation is `../../../../docs/audits/project-landscape/2026-09-05/evidence/creative-operations-state.md`.

## Design system

The site uses the shared Saitoshii UI kernel for spacing, typography roles, focus, motion, semantic structure, and responsive behavior. The Noa Saitoshii identity is the project-level L7 overlay: BD Megalona display typography, warm near-black editorial surfaces, peach-gold accents, oxblood program rails, an enlarged low-opacity emblem, subtle procedural grain, and a compact schedule-led information hierarchy.

The implementation contract is [docs/design-implementation.md](docs/design-implementation.md). The complete cross-project brand reference is [`docs/saitoshii-ui/noa-saitoshii-brand/`](../../../../docs/saitoshii-ui/noa-saitoshii-brand/).

Production visual assets must be authored, licensed, commissioned, captured, or code-native with provenance. AI-generated imagery is concept-only and must not ship on this website. The current atmosphere is entirely CSS/SVG procedural material, not generated imagery.

## Local commands

The Finder review surface is:

```text
/Applications/Miinrva Apps/Noa Saitoshii Website WIP.app
```

It starts or reuses the loopback-only dev server at `http://127.0.0.1:5173/`.
The canonical launcher bundle and shared start script live in
`apps/website-previews/` at the repository root.

```bash
npm run dev
npm test
npm run validate:data
npm run build
npm run preview
npm run preview:cloudflare
npm run preview:intake
npm run preview:staging
npm run check:staging
npm run pull:intake -- --output "/absolute/private/holding-folder"
```

Both Cloudflare preview commands explicitly disable automatic loading of the generic project `.env` and send Wrangler's disposable diagnostic log to `/tmp`. `npm run check:staging` builds and packages the staging Worker without deploying it.

The 2026-07-28 dependency hardening pass removed the unused legacy
React/Router/GitHub Pages toolchain and finished with zero reported npm
vulnerabilities, 29 passing tests, a green production build, and a green
Cloudflare staging dry-run. Dependency changes remain subject to Miinrva's
evidence-first security gate.

`npm run preview:intake` starts the complete loopback-only show-media intake at
`http://127.0.0.1:8787/send`; Noa's private local holding bin is
`http://127.0.0.1:8787/send/review`. It uses Wrangler's ignored local R2 and
Durable Object state and does not contact or create remote Cloudflare resources.
The architecture, safety boundary, limits, proof, and production activation gate
are in [docs/media-intake-v1.md](docs/media-intake-v1.md). Day-to-day local
review, verified pull/watch operation, manifests, event close, and incident
stops are in
[docs/media-intake-operator-runbook.md](docs/media-intake-operator-runbook.md).

The same local Worker preview exposes the booking-inquiries prototype at
`http://127.0.0.1:8787/book`. It exercises the branded form and the complete
Worker validation boundary with ephemeral local adapters; it does not write to
Notion or create remote Cloudflare resources. Architecture, test commands,
security behavior, and activation gates are in
[docs/booking-inquiries-v1.md](docs/booking-inquiries-v1.md).

The private artist EPK preview is available from the normal Astro dev server at
`/epk`. It remains `noindex, nofollow` and includes representative direct music
links, reusable short and full biographies, a generated plain-text bio download,
performance context, and booking paths. Public release remains gated by the
content, media, rights, and visual approvals in
[docs/epk-page-brief.md](docs/epk-page-brief.md).

`npm run deploy` is the production Cloudflare command. Do not run it until a preview has been reviewed and the intended Cloudflare account and custom domain are confirmed.

The detailed operational source of truth is [docs/cloudflare-deployment-runbook.md](docs/cloudflare-deployment-runbook.md). It distinguishes active remote state from prepared local configuration and defines staging, production, cutover, rollback, credential, and approval procedures.

## Private staging

The `staging` Wrangler environment deploys as a separate `noa-saitoshii-staging` Worker. Its stable HTTPS `workers.dev` URL is protected before both static assets and API routes are served. Version-preview URLs stay disabled, and the production Worker does not expose a `workers.dev` URL.

Cloudflare Access admits only explicitly allowed email identities. The Worker also validates the Access JWT signature, issuer, application audience, and lifetime before serving any route. Staging fails closed when `TEAM_DOMAIN` or `POLICY_AUD` is absent, so deploying before Access configuration cannot expose the site.

`TEAM_DOMAIN` and `POLICY_AUD` are non-secret identifiers shown when Access is enabled. Keep them in the staging environment only. The authorized email list belongs in the Cloudflare Access policy, not in repository files. For local staging tests, disable Wrangler's automatic `.env` loading so unrelated project credentials are not bound to the Worker: `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false npx wrangler dev --env staging`.

## Architecture

- Astro pre-renders the homepage, custom 404, and individual event pages.
- `src/data/events.js` adapts the generated shared public-event bundle while preserving site-authored editorial copy for stable event slugs.
- The homepage event ledger includes only live or upcoming appearances whose
  event window has not ended, and removes a row in the browser when that
  window ends so a static build cannot leave stale “upcoming” copy visible.
  `/events` provides the full appearance ledger, classifying rows into Upcoming
  and Past from their actual end timestamps. Past detail routes remain available
  as durable historical links even after an event leaves the homepage.
- `npm run build` validates the public event boundary first. Named lineups and
  viewer-local set ranges publish only when every related booking is confirmed
  and time-complete; otherwise an event renders `Lineup TBA` without leaking a
  partial lineup or stale formula output.
- Viewer-local timestamps and the four-zone comparison run in the browser using the native `Intl` API. No external time service is required.
- `worker/index.js` serves static assets and exposes `/api/live`,
  `/api/booking-inquiries`, plus the disabled-by-default
  `/api/media-intake/*` contract. Media bytes use private
  multipart quarantine and never pass through n8n. Twitch credentials stay in
  Cloudflare secrets named `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`; they
  must never be committed or exposed to the browser.
- If Twitch secrets are not configured, live-state controls degrade to direct channel links.
- `public/fonts/` contains the licensed self-hosted BD Megalona webfont files used for the display layer. Body and functional UI remain on the Saitoshii sans/mono stack.

## Public-information path

The implemented build-time exporter reads the website-approved `Public Events DB` projection, resolves each canonical event, queries related booking rows directly, applies the all-confirmed/time-complete rule, and writes one sanitized bundle to both noasaitoshii.com and saitoshiia.com. Run `npm run sync:events` to refresh and verify both local consumers. Version-controlled code owns transformation and validation; trusted n8n runner orchestration and production promotion remain explicit approval steps. The governing contract is `ops/notion/contracts/saitoshiia-public-information-sync-architecture.md` from the Miinrva root.

## Optional Cloudflare agent tooling

Cloudflare's official [agent setup](https://developers.cloudflare.com/agent-setup/) includes platform skills and remote MCP servers for API operations, documentation, Workers bindings, Builds, and Observability. It is a potential future resource rather than a requirement for this site.

Wrangler is the default project tool. Consult Cloudflare's [agent-friendly documentation index](https://developers.cloudflare.com/llms.txt) without installing anything when current reference material is enough. Do not execute the bulk agent setup prompt or add broad Code Mode API access automatically; any skill, plugin, or MCP adoption must pass Miinrva's dependency/security gate and use the smallest useful permission scope.

## FFXIV newcomer guide

The shared guide lives at Saitoshiia's `/attend/ffxiv-free-trial/`; the artist site links to it. It covers the Free Trial, optional account-wide and character-specific items, and the Bee's Knees MGP tutorial. The editable knowledge counterpart is `wiki/concepts/ffxiv-getting-started.md` in the Miinrva root, with the original FFXIV Helpful starter guide maintained in Notion. Keep these content surfaces aligned when editing. The artist-site link and Saitoshiia route must be published together; current changes are local only.


### WIP sync recovery — September 15

The active private n8n/Mac runner refreshes both WIP/local bundles every time a
Website sync is queued. It does not deploy the public websites. Lost claim/result
responses recover from a durable journal; all source rows must validate before
replacement, and both complete bundles/checksums must match before success.
`npm run sync:events` uses the same two-site verification transaction. Inspect
`ops/n8n/scripts/run-public-event-sync-runner-v2-candidate.mjs --status` from the
Miinrva root for the active phase and last receipt. No new timestamp is required.


Export hardening also distinguishes date-only calendar markers without any
performance details from failed event reads. Those markers are explicitly listed
as exclusions; incomplete performances still fail without replacing bundles.
The export transaction has a shared lock across manual and scheduled callers.
Multi-stage windows use the earliest start and latest finish across all stages.
The read-only booking command reuses its initial page snapshot; post-write
verification still performs an independent read.
