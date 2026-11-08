---
title: noasaitoshii.com feature map
type: reference
status: active
summary: Route, data-flow, runtime, design, verification, and deployment map for agents.
tags: [project/website, agents, navigation]
---

# noasaitoshii.com feature map

Read this before navigating the source. Paths are repo-relative unless an absolute path is shown.

## Routes

Every source route under `src/pages` is listed below. `build:public` keeps ordinary public routes, keeps `/book` as a noindex fallback, and removes `/epk/**` and `/send/**` from the public artifact.

All `BaseLayout` routes also receive `Header`, `Footer`, `EventLifecyclePreview`, and `src/styles/global.css`.

| Route | Purpose and data source | Key pieces | Runtime JS | Indexing and artifact | Test coverage |
|---|---|---|---|---|---|
| `/` | Artist home. `getUpcomingEvents()` and inline social links from `src/data/events.js` and `src/data/sets.js`. | `BaseLayout`, `LiveNow`, `EventRow`, `EventTime` | Viewer-local time, 60-second event expiry, `/api/live` channel status, local live simulator | Indexable, not deferred | `tests/event-presentation.test.mjs`, `tests/events.test.mjs`, `tests/runtime-freshness.test.mjs`, `tests/events-archive-ui.test.mjs` |
| `/events` | Upcoming and past event archive from `getUpcomingEvents()` and `getPastEvents()`. | `BaseLayout`, `EventRow`, `EventTime`, `events-archive.css` | Reclassifies rows by end time every 60 seconds; local simulator | Indexable, not deferred | `tests/events-archive-ui.test.mjs`, `tests/event-presentation.test.mjs`, `tests/events.test.mjs` |
| `/events/[slug]` | Static detail page for every event in `src/data/events.js`; lifecycle is projected at build time. | `BaseLayout`, `EventTime`, `groupSetTimes`, event-presentation helpers, `MusicEvent` JSON-LD | Viewer-local time, four-zone comparison, countdown and lifecycle refresh, local simulator | Indexable, not deferred; past detail URLs remain available | `tests/events-archive-ui.test.mjs`, `tests/event-presentation.test.mjs`, `tests/events.test.mjs`, `tests/group-set-times.test.mjs`, `tests/runtime-freshness.test.mjs` |
| `/book` | Direct booking, collaboration, and press fallback with email and Instagram. | `BaseLayout`, `booking-inquiry.css` | Global layout enhancement only. `BookingInquiryForm.astro` is a dormant prototype, not mounted here. | `noindex, nofollow`, retained in public artifact | `tests/booking-inquiry-ui.test.mjs`, `worker/booking-inquiry.test.mjs` |
| `/epk` | Private electronic press kit from `src/data/epk.js`, including biographies, music, proof, Saitoshiia context, and contact. | `BaseLayout`, `epk.css` | Copy-short-bio clipboard action; global layout enhancement | `noindex, nofollow`; deferred from `build:public` | `tests/epk-page.test.mjs`, `tests/public-build.test.mjs` |
| `/epk/bios.txt` | Plain-text short and full biographies generated from `src/data/epk.js`. | `src/pages/epk/bios.txt.js` endpoint | None | Private `/epk/**` route; deferred from `build:public`; no HTML robots tag | `tests/epk-page.test.mjs`, `tests/public-build.test.mjs` |
| `/send` | Private invited show-media contributor upload page. | `BaseLayout`, `MediaUploadQueue`, `media-intake.css` | Invite check, file picker/drop, resumable multipart upload, local recovery | `noindex, nofollow`; deferred from `build:public` | `tests/media-intake-ui.test.mjs`, `worker/media-intake.test.mjs`, `tests/media-intake-pull.test.mjs`, `tests/public-build.test.mjs` |
| `/send/review` | Private operator holding-bin review and invitation creation. | `BaseLayout`, review markup, `media-intake.css` | Invitation create/copy, session/file listing, review states | `noindex, nofollow`; deferred from `build:public` | `tests/media-intake-ui.test.mjs`, `worker/media-intake.test.mjs`, `tests/media-intake-pull.test.mjs`, `tests/public-build.test.mjs` |
| `/privacy` | Plain-language static privacy note. | `BaseLayout` | Global layout enhancement only | Indexable and included in `sitemap.xml` | No dedicated route test; included by build and sitemap source |
| `/404` | Custom not-found page. | `BaseLayout` | Global layout enhancement only | Custom 404 fallback, not in sitemap | `tests/public-build.test.mjs` |
| `/sitemap.xml` | XML sitemap for `/`, `/events`, `/privacy`, and every event detail slug. | `src/pages/sitemap.xml.js` endpoint | None | Public XML; private routes are omitted | No dedicated route test; generated during build |

## Data flow

| Stage | Source and rule |
|---|---|
| Shared export | `/Users/noasaitoshii/Miinrva/ops/notion/scripts/export-public-events.mjs` queries the website-approved Notion public projection, reads each canonical event and related booking rows, excludes calendar-only date markers, validates completeness, sanitizes fields, and writes the same bundle to both sites' `src/data/public-events.generated.json`. |
| Site projection | `src/data/events.js` imports the generated bundle, keeps only `event.audiences.noaSaitoshii`, maps canonical event type, times, venue, address, stream, lineup, set times, and status, then merges stable authored editorial fields by slug. Authored rows inside the bundle source window are not duplicated. |
| Lifecycle | `getUpcomingEvents`, `getPastEvents`, `getEventBySlug`, and `projectEventLifecycle` derive the site view from timestamps. The browser repeats the expiry/archive classification so stale static upcoming copy disappears. No browser path reads Notion. |
| Authored data | Structured editorial content lives in `src/data/events.js` (`authoredEvents`), `src/data/epk.js`, and `src/data/sets.js`. Page copy and social links remain inline in the relevant `src/pages/*.astro` files. Do not hand-edit the generated JSON as a durable source. |

