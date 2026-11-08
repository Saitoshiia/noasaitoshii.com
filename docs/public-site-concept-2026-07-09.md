# NoaSaitoshii.com Public Site Concept

Date: 2026-07-09  
Scope: discovery and concept pass only. No redesign implementation, live Notion/n8n mutation, deployment, dependency change, or external write was performed.

## Executive Recommendation

NoaSaitoshii.com should become the canonical public artist home for Noa Saitoshii: a polished, fast, artist-forward site that makes a stranger understand the person, hear/see the work, attend the next stream or show, join the community, and contact Noa for bookings or collaborations.

The strongest version is not a generic portfolio and not the Saitoshiia organization site. It should position Noa as the artist and creative director whose work spans DJing, streaming, immersive metaverse nightlife, IRL shows, creative systems, and community world-building. Saitoshiia should appear as a major authored world/community doorway: created by Noa Saitoshii and the Saitoshiia team, with clear links to Saitoshiia.com and Discord.

For events, keep `Noa Events DB` as the source of truth. The website should consume a sanitized public projection, not query private Notion directly from the browser. The best fit for the current stack is a phased model: static JSON MVP, then an n8n website-event-sync gateway modeled after the working Discord event sync, publishing a sanitized events cache that the Vite/GitHub Pages site reads at runtime.

## Sources Checked

Project-local:

- `AGENTS.md`, `index.md`, `package.json`, `.github/workflows/deploy.yml`, `src/`, `public/`, `assets/`, `socials.md`.
- Git branch/status inventory on 2026-07-09.

Internal Miinrva context:

- `brain/projects/noasaitoshii-com.md`
- `brain/projects/saitoshiia.md`
- `brain/projects/saitoshiia-com.md`
- `brain/knowledge/noa-event-copy-voice.md`
- `brain/knowledge/marketing-communications/marketing-communications-system.md`
- `brain/knowledge/content-os-architecture.md`
- `brain/knowledge/career-flywheel-first-doctrine.md`
- `brain/knowledge/brand-system/brands/noa-saitoshii/index.md`
- `brain/knowledge/noa-frontend-framework.md`
- `brain/knowledge/connected-apps-operational-map.md`
- `ops/notion/AGENTS.md`
- `ops/n8n/AGENTS.md`
- `ops/notion/contracts/noa-events-projection-sync-model.md`
- `ops/notion/contracts/noa-events-copy-retrieval-contract.md`
- `ops/notion/contracts/noa-events-formula-intelligence-and-handoff-bin-plan.md`
- `ops/n8n/contracts/discord-event-sync-gateway.md`

Public surfaces checked:

- `https://noasaitoshii.com/` - current public personal site shell.
- `https://saitoshiia.com/` - public Saitoshiia surface; exposes Saitoshiia positioning plus event/projection test areas and current Noa Upcoming Events DB rows.
- `https://soundcloud.com/noasaitoshii` - public artist bio, location, music framing, and published mixes.
- `https://www.twitch.tv/noasaitoshii`, `https://www.twitch.tv/noasaii`, `https://x.com/noasaitoshii` - JS-heavy public profile surfaces; useful as canonical URLs but not reliable text sources from this environment.

Read-only operational check:

- Approved Keychain-backed Notion script, read-only, `events-range --preset this-week --scope canonical`, run from `/Users/noasaitoshii/Miinrva` on 2026-07-09. It confirmed current `Noa Events DB` rows for this week including `Prominence: Float Party Field Trip`, `Noa Pop-Up: Float Party Set Re-Recording`, `Obsidian`, and sync-status fields.

## Current-State Inventory

### Repo And Deployment

- Stack: Vite, React 18, React Router, React Icons, GitHub Pages.
- Deployment: `.github/workflows/deploy.yml` builds and deploys on push to `main` using GitHub Pages Actions.
- Current worktree branch: `noa-site-public-concept`.
- `redesign-v2` points at the same commit as this branch locally: `c7bb85b... chore(site): pin node version`.
- `main` and `origin/main` point to the initial deployed site commit: `eb55ca4... Initial site`.
- Worktree was clean before this proposal file was added.
- There is no project `README.md` and no existing `docs/` lane before this document.
- `.gitignore` correctly excludes `.env`, local `data/`, local `scripts/`, `node_modules/`, `dist/`, and `build/`.

