# Noa Saitoshii Website Release Closeout — 2026-09-07

## Outcome

The current Astro source is a useful, internally coherent **local public-release candidate** for review. It is not yet production-ready: the refreshed dependency audit remains vulnerable, and nothing in this pass was deployed, pushed, committed, or connected to the public domain.

The minimal candidate presents one clear visitor journey:

1. understand Noa's artist identity and sound;
2. see eight upcoming appearances with viewer-local times;
3. open complete event details or the 17-entry past-event archive;
4. see live status or open either Twitch channel directly;
5. hear three representative DJ sets through exact SoundCloud recording URLs;
6. understand selected performance context and Saitoshiia's relationship to the artist;
7. reach Noa through current public social, email, Instagram, or Discord paths.

## Source changes in this pass

- Reduced the shared header to public-ready destinations: Events, Listen, About, Links, Contact, and Twitch.
- Removed public navigation to the private `/epk`, unactivated `/book`, and invitation-only `/send` surfaces.
- Replaced the homepage EPK call to action with the approved `contact@saitoshii.com` booking and press path.
- Converted `/book` into an honest direct-contact fallback using email and Instagram while the structured booking backend remains in private testing.
- Changed both EPK booking actions to email so the private EPK does not depend on the unactivated booking transport.
- Added `noindex, nofollow` to `/book`, `/send`, and `/send/review`; `/epk` already had it.
- Removed the homepage link to `saitoshiia.com/attend/ffxiv-free-trial/` after live verification returned HTTP 404. The separate Saitoshiia site can restore that journey when its route is actually public.
- Reduced the featured DJ-set list from five rows to three exact, live SoundCloud recording URLs. Two removed rows named specific sets but linked only to the generic tracks index.
- Fixed compact-width section headings so the viewer timezone moves beneath the title and cannot clip horizontally.
- Made compact header grid placement explicit so the Twitch live control retains its own right-hand column after navigation collapses.
- Updated regression tests to preserve these public/private and responsive boundaries.
- Derived one effective event lifecycle state at the shared data projection. Event detail, homepage, and archive views now agree when a source row still says `upcoming` after its `endsAt` timestamp.
- Restored the adopted compact header contract: the persistent header shows the standalone Noa symbol with an accessible home label, without pairing it with the name.
- Added a local `npm run build:public` candidate that builds normally, then removes the complete `/epk/**` and `/send/**` artifact trees from `dist`. Authored preview pages remain in source for a future protected-staging build; the production deploy command has not been changed or run.

## Preserved preexisting work

The worktree was already on branch `main` with an uncommitted change to `src/data/public-events.generated.json`. That event export refresh was preserved and not rewritten by this pass. It updates the export timestamp/window, marks the September 4 Obsidian event as past, and renames the September 11 record to `Obsidian: 4 Year Anniversary` with its new slug.

The operational runbook still names `redesign-v2` as the current migration branch. Verified local evidence on 2026-09-07 is `main@c0a51e2`; local branch inventory also contains `redesign-v2@917bce2`. No fetch or remote branch-parity check was performed, so this is a local-state statement only. The parent release owner must reconcile the old runbook wording before any stage/commit/push decision.

## Verification evidence

### Functional and build

- `npm test`: PASS — 71 tests, 0 failures (the earlier 67 and final 68 counts are superseded by the current suite after three focused release-blocker tests were added).
- Focused lifecycle/header/public-artifact suite: PASS — 15 tests, 0 failures.
- `npm run build:public`: PASS; normal Astro generation completed before the exact deferred-route exclusion.
- Public event validator: PASS — 25 events.
- Astro output: PASS — 32 generated pages.
- Public artifact after exclusion: PASS — 29 HTML files; 25 event-detail pages; no `dist/epk` or `dist/send` tree.
- Elapsed-event static detail proof: PASS — `prominence-field-trip-2026-09-06` renders `Metaverse event · past` in built HTML.
- Current archive projection: eight upcoming and 17 past events at the 2026-09-07 build clock.
- `git diff --check`: PASS.
- Previous normal-build internal-link crawl: PASS — 32 HTML files, 0 missing internal destinations.
- Previous normal-build private-route indexing check: PASS for `/book`, `/epk`, `/send`, and `/send/review`.
- Public-artifact isolation check: PASS — no emitted `/epk` or `/send` tree and no remaining HTML link to either route family; the homepage also has no link to `/book`.

### External destinations checked

- Three featured SoundCloud recording URLs: HTTP 200.
- SoundCloud tracks archive: HTTP 200.
- Saitoshiia Discord vanity invite: HTTP 200.
- Saitoshiia FFXIV newcomer-guide route: HTTP 404; removed from this candidate.

### Visual and responsive

