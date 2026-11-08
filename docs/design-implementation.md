# Noa Saitoshii Website Design Implementation

Last updated: 2026-07-16

This document records how `noasaitoshii.com` projects the shared Saitoshii UI kernel into the Noa Saitoshii artist identity. It is an implementation map, not a second design system.

## Layer model

| Layer | Website use |
|---|---|
| Saitoshii kernel | Semantic color roles, OKLCH color construction, spacing scale, body and mono type roles, focus visibility, reduced motion, responsive reflow, stable reading surfaces, and interaction timing. |
| Noa Saitoshii L7 | BD Megalona display typography, warm near-black palette, ivory and peach-gold hierarchy, oxblood state rails, program-ledger rows, fine rules, low-contrast watermarks, an enlarged emblem field, and restrained procedural grain. |
| Page composition | Compact artist-index hero, event program, live-channel ledger, recorded-set index, about and credibility record, numbered link directory, and contact ledger. |

The cross-project source of truth is [`docs/saitoshii-ui/noa-saitoshii-brand/`](../../../../../docs/saitoshii-ui/noa-saitoshii-brand/). When this file conflicts with that package or the Saitoshii design constitution, the shared source wins.

## Token mapping

The site defines the Saitoshii kernel tokens first in `src/styles/global.css`, then maps the identity through `--noa-*` aliases. Components consume semantic tokens and aliases rather than embedding a second raw palette.

- Canvas: `--s-surface-canvas`, a warm near-black.
- Panel: `--s-surface-panel`, used for program rows and stable text surfaces.
- Primary and ivory text: `--s-text-primary` and `--noa-text-ivory`.
- Peach-gold accent: `--s-text-accent` and `--s-color-accent`.
- State rail: `--noa-surface-wine`.
- Warm structural rule and glow: `--noa-rule-warm`, `--noa-pattern`, and `--noa-glow`.
- Display face: `--noa-font-display` using self-hosted BD Megalona with old-style serif fallbacks.
- Functional copy: `--s-font-sans`.
- Metadata, time, state, and indexing: `--s-font-mono`.

## Component grammar

- The hero is a compact artist index, not a marketing billboard. “Noa Saitoshii” is one unified display lockup rather than two independently positioned words. A fully contained, enlarged Noa emblem at low opacity balances the title; the bottom ledger retains only the useful `Based` and `Sound` metadata.
- The persistent header uses the standalone Noa symbol only. Do not pair it with the name wordmark in this compact navigation context.
- The persistent header uses a restrained progressive-blur frost: a taller blurred backdrop masked into the page plus a narrow refractive lower edge. It must remain subtle, preserve contrast, and fall back to a stable warm near-black surface when transparency is reduced.
- Event rows inherit the stream-schedule grammar: serif date cell, oxblood state rail, metadata time column, program title, format, place, and low-contrast weekday watermark.
- Live channels, DJ sets, and social destinations use repeated ledger rows so hierarchy comes from typography, alignment, and rhythm.
- Homepage sections use one shared left edge, smaller section heads, compact vertical intervals, and strict table columns. Ledger rows carry no inline padding, so their first and last columns align exactly with the page shell. Redundant eyebrow labels and ornamental grid offsets are prohibited; micro-detail comes from rules, tracking, baselines, and repeated row geometry.
- Homepage order is hero, events, live stream, recorded sets, about, links, contact, footer.
- In-page navigation measures the rendered sticky header and exposes that live height as the document scroll offset, so section anchors remain visible below the header across responsive and future header-height changes.
- Event detail pages reuse the same display/ledger relationship and preserve viewer-local times, timezone comparison, lineup, links, and progressive enhancement.
- Confirmed event lineups use the same complete set-time ledger grammar as the
  Saitoshiia site, while preserving the Noa artist overlay. Pending lineups
  reduce to a single restrained `Lineup TBA` row; partial bookings never become
  public visual content.
- Atmosphere is rendered behind content with a code-native, slowly shifting black-to-clay/gold field informed by Noa's SoundCloud/Twitter banners, plus a separate restrained grain layer. Body text remains on stable surfaces; decorative dot fields, arbitrary glyphs, and generic AI imagery are excluded.

## Production asset policy

AI-generated imagery may be used only as private concept material. It may not ship as a hero, background, crop, texture, pattern, paintover, or decorative asset on `noasaitoshii.com`.

Production assets must be authored, licensed, commissioned, captured, or procedurally generated in code, with provenance retained. The current implementation contains no AI-generated image assets.

## Guardrails for future work

1. Preserve keyboard focus, semantic links/headings, viewer-time conversion, and reduced-motion behavior.
2. Start new components with Saitoshii roles and spacing; add Noa identity through aliases and composition.
3. Keep BD Megalona to artist identity, editorial headlines, dates, and expressive pull text. Do not use it for dense functional copy.
4. Keep accent color scarce and structural. Platform colors are contextual only.
5. Do not introduce generic SaaS cards, excessive glass, neon cyan/purple atmospheres, or arbitrary rounded containers.
6. Verify desktop and mobile compositions visually after any hierarchy change.
7. Treat deployment, staging upload, production promotion, and DNS cutover as separate approval gates described in `cloudflare-deployment-runbook.md`.