### Site Implementation

Current route structure:

- `/` home page with `Hero`, `About`, `Livestream`, `Events`, `Links`, `Contact`.
- `/events/:slug` event detail page.

Implemented components:

- Header with fixed nav and mobile menu.
- Hero with avatar, logo, subtitle: `DJ / Artist / World-Builder`.
- About section with current bio copy focused on DJ/streaming/metaverse nightlife.
- Livestream component with Twitch tabs for `noasaitoshii` and `noasaii`, hidden Twitch embeds for online/offline detection, and a placeholder schedule string.
- Events table and event detail page are designed, but depend on a missing `src/data/events` module.
- Social link grid includes Twitch, X, Bluesky, YouTube, Instagram, SoundCloud, Discord, Ko-fi, and TikTok.
- Contact section uses `contact@saitoshii.com`.

Build status:

- `npm run build` could not run because dependencies are not installed in this worktree: `vite: command not found`.
- I did not run `npm ci` or install dependencies because this pass does not need dependency changes or install approvals.
- Static inspection shows a likely build blocker independent of missing dependencies: `src/components/Events.jsx` and `src/pages/EventDetail.jsx` import `../data/events`, but no `src/data/events` file or folder exists.

Design status:

- The current concept has a dark, minimal, warm-accent direction using Manrope, baseline-derived spacing, CSS layers, BEM-like class names, subtle grain, and scroll reveals.
- This aligns with Noa's frontend conventions and candidate brand direction: refined electronic artist identity, warm melodic sophistication, subtle motion, premium/editorial feel.
- It is still too thin for a public-ready artist site: it lacks a work/media section, full story, event data source, proper booking path, Saitoshiia authorship doorway, press/SEO depth, and a content/archive surface.

### Public Surface Observations

- `saitoshiia.com` currently states Saitoshiia as a metaverse nightlife/world surface and contains event/projection/test content. It already exposes Noa-relevant public event rows such as July 18, 2026 `Noa @ Beats & Blends` and July 25, 2026 `Noa b2b Petirwyn @ Aura: Drop pres. Daxson`.
- The same page includes visible test/demo areas such as `framer test event DB`, `TEST Website Event Calendar`, Discord timestamp experiments, and repeated event blocks. That confirms Saitoshiia.com is useful context but not a clean cross-link target yet.
- SoundCloud gives the clearest public artist wording: San Francisco-based, melodic/groovy music, weekly Twitch streaming, and virtual nightclub/world-building through Saitoshiia.

## Positioning And Conversion Goals

Primary positioning:

> Noa Saitoshii is a San Francisco-based DJ, artist, streamer, creative director, and community builder creating immersive electronic music experiences across IRL nightlife, Twitch, and the metaverse.

Support pillars:

- DJ/performance: melodic house, progressive, techno, trance, breaks/liquid DnB where relevant; IRL shows and virtual sets.
- Streamer: weekly Twitch presence, live DJ sets, community rituals, occasional pop-up streams.
- Creative director/world-builder: creator of Saitoshiia, an immersive nightlife/community world built with the Saitoshiia team.
- Community builder: Discord and recurring events as the living social home.
- System designer: visible only when useful for credibility and uniqueness; do not over-index the public site toward tooling or Miinrva.

Audience goals:

| Audience | What they need fast | Primary CTA |
|---|---|---|
| Stream viewer | Is Noa live? When is next stream? What channel? | Watch on Twitch / get Discord alerts |
| Fan | Who is Noa? Where can I hear more? | Listen on SoundCloud / follow socials |
| IRL attendee | Next show, location, set time, tickets, age, vibe | Get tickets / save event |
| Booker/promoter | Genre, credibility, location, booking contact, assets | Book Noa / view EPK |
| Collaborator | Artistic fit, community/event context, contact path | Propose collaboration |
| Community member | What is Saitoshiia? How do I join? | Join Discord |
| Supporter/customer | How to support without friction | Ko-fi / future store/patronage |
| Press | Short bio, long bio, images, accurate links | Press kit / contact |

## Proposed Site Map