- Desktop Chrome proof at 1440 × 1200: coherent hierarchy, symbol-only header, eight-event ledger, and three-recording selection rendered correctly.
- Compact Chrome proof at 390 × 844: symbol-only header, hero, timezone, and event ledger rendered without horizontal clipping.
- Durable project evidence:
  - `docs/evidence/release-2026-09-07/home-desktop-1440x1200.png` — SHA-256 `4b0e3325b44543a14ce9205801ef6f79267c39755e7a7f844d59ee5a55ae9839`
  - `docs/evidence/release-2026-09-07/home-mobile-390x844.png` — SHA-256 `bc51dd9881993415f39f493ad4d9fdf87abcba5178ba9cf663b17a7bf3ab77bc`
- Matching copies are preserved in `docs/orchestration/daily-use/2026-09-05/evidence/` at Miinrva root.
- Compact static-fallback render: typography, hero, event ledger, and warm atmospheric fallback rendered without WebGL.
- True 390px device-metrics read-back:
  - viewport width: 390px;
  - document width: 390px;
  - Twitch header control right edge: 374px;
  - timezone line right edge: 235.75px;
  - no horizontal document overflow.

### Cloudflare preparation

- `npm run check:staging`: PASS as a build plus Wrangler dry-run; no deployment occurred.
- Dry-run upload plan: 81 asset files, 91.63 KiB uncompressed / 21.24 KiB gzip.
- Wrangler warns that production-only media-intake KV, queue, and rate-limit bindings are not inherited by staging. Staging currently keeps media intake disabled, so the minimal public candidate does not depend on those bindings. Parent should preserve that explicit boundary or add staging equivalents only through the normal configuration/security gate.

## Remaining release gates

1. **Noa visual approval:** review this exact local candidate before any remote preview or public change.
2. **Dependency remediation:** the registered read-only audit completed at `2026-09-07T23:29:33Z` and remains `vulnerable`: 3 high, 4 moderate, 0 critical. Exact receipts are `ops/security/reports/dependency-audit/dependency-audit-20260907T232933Z.md` and `.json` at Miinrva root. The project entry itself was audited; the receipt's separate whole-system coverage check also reports two unrelated unregistered manifests. No dependency changed.
3. **Branch/document reconciliation:** confirm why the active worktree is `main` while the runbook describes `redesign-v2`, then choose the exact stage/commit/push set. This pass made no commit.
4. **Protected staging completion:** the existing `noa-saitoshii-staging` Worker remains fail-closed until Cloudflare Access, its allow policy, `TEAM_DOMAIN`, and `POLICY_AUD` are configured and read back.
5. **Staging secrets and behavior:** provision the already prepared Twitch credentials as encrypted staging Worker secrets only after staging approval; verify Access `503`/unauthorized/authorized behavior and `/api/live` without exposing values.
6. **Private staging review:** Noa reviews the authenticated staging URL and explicitly approves or rejects the candidate.
7. **Production deployment and domain cutover:** separate explicit approvals remain required. Preserve GitHub Pages as rollback until Cloudflare production is observed stable.

## Dependency remediation preflight — prepared, not approved or executed

The current dependency graph maps the findings to direct development dependencies:

- `wrangler@4.114.0` → `miniflare@4.20260722.0` → `undici@7.28.0`;
- `@cloudflare/vite-plugin@1.47.0` (override) → vulnerable Wrangler/Miniflare ranges;
- `astro@7.1.3` and `@astrojs/cloudflare@14.1.0` → `js-yaml@4.3.0` and `postcss@8.5.19`;
- root `vite@8.0.16` → `postcss@8.5.19` → `nanoid@3.3.16`.

Audit-safe floors are `js-yaml>=4.3.1`, `nanoid>=3.3.18`, `postcss>=8.5.23`, `undici>=7.29.0`, `@cloudflare/vite-plugin>=1.52.0`, and `wrangler>=4.120.0`. Registry metadata observed candidate direct releases `astro@7.3.1`, `@astrojs/cloudflare@14.3.0`, `vite@8.2.2`, `wrangler@4.129.1`, and `@cloudflare/vite-plugin@1.54.5`; those releases were only zero to four days old at observation, so the Miinrva release-age cooldown is not satisfied and the update verdict remains **CAUTION**.

After the cooldown, refresh metadata and run this exact read-only vet against the then-current candidate set from Miinrva root:

```sh
./miinrva security vet-dependency --command "npm install --save-dev @astrojs/cloudflare@14.3.0 astro@7.3.1 vite@8.2.2 wrangler@4.129.1 @cloudflare/vite-plugin@1.54.5" --json
```

Only if that produces an acceptable evidence packet should Noa be asked to approve the exact lockfile-changing command. The implementation would then require a separate approval, `--ignore-scripts`/lockfile-first handling where compatible, full test/build/public-artifact proof, and a fresh registered dependency audit. None of those mutation steps occurred here.

## Deliberately deferred

- public EPK launch and downloadable press-asset bundle;
- structured booking inquiry transport;
- show-media intake activation and contributor operations;
- additional photography, performance video, YouTube music archive, and unverified DJ-set permalinks;
- automatic Notion/n8n production promotion;
- Saitoshiia newcomer-guide publication.

None of these deferred systems is required for the minimal public candidate described above.
