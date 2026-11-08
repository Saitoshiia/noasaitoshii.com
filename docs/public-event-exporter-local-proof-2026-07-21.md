# Public event exporter — local proof

The website now consumes `src/data/public-events.generated.json`, the same
sanitized bundle used by saitoshiia.com. The live local export for
2026-07-01 through 2026-08-03 produced 12 website-approved events and passed
the exporter tests, both consumer test/build gates, Saitoshiia static-route
verification, and the cross-site parity check.

The booking gate is fail-closed: a single unconfirmed or time-incomplete
related booking publishes `Lineup TBA` and no partial lineup. Confirmed events
publish all ordered set ranges, rendered in viewer-local time by the site.

No public deployment, n8n activation, or credential binding occurred. Run
`npm run sync:events` from either website worktree to refresh and verify both
local consumers.