Launch-ready v1 should stay focused and high-polish:

- `/` - artist home
- `/events` - full upcoming events and recent/past highlights
- `/events/:slug` - public event detail pages
- `/about` - expanded bio/story, if home becomes too dense
- `/music` - mixes, sets, selected tracks, SoundCloud/YouTube embeds
- `/saitoshiia` - bridge page: Noa's authored world/community, not a duplicate org site
- `/booking` - booking/collaboration/contact path
- `/press` or `/epk` - lightweight electronic press kit

Pragmatic phase-1 alternative:

- Keep `/` as a long one-page site with anchored sections.
- Add `/events/:slug`.
- Add `/booking` only if the contact form/EPK would otherwise clutter home.
- Delay separate `/music`, `/about`, `/press` until content exists.

## Home Page Architecture

### 1. Hero

Purpose: instant artist identity and conversion.

Content:

- Strong Noa Saitoshii wordmark/name.
- One-line positioning: `DJ / artist / streamer / world-builder`.
- Location/context: San Francisco / Twitch / Saitoshiia.
- Primary CTA: `Upcoming Events`.
- Secondary CTA: `Watch on Twitch` or `Join Discord`.
- Optional live state: `Live now` if Twitch status is available.

Copy direction:

- Confident and simple. No generic "welcome to my website."
- Artist first, then channels.

### 2. Next Event / Live Now

Purpose: the highest-conversion block.

Content:

- Next public event card, not a full calendar first.
- Date, local display, venue/platform, event type, Noa set time, ticket/stream CTA.
- If live: replace or elevate with `Noa is live now`.

CTA:

- `Get Tickets`, `Watch Stream`, `Event Details`, `Add to Calendar`.

### 3. About Snapshot

Purpose: explain Noa in 10 seconds.

Content:

- Short bio, 80-120 words.
- Three proof chips: `San Francisco DJ`, `weekly Twitch sets`, `creator of Saitoshiia`.
- Link to longer story.

### 4. Music / Sets

Purpose: let visitors hear the work.

Content:

- Embedded SoundCloud featured set.
- 3-6 selected mixes by mood or context.
- Optional YouTube embeds later.

CTA:

- `Listen on SoundCloud`, `Follow on YouTube`.

### 5. Events

Purpose: upcoming attendance and public proof.

Content:

- Upcoming shows/streams, grouped by `IRL`, `Streams`, `Saitoshiia / metaverse`.
- Each card needs date/time, timezone behavior, venue/platform, city/world, status, ticket/stream link, lineup/set time if available.
- Past highlights can appear below once recap assets exist.

### 6. Saitoshiia Doorway

Purpose: connect Noa to the world/community without blurring ownership.

Copy direction:

> Saitoshiia is the immersive nightlife and community world created by Noa Saitoshii and the Saitoshiia team: recurring FFXIV/metaverse events, IRL experiments, Discord community, and a growing universe of electronic music experiences.

CTAs:

- `Explore Saitoshiia`
- `Join the Discord`

### 7. Links / Follow

Purpose: centralize social destinations.

Structure:

- Primary: Twitch, Discord, SoundCloud, Instagram.
- Secondary: YouTube, TikTok, Bluesky, X, Ko-fi.
- Avoid overwhelming first-time visitors with equal-weight links.

### 8. Booking / Contact

Purpose: professional inbound.

Content:

- Clear paths: bookings, collaborations, press, general.
- Current email should be confirmed before launch.
- Later: structured inquiry form.

## Bio And Content Strategy

Short bio target:

> Noa Saitoshii is a San Francisco-based DJ, artist, streamer, and creative director building immersive electronic music experiences across IRL nightlife, Twitch, and the metaverse. His sets move through melodic house, progressive grooves, techno, trance, breaks, and liquid DnB with a focus on atmosphere, momentum, and community. He is the creator of Saitoshiia, a nightlife and community world built with the Saitoshiia team.

Longer story should cover:

- Noa as artist and DJ first.
- Streaming as a performance and community medium, not a side hobby.
- Saitoshiia as an authored world and organization.
- Design/creative direction background as part of why the events feel immersive.
- IRL career growth and Bay Area/Denver/etc. shows.
- Community-building as a practice: recurring rituals, Discord, welcoming atmosphere.