## Shared pieces

These are cross-site contracts with `saitoshiia.com`. Change both copies together.

| This repo | Saitoshiia twin | Current relationship |
|---|---|---|
| `src/lib/live-events.mjs` | `/Users/noasaitoshii/Miinrva/projects/saitoshiia/websites/saitoshiia.com/src/lib/live-events.mjs` | Byte-identical |
| `src/lib/event-lifecycle.mjs` | `/Users/noasaitoshii/Miinrva/projects/saitoshiia/websites/saitoshiia.com/src/lib/event-lifecycle.mjs` | Byte-identical |
| `src/components/LiveNow.astro` | `/Users/noasaitoshii/Miinrva/projects/saitoshiia/websites/saitoshiia.com/src/components/LiveEventFeature.astro` | Same happening-now structure; brand data and styling differ |
| `tests/twitch-embed.test.mjs` | `/Users/noasaitoshii/Miinrva/projects/saitoshiia/websites/saitoshiia.com/tests/twitch-embed.test.mjs` | Byte-identical |

## Runtime behaviors

| Behavior | Implementation and states |
|---|---|
| Live module | `LiveNow` shows the current event, current set, Noa on-stage copy, direct stream CTA, and a hidden embed slot. `/api/live` checks `noasaitoshii` and `noasaii` server-side. Missing Twitch secrets or a failed response degrades to `View channel` direct links. |
| Local simulator | `?preview-live=<slug>` and optional `?preview-at=<iso>` work only on `localhost` or `127.0.0.1`. `EventLifecyclePreview` adds the local control and reset action. It changes presentation time only. The live module re-windows the selected event around now. |
| Twitch embed | The live card first renders a poster. A visitor click creates the Twitch iframe with the required `parent` host and autoplay. No Twitch iframe or cookies are loaded before click. Direct Twitch links remain available. |
| Time and freshness | `EventTime` uses native `Intl` for viewer-local display. Lifecycle/countdown controllers pause when hidden, resume on visibility return, and avoid overlapping Twitch requests. |
| Booking | The current `/book` page is email/Instagram only. The unmounted `BookingInquiryForm` prototype moves edit to review to pending, then success or error and posts to `/api/booking-inquiries`; the Worker validates origin, Turnstile, rate limits, consent, normalization, and idempotency. |
| Media upload | `/send` requires an invite and explicit identity, credit choice, authority, and license consent. Queue states include queued, authorizing, uploading with percentage, paused, needs file, validating, pending review, ready, held, rejected, delivered, and error. Recovery metadata is in local storage; files remain private and are never public links. |
| Media review | `/send/review` creates one-time or trusted invitation links, shows the secret once for copying, lists sessions and files, and exposes needs-review, ready-to-pull, held, and error notices. Remote media activation is disabled by default. |
| Shared shell | `BaseLayout` adds header offset measurement, reveal-on-scroll, reduced-motion handling, and the WebGL atmosphere with a CSS fallback. |

## Design

| Concern | Contract |
|---|---|
| Tokens | `src/styles/global.css` defines the Saitoshii `--s-*` kernel tokens and Noa `--noa-*` aliases for surfaces, text, accent, rules, type, spacing, motion, and focus. Components consume tokens, not ad hoc palette values. |
| Fonts | Display uses self-hosted BD Megalona from `public/fonts/BDMegalona-*.woff2` through `--noa-font-display`. Functional copy uses `--s-font-sans` with Inter/system fallbacks. Metadata, time, state, and indexes use `--s-font-mono` with Geist Mono/system fallbacks. |
| Design law | No accent edge stripes. Use OKLCH and `color-mix(in oklch, ...)`; use semantic tokens only. Raw hex, rgb, hsl, and one-edge accent rails are violations. Neutral `--site-rule` dividers are allowed. |
| Lint | `node /Users/noasaitoshii/Miinrva/scripts/quality/accent-stripe-lint.mjs src` |

## How to verify

Run from this repo:

```sh
npm test
npm run build
node /Users/noasaitoshii/Miinrva/scripts/quality/accent-stripe-lint.mjs src
npm run dev -- --host 127.0.0.1 --port 4321
node /Users/noasaitoshii/Miinrva/scripts/quality/mobile-check.mjs http://127.0.0.1:4321/ /tmp/noasaitoshii-mobile.png 390 844
open /tmp/noasaitoshii-mobile.png
```

For the public artifact gate, use `npm run build:public`. The mobile check reports horizontal overflow and saves the screenshot; view that PNG, do not treat the command output alone as visual proof.

## Deployment state

The latest README and deployment docs say that `https://noasaitoshii.com` remains public production on GitHub Pages, with no Cloudflare production cutover evidenced. The Astro redesign is a local release candidate, and the `noa-saitoshii-staging` Worker exists as a fail-closed protected boundary that remains unusable until its Cloudflare Access identifiers and policy are completed. No production Worker custom domain, Twitch Worker secrets, or remote media-intake activation is established. `npm run deploy`, staging completion, and domain cutover remain separate approval gates, and GitHub Pages is the rollback surface until Cloudflare is proven.
