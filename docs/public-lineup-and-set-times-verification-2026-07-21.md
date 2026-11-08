# Public lineup and set-time verification

Date: 2026-07-21

## Implemented contract

- Public lineups fail closed: if any related booking is not `Confirmed`, has no performer name, or lacks a complete start/end window, the event exposes `lineupStatus: "tba"` with empty `lineup` and `setTimes` arrays.
- Confirmed events expose the complete ordered lineup and UTC set windows together.
- Event and set timestamps are rendered in the viewer's local time zone.
- Metaverse performers link to their Twitch streams when available; IRL set rows do not invent stream links.

## Canonical generated projection

- Generated venue, location, address, UTC event times, Noa set times, and lifecycle status are canonical public facts. They replace stale authored operational values.
- Authored title and subtitle remain deliberate editorial copy.
- A missing or withheld non-stream address is exposed as `Address not published` because the existing public-event validator requires a non-empty address string. Streams retain `address: null` and their existing topic/link behavior.
- Missing generated venue or location values use explicit not-published labels rather than reviving authored operational facts.

## Proof

- `npm test`: 9 passing tests.
- `npm run build`: seven static pages built.
- Shared parity check: three overlapping Saitoshiia/Noa Saitoshii fixtures agree.
- Desktop visual QA:
  - Prominence: Shark Week Garden Party displayed Shaku, Whimxi, and Noa Saitoshii with complete set windows and Twitch destinations.
  - Obsidian (2026-07-24) displayed `Lineup TBA` without leaking partial performers or times.
- Mobile visual QA at 390 × 844: confirmed lineup displayed without horizontal overflow.

Production Notion export automation and deployment were not activated in this work slice.

## September 19 projection proof

- `node --test tests/events.test.mjs`: 11 passing tests, including canonical venue/location/address precedence, withheld-address handling, stream projection, canonical times/status, and retained editorial title/subtitle.
- Package, build, deployment, network, and live-sync commands were intentionally not run for this focused source-only change.

## September 20 runtime freshness

Event-detail state ages only the canonical data embedded in that artifact. Cancelled and postponed states are preserved, with their countdown suppressed. Twitch refresh is visible-only, non-overlapping, bounded by a request timeout, and falls back to direct channel links. No runtime path discovers changed, new, or removed Notion events. The focused Node proof covers source behavior only, not an Astro build, browser, live Twitch, or deployment result.
Persisted pagehide and pageshow cycles pause and resume the embedded runtime across BFCache restoration, while non-persisted pagehide performs final cleanup.
