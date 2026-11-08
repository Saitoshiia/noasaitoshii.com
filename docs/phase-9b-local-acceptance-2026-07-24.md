# Phase 9B — Noa website local acceptance

Date: 2026-07-24

The Noa website passed its local event-data and browser acceptance gate.

- The homepage now renders the five live/upcoming Noa appearances in the
  current bundle instead of all fifteen historical and future records.
- A lightweight browser refresh removes an event row when its window ends,
  even if no new static build has occurred.
- Historical event-detail URLs remain generated.
- Confirmed lineup pages render complete viewer-local set windows and
  clickable performer Twitch links.
- The timezone comparison and countdown scripts execute without the previous
  selector collision.
- Countdown copy distinguishes an upcoming set, a set happening now, and a set
  that has ended.
- Five representative routes passed 360px checks with one `h1`, named
  interactive controls, complete image `alt` attributes, and no document-level
  horizontal overflow.

Verification:

```text
npm test: 10/10 passed
npm run build: 17 pages
```

No staging or production deployment occurred, and no Notion, n8n, Discord,
credential, schedule, or public-hosting state changed.
