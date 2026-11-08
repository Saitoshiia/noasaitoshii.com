# Starting release: operator and acceptance packet

## Usable now

The local candidate presents Noa's artist home, events/details/archive, three recordings, Twitch direct links, social links and direct contact. Open the existing Website WIP launcher or run `npm run dev -- --host 127.0.0.1` for local design review. `npm run build:public` emits the minimal public artifact. Review remains local until protected preview is authorized and proven.

EPK and show-media pages are authored prototypes for protected review. Their routes, content, and route-only Astro chunks are absent from public build output. `/book` is a direct email/Instagram fallback; structured booking and media intake are not required for this release. Twitch status requires server-side credentials; direct Twitch links remain usable without that integration. No mail delivery or Twitch authentication was tested in this tranche.

## Current proof

Accepted source baseline: a91e5c1 on local main. New changes bind npm deploy to public build and a fail-fast artifact guard. Two focused public-artifact tests pass, exercising retained deferred routes, missing required files, a directory masquerading as a required file, exclusive deferred chunks, transitive JavaScript/CSS dependencies, a transitively shared chunk, path-containment attempts, and an unrelated unreferenced file that the scoped cleanup must preserve. Real `npm run build:public` passes, validates 25 events and emits 29 public HTML pages after exclusion. Internal destination scan: 29 pages, zero missing targets. Final `_astro` contains exactly two retained-page assets and both are referenced; no orphan `_astro` asset remains. Earlier 71 full-suite checks remain baseline evidence; this slice does not claim a new full-suite run. UI source is unchanged, so existing desktop/390px captures remain applicable.

### Deferred asset trace

The protected Astro build established these direct graph edges:

- every retained page → `BaseLayout.*.css`;
- public `/book` → `book.*.css`;
- deferred `/epk` only → `epk.*.css`;
- deferred `/send` only → `media-intake.*.css`, `MediaUploadQueue.*.js`, and `review.*.js`.

The EPK stylesheet contains selectors and Saitoshii token references only. It contains no biography copy, addresses, links, credentials, generated `content:` strings, or private record data, so its earlier presence was dead build residue rather than a confidentiality breach. The public exclusion now computes retained and deferred `_astro` reachability, including quoted JavaScript imports and CSS `url(...)` edges, and removes only emitted assets reachable exclusively from deferred HTML. It does not perform broad orphan deletion. The real build removed four route-only chunks totaling 46,683 bytes and preserved both public chunks.

Hashes for integration:

- package.json: `10a02866450f1f3d61398010163ce3af855292f6feaf89a6b5e2eb3d97c64575`
- tools/verify-public-artifact.mjs: `90f33b601919ebec8ac7feae1816d0066c4a40b9592112dda98bbe98aced9a96`
- tools/exclude-deferred-routes.mjs: `e7eae1b752276511d8508ae9ebf470ee78cf4ef7e5e63b705980014a274136e4`
- tests/public-build.test.mjs: `2214193b4170cca845bcb21e7b984a402555297e3c339b6c18e2de6209f8a1e2`

Independent review of the new guard remains pending; no author self-review is represented as independent evidence. Root accepted the shared launcher repair for one fresh reviewer attempt, but the real creation returned `runtime_error` before a pane, prompt, or Dispatch and was reconciled without replacement. No retry is authorized under the current runtime disposition.

## Events and freshness

Website consumes only the sanitized committed public bundle, not private Notion content. Site rendering uses the shared effective lifecycle; elapsed details render past at build time, and the event archive reclassifies in the browser. Static detail headings can become stale after a later end boundary until rebuilt. Rebuild immediately before staging/publication; future automatic synchronization is a separate service integration, not established by local tests. Noa set times remain separate from full-event start/end. The single shared export model remains authoritative for both brands; no new database was created.

## Exact pending sequence

1. After a new runtime disposition exists, an independent Sol-medium reviewer examines this slice and the mature dependency proposal. Until then, root can inspect the frozen hashes but no author-owned check is relabeled independent. Security lane refreshes threat evidence and approves the exact manifest/lock resolution before an install. Current registered audit still has three high and four moderate findings.
2. After approved remediation, run full tests, `npm run build:public`, local Worker checks and registered dependency audit. Stop on nonclean project audit or artifact guard failure.
3. Root reconciles remote main `eb55ca4f7ed01a1c95f17f83677268673a19ba1f` with accepted local main `a91e5c1` and creates reviewed commit/push. Do not force-push based on this packet.
4. Read current Cloudflare account, Worker and Access application/policy state through authorized tools, preserving Noa's concurrent Twitch setup. Complete exact separately approved Access configuration and prove denied unauthenticated requests plus authorized 200 for pages/assets/API.
5. For a protected preview of exactly the minimal release, use `npm run build:public`, then the separately approved `wrangler deploy --env staging` with dotenv loading disabled. A broader prototype preview uses normal build but must stay Access-protected. Validate staging origin, TLS, assets, event dates, mobile layout and credentialless Twitch fallback before Noa reviews it.
6. After explicit production approval, run `npm run deploy` from reviewed source. Beforehand confirm target account/environment and ensure no unintended env argument; this command includes public build/guard. Verify importer configuration uses `npm run build:public` if Git integration is used. The production Worker can be deployed before domain cutover only under the existing disabled-public-preview configuration.
7. Snapshot current DNS and retained GitHub Pages source. Obtain the separate domain-cutover approval, apply exact reviewed domain configuration, then read back apex/www/TLS/404/events/contact/recording links, `/api/live`, and 404 for `/epk`, `/epk/bios.txt`, `/send`, `/send/review` and unknown paths. Confirm unauthenticated deferred routes cannot be served from old cached artifacts.
8. Keep GitHub Pages/source and DNS snapshot through the agreed observation period. On failed live acceptance, use the approved runbook rollback: restore previous DNS/route association and verify old site. Do not retire GitHub Pages during initial cutover.

## Live evidence and limits

At September 7 17:09 PDT, apex HTTPS returns 200 from GitHub.com; www returns 301 to apex. New candidate is not live. No Cloudflare settings, secrets, external schemas, DNS, deployed artifacts, Git index or commits changed in this lead tranche. Read-only advisory/registry lookups and public HTTP/remote-ref checks are real service evidence; unit/build checks are local proof only.