Avoid:

- Overloading the first bio with internal systems/Miinrva.
- Making Saitoshiia sound like just "a Discord" or just "FFXIV clubs."
- Making Noa sound like only a streamer or only a virtual club owner.
- Generic DJ hype with no distinctive world-building/community angle.

## Events Publishing Model

### Recommended Source-Of-Truth Flow

Best architecture for current stack:

```text
Noa Events DB
  -> public-ready projection fields / Noa Upcoming Events DB
  -> n8n website-event-sync-gateway
  -> sanitized public events JSON cache
  -> Vite site fetches and renders events
```

Why:

- Preserves Notion as Noa's operational master calendar.
- Keeps private Notion fields, relations, and credentials out of the browser.
- Reuses the proven Discord sync pattern: queue/status fields, deterministic mapping, idempotency, receipt/error fields, and explicit manual publish/sync button.
- Works with GitHub Pages because the website reads static/public JSON instead of needing a server.
- Allows manual-first launch before full automation.

### Phased Data Options

| Option | Fit | Pros | Risks |
|---|---|---|---|
| Manual static JSON in repo | Phase 1 MVP | Fast, transparent, no live integration | Can drift; manual updates |
| Build-time Notion fetch in GitHub Actions | Possible later | Static output, no browser token | Requires GitHub secret and API maintenance; less aligned with n8n gateway pattern |
| n8n scheduled public JSON cache | Recommended public-ready | Centralized credentials, receipts, retry logic, mirrors Discord sync | Needs approved external write target/cache |
| n8n commits JSON to repo or triggers GitHub Action | Strong fit if approved | GitHub Pages stays; audit via git/actions | Requires GitHub token/write approval and duplicate-run handling |
| Cloudflare Worker/Vercel API with Notion token | Good if moving beyond GitHub Pages | Fresh runtime API, edge caching | Adds platform/runtime and secret surface |
| Client-side Notion API | Do not use | None | Exposes token or requires public Notion data shape; wrong boundary |

Recommendation:

1. Build the frontend against a stable `public/data/events.json` contract.
2. Seed it manually or via read-only local export for launch review.
3. After Noa approves, create `website-event-sync-gateway` in n8n using the Discord sync gateway as the template.
4. Publish sanitized JSON to an approved public cache or repo artifact.
5. Add website stale-state handling: `lastUpdated`, `source`, `syncStatus`, and fallback messaging.

### Event Fields

Minimum public event record:

```json
{
  "id": "public-stable-id",
  "slug": "noa-at-beats-and-blends-2026-07-18",
  "title": "Noa @ Beats & Blends",
  "status": "confirmed",
  "visibility": "public",
  "type": "irl_show",
  "start": "2026-07-18T12:30:00-06:00",
  "end": "2026-07-18T14:00:00-06:00",
  "timeZone": "America/Denver",
  "displayTimeMode": "venue_primary",
  "venueName": "TBA or venue name",
  "city": "Denver",
  "region": "CO",
  "country": "US",
  "locationDisplay": "Denver, CO",
  "addressPublic": false,
  "ticketUrl": "https://...",
  "streamUrl": null,
  "eventUrl": "https://...",
  "flyerImage": "/events/...",
  "imageAlt": "Event flyer for ...",
  "shortDescription": "...",
  "longDescription": "...",
  "genre": ["trance", "progressive house"],
  "vibe": "...",
  "ageRestriction": "21+",
  "lineup": [
    {
      "artist": "Noa Saitoshii",
      "start": "2026-07-18T12:30:00-06:00",
      "end": "2026-07-18T14:00:00-06:00",
      "role": "artist",
      "isNoa": true
    }
  ],
  "cta": {
    "label": "Get Tickets",
    "url": "https://..."
  },
  "updatedAt": "2026-07-09T19:00:00Z",
  "source": "Noa Events DB public projection"
}
```

Additional recommended fields:

- `sourceEventId` stored only if safe or hashed; do not expose private Notion URLs by default.
- `canonicalUrl` for website event detail page.
- `externalCalendarDescription`.
- `discordEventUrl` when public and appropriate.
- `soldOut`, `cancelledReason`, `postponedTo`.
- `privacyLevel`: `public`, `discord_only`, `private`, `staff_only`; website consumes only `public`.
- `publishState`: `draft`, `ready`, `published`, `archived`.
- `featuredRank` or `priority`.

### Website Sync Controls

Mirror Discord sync:

- `Website Sync Requested` checkbox.
- `Website Sync Status`: `Idle`, `Queued`, `Syncing`, `Synced`, `Error`.
- `Website Last Synced At`.
- `Website Sync Error`.
- `Website Sync Receipt`.
- `Website Slug`.
- `Website Published URL`.
- Optional `Website Publish State`: `Draft`, `Ready`, `Published`, `Hidden`.

Do not add these to Notion without a separate evidence packet and Noa approval. This proposal is the architecture recommendation only.

## Timezone Behavior

Requirements:

- Store timestamps as real instants with either explicit offsets or IANA time zones.
- Never store only display strings for website runtime behavior.
- Distinguish event window from Noa set time.
- Distinguish venue timezone, Noa/Pacific timezone, visitor timezone, and Discord timestamp behavior.
- Handle all-day/no-time/TBA events without fake midnight times.
- Handle DST through IANA zones, not hardcoded GMT offsets.

UX recommendation:

- For IRL events, show venue/local event time first:
  - `Sat Jul 18 / 12:30-2:00 PM MDT`
  - secondary: `Your time: 11:30 AM-1:00 PM PDT`
- For streams/metaverse events, show visitor local time first:
  - `Today / 6:00-8:00 PM your time`
  - secondary: `Pacific: 6:00-8:00 PM PDT` if same/different as relevant.
- Provide a compact timezone control:
  - `Your time`
  - `Event time`
  - `Pacific`
  - `UTC`
- Persist user choice in `localStorage`.
- On first load, use browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`; if unavailable, default to Pacific with a visible `PDT/PST` label.
- Event detail pages should include both event time and Noa set time when they differ.
- Calendar export should include timezone-aware `.ics`.

Avoid:

- Only showing `PDT` for global stream events.
- Discord timestamp syntax on the website, except as text copied from Notion examples.
- Calculating future offsets manually.

## Social And Cross-Linking Matrix

| Surface | Role on Noa site | Treatment |
|---|---|---|
| Twitch main `noasaitoshii` | Primary live performance destination | Hero/live/events CTA |
| Twitch alt `noasaii` | Secondary/fallback stream channel | Keep in links, not equal hero weight unless active |
| Discord `discord.gg/saitoshiia` | Community doorway | Primary CTA near events and Saitoshiia section |
| SoundCloud | Music proof/catalog | Featured in Music section |
| Instagram | Visual/social proof and IRL promo | Primary social |
| YouTube | Sets, videos, future depth/catalog | Music/media section once organized |
| TikTok | Discovery clips | Secondary follow |
| Bluesky | Shortform/community updates | Secondary follow |
| X/Twitter | Legacy/shortform updates | Secondary follow |
| Ko-fi | Support | Support CTA, not above attend/listen CTAs |
| Saitoshiia.com | Organization/world site | Doorway from Saitoshiia section; do not replace Noa bio |

Cross-link copy rule:

- On Noa site: "Saitoshiia is created by Noa Saitoshii and the Saitoshiia team."
- On Saitoshiia site: "Noa Saitoshii is the artist and creative director behind Saitoshiia."

## Contact And Booking

Launch baseline:

- Confirm whether `contact@saitoshii.com` remains correct.
- Use clear categories:
  - Book Noa for an IRL show
  - Book Noa for a virtual/metaverse event
  - Collaboration
  - Press/media
  - General
- Provide direct email and expected context to include.

Public-ready form recommendation:

- Add a structured inquiry form only after Noa approves the destination and data path.
- Best operational fit: website form -> n8n gateway -> Notion review queue -> email/Discord notification as appropriate.
- Do not let a public client write directly into high-authority Notion databases.
- Keep spam/rate-limit controls and a clear privacy note.

Recommended inquiry fields:

- Name
- Email
- Organization/company/collective
- Inquiry type
- Event date/time/timezone
- City/venue/platform
- Budget/rate range, optional but useful
- Event/ticket link
- Short message
- How they found Noa

## SEO, Share Cards, And Structured Data

Site-wide:

- Canonical title: `Noa Saitoshii | DJ, Artist, Streamer`.
- Meta description should mention San Francisco, electronic music, Twitch, and Saitoshiia.
- Use a real share-card image, not only the avatar.
- Add `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`.
- Add `sitemap.xml` and `robots.txt`.
- Add JSON-LD `Person` and `MusicGroup`/`PerformingGroup` where appropriate.

Event pages:

- Unique title and description per event.
- Event share card with flyer or generated fallback.
- JSON-LD `Event` with start/end, location, performer, organizer, ticket URL, and event status.
- `canonicalUrl` should be stable even if title changes.

EPK/press:

- Short bio, long bio, location, genre tags, selected links, approved images, contact.
- Downloadable images can wait, but the page should exist once booking outreach starts.

## Implementation Phases

### Phase 0 - Decisions And Recovery

- Decide if this concept branch replaces or supersedes `redesign-v2`.
- Restore/create `src/data/events` or remove event imports before any build proof.
- Confirm contact email.
- Confirm launch-critical pages: one-page plus event detail vs multi-page.
- Confirm the public bio direction.

### Phase 1 - Public-Ready Static MVP

- Implement home page with polished positioning, next event, music, Saitoshiia doorway, links, contact.
- Add `public/data/events.json` with sanitized event data.
- Add event listing and detail pages against the JSON contract.
- Add timezone display utility.
- Add SEO/OG basics.
- Verify build, desktop/mobile layout, and GitHub Pages SPA routing.

### Phase 2 - Event System Hardening

- Define website event schema in repo docs.
- Add stale-state and error-state UI.
- Add `.ics` generation/download.
- Add event share cards/flyer handling.
- Add structured data for events.
- Add past highlights/archive once recap assets exist.

### Phase 3 - n8n Website Event Sync Proposal

- Produce an evidence packet before live changes:
  - current Notion field map;
  - public projection field map;
  - proposed website sync fields;
  - n8n workflow spec, contract, test plan, failure path;
  - target public JSON/cache destination;
  - credential names only, no values.
- Ask Noa before adding Notion fields, n8n workflow, GitHub write token, schedule, webhook, or deployment behavior.

### Phase 4 - Full Public Flywheel

- Add content/archive modules tied to Content OS:
  - mixes,
  - recaps,
  - selected clips,
  - press mentions,
  - event afterlife.
- Add booking form gateway after approval.
- Add EPK assets and press page.
- Add stronger Saitoshiia cross-site handoff once Saitoshiia.com is cleaned up.

## Open Questions For Noa

1. Should the first public launch be a polished one-page site with event detail pages, or should `/about`, `/music`, `/booking`, and `/press` exist immediately?
2. Is `contact@saitoshii.com` still the correct public contact, or should artist booking use a Noa-specific address?
3. Which CTA matters most above the fold right now: next event, Twitch, Discord, or booking?
4. Should Saitoshiia be described publicly as "created by Noa Saitoshii and the Saitoshiia team" exactly, or does that need softer/stronger wording?
5. For events, should the website show only confirmed public events, or also tentative streams/pop-ups with a `TBA`/`subject to change` state?
6. For timezone display, should IRL events default to venue time and streams default to viewer time, or should everything default to Pacific with a manual `convert to my time` control?
7. Is the public-ready event sync allowed to eventually write a sanitized JSON artifact to GitHub or another public cache, or should launch stay manual until a broader publishing architecture is approved?
8. Which three pieces of music/media should be featured first?
9. Does Noa want Ko-fi/support visible at launch, or should support wait until the site has stronger fan/customer framing?
10. Should the July 18 and July 25 event arc be the first launch deadline for the site, matching the career-flywheel doctrine?

## Immediate Next Move

Do not implement the full redesign yet. First, decide the launch shape and event data path:

1. Approve `public/data/events.json` as the frontend contract for Phase 1.
2. Confirm contact email and top CTA priority.
3. Choose the launch page set.
4. Then implement the static public-ready MVP and verify it locally before any deployment discussion.
