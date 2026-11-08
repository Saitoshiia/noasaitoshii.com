# Cloudflare Deployment, Staging, and Cutover Runbook

Historical configuration verification: 2026-07-28; see September 7 addendum below for current scoped evidence.
Project: `noasaitoshii.com`  
Repository: `Saitoshiia/noasaitoshii.com`  
Working branch during migration: `redesign-v2`

## September 7 delivery addendum

The branch and remote-state tables below are historical. Current local accepted candidate is `main@a91e5c1`; remote `refs/heads/main` read with `git ls-remote` is `eb55ca4f7ed01a1c95f17f83677268673a19ba1f` (September 8 00:09 UTC / September 7 17:09 PDT). No fetch, merge or remote parity is implied. Root owns reconciliation and commits.

Current unauthenticated HTTPS HEAD read-back: apex `https://noasaitoshii.com` returns 200 with `server: GitHub.com`; `https://www.noasaitoshii.com` returns 301 to apex. This confirms existing public hosting, not Cloudflare candidate deployment. Access/staging account state has not been freshly read in this tranche; historical locked-state claims below must be reverified before use.

The production command candidate now runs `npm run build:public` and its artifact guard before Wrangler. Public output excludes the complete EPK/send route families and their route-only generated `_astro` assets, and must contain homepage, events index, 404 and favicon. The exclusion computes retained/deferred asset reachability and preserves any shared dependency; it is not a filename-specific deletion or broad orphan sweep. Ordinary `npm run build` intentionally retains deferred pages and chunks for protected review and must never supply production upload directly. The configured Cloudflare Git importer build command must be changed to `npm run build:public` and verified at the separate live-configuration gate; this addendum does not claim that dashboard setting is already changed. A raw `wrangler deploy` bypasses npm's guard and is not the reviewed production procedure.

See `delivery-release-packet-2026-09-07.md` for current evidence, exact pending sequence and operator limitations; dependency install/deployment/domain approvals remain distinct.

This is the operational source of truth for moving the Noa Saitoshii artist site from GitHub Pages to Cloudflare Workers Static Assets. It records what is active, what is only prepared, the exact committed settings, security boundaries, approval gates, validation steps, and rollback path.

Do not infer that a setting shown here is active remotely unless its state is explicitly marked **active remotely**. The Astro/Worker migration remains an uncommitted worktree change. The protected staging Worker now exists, but Cloudflare Access setup is incomplete and the Worker intentionally fails closed.

## 1. Current state at a glance

| Surface | State | Exact status |
|---|---|---|
| Public production site | Active remotely | The existing GitHub Pages site remains live at `https://noasaitoshii.com`. No production cutover has occurred. |
| DNS | Active remotely | External DNS resolution still points the apex at GitHub Pages IPs and `www` at `saitoshiia.github.io`. See the rollback snapshot below. |
| Git branch | Local | Work is on `redesign-v2`. The branch had no configured upstream when checked. |
| GitHub repository | Active remotely | Public repository; default branch `main`; GitHub API reports Pages enabled. |
| Astro migration | Local only | Present in the worktree; not committed, pushed, merged, or deployed. |
| Production Worker `noa-saitoshii` | Does not exist | Cloudflare API returned code `10007` on 2026-07-16. |
| Staging Worker `noa-saitoshii-staging` | Active remotely, locked | Version `f1524e6e-26e0-4989-8df7-7894e5d0af29` was deployed on 2026-07-17. Its stable `workers.dev` route returns `503 Private preview is not configured.` until Access identifiers are added. |
| Cloudflare Wrangler OAuth | Active locally | `wrangler whoami` succeeds for Noa's Cloudflare account. Token values are not stored in this repository. |
| Cloudflare GitHub App | Active remotely | Installed for the `Saitoshiia` organization with access only to `Saitoshiia/noasaitoshii.com`. |
| Cloudflare repository importer | Prepared only | The form was filled, but its final **Deploy** action was not clicked. No Worker or build project was created by that form. |
| Zero Trust / Access plan | Not activated | Direct Access API inspection is unavailable to Wrangler's OAuth scopes. Dashboard activation/configuration is the remaining account step. Stop if Cloudflare requests a paid plan, card, or overage authorization. |
| Private staging authentication | Implemented; remote gate incomplete | Native RS256 Access JWT validation, issuer/audience/lifetime checks, fail-closed configuration, unit tests, build, dry-run, deployment, and external `503` verification pass. The Access application, email policy, `TEAM_DOMAIN`, and `POLICY_AUD` remain to be configured. |
| Production domain connection | Not configured | No Worker custom domain or route is committed or active. |
| Twitch API secrets | Not configured in Workers | `/api/live` degrades safely when they are absent. |
| Shared public-information integration | Implemented locally | Both websites consume one sanitized bundle generated from the website-approved Notion projection. Automated n8n dispatch and any staging/production deployment remain gated. |
| Show-media intake | Pilot complete locally; remote disabled | `/send`, reload-safe multipart recovery, `/send/review`, checksum-verified Mac delivery, manifest/acknowledgement, and idempotent repull work end-to-end against loopback-only Wrangler R2/Durable Object state. Production binding/lifecycle templates are prepared, but no remote buckets, secrets, Turnstile widget, account rate-limit rule, billing controls, deployment, or DNS changes were created. See `docs/media-intake-v1.md`. |

## 2. Architecture

```text
GitHub repository (source of truth)
  └─ Astro static build (`npm run build`)
       ├─ `dist/` static pages/assets
       └─ Cloudflare Worker (`worker/index.js`)
            ├─ staging: validate Cloudflare Access on every request, then serve site/API
            ├─ production: serve static assets
            ├─ `/api/live`: server-side Twitch status adapter
            └─ `/api/media-intake/*`: disabled-by-default private multipart
               quarantine, signature validation, and operator retrieval

Review flow
  redesign-v2 → local review → protected staging Worker → Noa approval
  → main/approved production source → production Worker → domain cutover
```

The site is static-first. Astro pre-renders the homepage, 404 page, and event detail pages. Browser JavaScript is reserved for progressive enhancements such as viewer-local time conversion and live-state updates.


## Public event data
Public event data has required deployment wiring: see `docs/public-events-contract.md` → "Deployment wiring" in the saitoshiia.com repo (shared by both sites).

## 3. Exact committed Cloudflare configuration

The canonical configuration is `wrangler.jsonc`. Future agents must compare this table against that file rather than copying settings blindly.

### 3.1 Top-level / intended production Worker

| Key | Value | Reason |
|---|---|---|
| `$schema` | `./node_modules/wrangler/config-schema.json` | Wrangler schema validation/editor support. |
| `name` | `noa-saitoshii` | Stable production Worker name. |
| `main` | `./worker/index.js` | Worker entry point. |
| `compatibility_date` | `2026-07-07` | Newest date supported by the installed Wrangler/workerd release at verification time. A later date caused local runtime startup failure. |
| `workers_dev` | `false` | Production must not be reachable through an extra `workers.dev` URL. |
| `preview_urls` | `false` | Version-specific preview URLs are disabled to avoid unreviewed or bypassable public surfaces. |
| `assets.directory` | `./dist` | Astro build output. |
| `assets.binding` | `ASSETS` | Worker binding used by `env.ASSETS.fetch(request)`. |
| `assets.run_worker_first` | `["/api/*"]` | Production Worker code runs for API paths; ordinary static assets remain optimized through Static Assets. |
| `observability.enabled` | `true` | Enables Cloudflare Worker observability. Verify retention and sampled data after first deployment; never log credentials or authorization headers. |

There are deliberately no production `route`, `routes`, or `custom_domain` entries yet. Domain cutover is a separate explicit approval gate.

### 3.2 Staging environment

Wrangler derives the staging Worker name as `noa-saitoshii-staging` from the top-level name plus `--env staging`.

| Key | Value | Reason |
|---|---|---|
| `env.staging.workers_dev` | `true` | Provides one stable HTTPS review URL after staging deployment. The URL is protected by Worker authentication. |
| `env.staging.preview_urls` | `false` | Prevents version-specific preview URLs from creating extra access paths. |
| `env.staging.vars.ACCESS_AUTH_REQUIRED` | `"true"` | Non-secret, committed fail-closed switch. |
| `env.staging.assets.directory` | `./dist` | Repeated because bindings/environment variables are non-inheritable across Wrangler environments. |
| `env.staging.assets.binding` | `ASSETS` | Repeated staging asset binding. |
| `env.staging.assets.run_worker_first` | `["/*"]` | Every staging request reaches the Worker authentication gate before any page, asset, or API response. |

The staging environment does not contain a shared password. `ACCESS_AUTH_REQUIRED` is not a secret; it activates the gate. After the Access application exists, add its non-secret `TEAM_DOMAIN` and `POLICY_AUD` identifiers to this environment and redeploy.

## 4. Private staging authentication with Cloudflare Access

### 4.1 Intended use

This is temporary review authentication for Noa and a very small number of explicitly authorized reviewers. Cloudflare Access protects the `workers.dev` route before the Worker executes. Email one-time PIN login keeps the review flow usable on mobile without a VPN or shared password.

The Worker independently validates the signed Access assertion. This defense-in-depth check follows Cloudflare's requirement that a Worker behind Access validate the `Cf-Access-Jwt-Assertion` header instead of trusting its presence.

### 4.2 Request flow

`authorizeAccess(request, env)` runs at the very beginning of the Worker's `fetch` handler.

1. If `ACCESS_AUTH_REQUIRED` is not exactly `"true"`, the staging gate does nothing. This is the production behavior.
2. If Access is required but `TEAM_DOMAIN` or `POLICY_AUD` is absent, return `503 Private preview is not configured.`
3. If the `Cf-Access-Jwt-Assertion` header is absent or invalid, return `403 Cloudflare Access authentication required.`
4. Fetch the account's public Access signing keys, select the token's RS256 key ID, and verify the signature with Web Crypto.
5. Verify issuer, application audience, expiration, and not-before claims with a 30-second clock tolerance.
6. Only then continue to `/api/live` or static asset handling.

### 4.3 Security controls

- Fail closed when Access identifiers are missing; an incomplete account setup cannot expose the site.
- Authenticate before both static assets and `/api/*` in staging.
- Validate RS256 signatures using the account's HTTPS JWKS endpoint and Web Crypto.
- Require the exact team-domain issuer and staging-application audience.
- Reject expired and not-yet-active tokens.
- Cache only public signing keys for one hour.
- Add `Cache-Control: no-store` to authentication and misconfiguration responses.
- Add `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff` to private responses.
- Never log Access JWTs, authorization cookies, or identity assertions.
- Keep version-preview URLs disabled.
- Keep production `workers.dev` disabled.

### 4.4 Required staging identifiers and policy

| Setting | Scope | Value policy |
|---|---|---|
| `TEAM_DOMAIN` | `noa-saitoshii-staging` only | Non-secret `https://<team>.cloudflareaccess.com` issuer shown when Access is enabled. |
| `POLICY_AUD` | `noa-saitoshii-staging` only | Non-secret, immutable application audience tag shown when Access is enabled. |
| Access Allow policy | Cloudflare account | Permit only `noa@saitoshii.com` initially. Add reviewers individually; never use an everyone/public bypass rule. |
| Identity provider | Cloudflare account | Email one-time PIN for approved addresses. |

The identifiers are not credentials and may be committed to the staging Wrangler environment after account creation. Access JWTs, cookies, OTPs, and OAuth/API tokens remain secrets and must never appear in Git, documentation, chat, command arguments/history, screenshots, or logs.

### 4.5 Provisioning sequence after design approval

Use this safe sequence only after Noa approves the design candidate for protected staging:

1. Confirm `git status`, active branch, diff, and that the intended design files are complete.
2. Run the build and staging dry-run checks in section 10.
3. Run `npx wrangler deploy --env staging`. With Access identifiers absent, this produces a fail-closed `503`, not a public preview.
4. Activate Cloudflare Zero Trust Free only if no card, paid plan, or overage authorization is required. Stop and request a cost decision if any appears.
5. Protect the specific `noa-saitoshii-staging` Worker with a self-hosted Access application.
6. Configure email one-time PIN and an Allow policy restricted to `noa@saitoshii.com`.
7. Record the modal's non-secret `TEAM_DOMAIN` and `POLICY_AUD` in the staging Wrangler vars, then redeploy.
8. Test unauthenticated redirect, unapproved email denial, approved-email OTP, authenticated `200`, event pages, assets, and `/api/live`.

### 4.6 Browser handling note

Access uses a browser session cookie. Review on a private device, sign out or close the private session after review on shared devices, and never paste an OTP into chat.

## 5. Worker behavior outside staging auth

### 5.1 Twitch live endpoint

`GET /api/live` checks these channels:

- `noasaitoshii`
- `noasaii`

Required production/staging Worker secrets for live Twitch status:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Local credential preparation completed on 2026-07-16:

- the Twitch Developer application is registered as **Noa Saitoshii Website Live Status**;
- its confidential client credentials are stored only in the macOS login Keychain under account `noasaitoshii`;
- Keychain service references are `miinrva.twitch.noasaitoshii-website.client-id` and `miinrva.twitch.noasaitoshii-website.client-secret`;
- a client-credentials OAuth handshake succeeded;
- a local Worker request to `/api/live` returned `200` with sanitized records for both `noasaitoshii` and `noasaii`;
- no credential value was written to the repository, documentation, shell history, or persistent temporary file.

The Twitch values have **not** been provisioned into Cloudflare staging or production. Do that only after the protected staging Worker exists and Noa approves the staging deployment. If absent, the endpoint returns a controlled `503` with `configured: false`; the site falls back to direct Twitch channel links.

The Worker obtains a Twitch app access token server-side, caches it for at most one hour, requests Helix stream state, and returns only sanitized live state: live boolean, title, game, and start time. Twitch secret values never reach browser JavaScript.

### 5.2 Static asset security headers

Static responses receive:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `X-Frame-Options: SAMEORIGIN`
- Content Security Policy:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'`
  - `style-src 'self'`
  - `img-src 'self' data:`
  - `connect-src 'self'`
  - `frame-ancestors 'self'`
  - `base-uri 'self'`
  - `form-action 'self'`

Re-test the CSP when adding fonts, embeds, analytics, externally hosted images, or third-party scripts. Do not loosen it preemptively.

## 6. GitHub and Cloudflare connection

### 6.1 GitHub repository

- Organization: `Saitoshiia`
- Repository: `Saitoshiia/noasaitoshii.com`
- Git remote: `https://github.com/Saitoshiia/noasaitoshii.com.git`
- Visibility: public
- Default branch: `main`
- GitHub Pages flag: enabled
- Git remains the code source of truth.
- Current migration branch: `redesign-v2`
- Intended production branch: `main`, after review and an explicit merge/promotion decision.

### 6.2 Installed Cloudflare GitHub App

Active remote installation settings recorded during authorization:

- App: **Cloudflare Workers and Pages**
- Owner/organization: **Saitoshiia**
- Repository access: **Only select repositories**
- Selected repository: **Saitoshiia/noasaitoshii.com**
- Not selected: `Saitoshiia/saitoshiia.com`
- Displayed repository permissions:
  - metadata: read
  - administration: read/write
  - checks: read/write
  - code/contents: read/write
  - deployments: read/write
  - pull requests: read/write

Do not broaden the installation to all repositories. Add `Saitoshiia/saitoshiia.com` only during a separately scoped Saitoshiia-site deployment task with Noa's approval.

### 6.3 Repository importer values that were prepared but not submitted

The following values were entered into Cloudflare's repository setup form. The final **Deploy** action was deliberately not clicked because the approved Astro redesign was not yet on the production source branch.

| Field | Prepared value |
|---|---|
| Repository | `Saitoshiia/noasaitoshii.com` |
| Project/Worker name | `noa-saitoshii` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch builds | Enabled in the form |
| Non-production command | `npx wrangler versions upload` |
| Root directory | `/` |
| API token option | `Create new token` was the default; no token creation was submitted |

Treat these as a draft, not remote state. Re-open and verify every value before submitting. In particular, confirm the production branch and ensure unreviewed branch builds cannot publish an unauthenticated URL.

### 6.4 Wrangler local authorization

`npx wrangler whoami` was verified on 2026-07-16. The interactive OAuth grant is broad and suitable only for Noa's local authorized administrative session. It includes Worker, Pages, routing, zone-read, certificate, storage, AI, queue, pipeline, browser, and other Cloudflare scopes.

Security boundary:

- Do not copy the OAuth token into GitHub Actions, `.env`, shell profiles, documentation, or chat.
- Do not treat this broad interactive grant as the future CI credential.
- When CI deployment is activated, use the narrow token created by the Cloudflare Git integration or a separately reviewed least-privilege API token scoped to this account/Worker.
- Future agents should run `npx wrangler whoami` to verify the currently authorized account rather than relying on a copied account identifier.
- Account email and account ID are intentionally omitted from this repository because they are not required configuration. They are available through the authenticated read-only command.

## 7. Cloudflare products, plan, and cost state

### Active/authorized

- Existing Cloudflare account and domain/DNS management.
- Wrangler OAuth authorization.
- Cloudflare Workers and Pages GitHub App, limited to one repository.

### Not activated

- Cloudflare Zero Trust Free checkout was previously opened, but its activation page required accepting authorization for charges when usage exceeds free limits.
- The checkout was exited.
- **Activate Zero Trust Free** was never pressed.
- No Zero Trust plan or Access application was created in this session.

### Cost discipline

- The GitHub App itself did not introduce a charge.
- No paid Worker plan or add-on was activated.
- The intended site should fit within Cloudflare's free Workers/Static Assets/Builds allowances at its present traffic and build frequency, but free-plan limits can change and overages/products must be reviewed at deployment time.
- Never accept a paid-plan, overage, credit-card authorization, Workers Paid upgrade, or additional Cloudflare product without an explicit cost review and Noa's approval.

## 8. Current DNS snapshot and cutover boundary

Read-only DNS verification on 2026-07-16 returned:

### Apex `noasaitoshii.com`

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153

2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

These are the current GitHub Pages targets.

### `www.noasaitoshii.com`

```text
CNAME saitoshiia.github.io.
```

This is a point-in-time rollback snapshot, not permission to edit DNS.

Production cutover means attaching the approved production Worker to `noasaitoshii.com` and deciding the canonical behavior for `www`. That action changes public traffic and requires a fresh DNS snapshot plus Noa's explicit final approval.

Keep GitHub Pages and its known-good source available until the Cloudflare production deployment, domain, TLS, redirect, and smoke tests all pass.

## 9. Local environment and secret hygiene

The project ignores:

- `.env*`
- `.dev.vars*`
- `.wrangler/`
- build output and dependencies

During testing, Wrangler automatically discovered an existing ignored `.env` file containing unrelated Notion variables. Values were hidden and nothing was deployed, but this demonstrated why Cloudflare tests must not load the generic project environment.

Use:

```bash
npm run preview:staging
```

The package script sets `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`, sends Wrangler's disposable diagnostic log to `/tmp/noasaitoshii-wrangler.log`, and runs `wrangler dev --env staging`. `npm run preview:cloudflare` applies the same safeguards to the top-level local Worker preview.

Unit tests generate a disposable RSA keypair and signed JWT entirely in memory. Do not place real Access assertions or cookies in local environment files.

`.wrangler/` contains generated Miniflare/Worker local state and cache databases. It is ignored and must not be committed. Do not assume it is portable project state.

## 10. Verification commands and known-good results

### Build

```bash
npm run build
```

Known-good result on 2026-07-28: 18 pages generated successfully.

### Staging dry-run

```bash
npm run check:staging
```

The script runs `npm run build` followed by `wrangler deploy --env staging --dry-run`, with the Wrangler log redirected to `/tmp/noasaitoshii-wrangler.log`; the `--dry-run` flag prevents a remote deployment.

Known-good result on 2026-07-28:

- 50 static asset files read
- Worker upload bundle generated
- `env.ASSETS` binding present
- `env.ACCESS_AUTH_REQUIRED ("true")` present
- `env.MEDIA_INTAKE_ENABLED ("false")` present
- no remote deployment performed

### Media-intake completion receipt

```bash
npm test
npm run build
npm run check:staging
```

Known-good result on 2026-07-28:

- 29 tests passed;
- 256 MiB multipart pause/reload/reselect/resume passed in the browser;
- three verified originals pulled into a mode-700 folder;
- local manifest SHA-256 values matched independent read-back;
- delivery acknowledgement changed the review count from ready `3` to
  delivered `3`;
- a second pull reported downloaded `0`, acknowledged `0`, pending `0`;
- desktop and 390 px mobile checks produced no browser console errors.

### Diff hygiene

```bash
git diff --check
git status --short
```

Do not stage unrelated user/design-agent changes accidentally. The worktree is intentionally dirty during redesign.

### Local staging authentication receipt

Verified with Node's Web Crypto implementation on 2026-07-17:

| Case | Expected | Observed |
|---|---:|---:|
| Valid RS256 token, issuer, audience, and lifetime | accepted | accepted |
| Wrong application audience | rejected | rejected |
| Expired token | rejected | rejected |
| Access required but identifiers absent | `503` | `503` |
| Identifiers present but assertion absent | `403` | `403` |

### Remote existence receipt

The production Worker still returns Cloudflare API code `10007`. Staging deployment version `f1524e6e-26e0-4989-8df7-7894e5d0af29` became active on 2026-07-17. After a brief propagation response, an external HTTPS request reached the Worker and returned the expected fail-closed `503`.

## 11. Approval gates

These gates are intentionally separate. Approval of one does not imply approval of the next.

### Gate A — design candidate complete

- Design agent finishes the candidate.
- Noa reviews it locally.
- Functional content, responsive behavior, typography, event data, links, and visual polish are accepted for staging.

### Gate B — protected staging deployment

Approved and partially completed on 2026-07-17. The Worker exists and is fail-closed. Gate B remains incomplete until the Access application, email policy, identifiers, JWT validation, and authenticated mobile test all pass.

### Gate B2 — protected show-media pilot activation

Requires a separate security/cost evidence packet and exact approval to create
two private R2 buckets, apply/read back both lifecycle policies, migrate the
Durable Object, provision hashed invite/operator/rate-limit secrets, add
Turnstile's client dependency and narrow CSP hosts, set the event expiry, verify
billing notifications, and enable the intake flag. A real iPhone Safari and
Instagram in-app-browser interruption/recovery test follows this protected
activation; loopback alone cannot prove those network conditions.

### Gate C — production source promotion

Requires an intentional commit/push/merge decision. Confirm the GitHub branch and review the full migration diff, including deletion of the old GitHub Pages workflow.

### Gate D — production Worker deployment

Requires Noa's approval to create/deploy `noa-saitoshii`. Production `workers.dev` remains disabled and no domain traffic changes merely from this Worker deployment.

### Gate E — public domain cutover

Requires Noa's explicit final approval after reviewing the production candidate. Attach `noasaitoshii.com`, establish `www` redirect/canonical behavior, verify TLS and DNS, and smoke-test the public site.

### Gate F — retire GitHub Pages

Only after a stable observation window. Keep the rollback path until Cloudflare production is confirmed healthy.

## 12. Post-design deployment checklist

### Before staging

- [ ] Design approved for protected staging.
- [ ] `git status` reviewed; no unrelated changes included.
- [ ] `npm ci`/dependency state reviewed under Miinrva's dependency gate if installation is needed.
- [ ] `npm run build` passes.
- [ ] Staging dry-run passes.
- [ ] Links and event details reviewed.
- [ ] Responsive test completed at representative mobile/tablet/desktop widths.
- [ ] Accessibility basics checked: keyboard navigation, focus visibility, headings, landmarks, contrast, reduced motion.
- [ ] Access Free activation confirmed without paid-plan/card/overage acceptance.

### Protected staging

- [x] Deploy fail-closed staging Worker.
- [ ] Enable Access for the staging Worker.
- [ ] Restrict the Allow policy to `noa@saitoshii.com`.
- [ ] Add `TEAM_DOMAIN` and `POLICY_AUD`, then redeploy.
- [ ] Verify unauthenticated redirect/denial and authenticated `200`.
- [ ] Verify static pages and `/api/live` cannot bypass auth.
- [ ] Confirm OTP login works on Noa's phone.
- [ ] Noa reviews staging URL.

### Before production Worker

- [ ] Staging design approved.
- [ ] Final source committed and pushed intentionally.
- [ ] Full branch diff reviewed.
- [ ] GitHub build integration values re-verified.
- [ ] Production Twitch secrets either provisioned securely or fallback behavior explicitly accepted.
- [ ] Production dry-run passes.
- [ ] No production route/custom domain configured prematurely.

### Domain cutover

- [ ] Fresh DNS snapshot recorded.
- [ ] Existing GitHub Pages site confirmed healthy immediately before cutover.
- [ ] Production Worker attached to apex custom domain.
- [ ] `www` canonical redirect/route decision implemented.
- [ ] HTTPS/TLS valid.
- [ ] Home, event pages, 404, assets, social links, Twitch fallback/live state, local timestamps, and mobile navigation tested.
- [ ] Security headers checked.
- [ ] Cloudflare logs/observability show no unexpected errors or sensitive values.
- [ ] Noa gives final public approval.

## 13. Rollback plan

### Staging rollback

- Remove or disable the staging Worker only with explicit destructive-action approval.
- Removing either Access identifier from the staging environment causes the Worker to fail closed with `503`.
- Removing the Access policy blocks authentication before the Worker.

### Production before domain cutover

A production Worker without a custom domain and with `workers_dev: false` does not receive public site traffic. Correct the Worker or deploy a prior reviewed version before proceeding.

### Production after domain cutover

1. Stop further deployments.
2. Record the failing URL, time, status, and Cloudflare deployment version.
3. If a known-good Cloudflare version exists, roll back to it through Cloudflare deployment controls.
4. If routing/platform failure persists, detach the Worker custom domain/route and restore the GitHub Pages DNS snapshot from section 8.
5. Verify apex, `www`, TLS, and the public homepage after DNS restoration.
6. Preserve logs and the failed version for diagnosis; do not delete evidence during the incident.

DNS restoration and Worker deletion are external-state/destructive changes and require Noa's approval unless responding under a separately authorized incident contract.

## 14. Remaining work that does not require design decisions

These tasks can be prepared before visual approval, but should not conflict with the active design agent:

1. Keep this runbook and Miinrva project memory synchronized with material infrastructure changes.
2. Audit legacy dependencies (`react`, `react-dom`, `react-router-dom`, `react-icons`, Vite React plugin, `gh-pages`) after the design agent confirms none are still required; removal is dependency-gated and must be separately approved.
3. Prepare a least-privilege CI credential/permissions plan. Do not create the token yet.
4. Draft production smoke-test commands and a header/TLS/DNS evidence receipt.
5. Verify GitHub branch protection/default branch before enabling automatic production deployments.
6. Decide whether Git integration should upload branch versions only or deploy production automatically; the safer default is reviewed staging plus explicit production promotion.
7. Register a Twitch developer application and provision Worker secrets only when Noa is available for login/2FA and explicitly approves app creation.
8. Provision and approve a trusted runner for the implemented shared public-event exporter, then import/bind the inactive n8n orchestration scaffold. Do not activate scheduling or deployment until the runner returns green proof for both consumers. Follow `ops/n8n/contracts/public-event-bundle-sync-gateway.md` from the Miinrva root.

## 15. Deliberate non-actions

As of 2026-07-16, agents deliberately did **not**:

- click Cloudflare's final Deploy button;
- create the production Worker;
- activate Cloudflare Access or create its policy;
- create a Cloudflare CI API token;
- activate Zero Trust Free or accept its overage authorization;
- modify DNS;
- attach `noasaitoshii.com` to a Worker;
- broaden the GitHub App beyond one repository;
- add `Saitoshiia/saitoshiia.com` to the app installation;
- push, merge, or publish the Astro redesign;
- delete/disable the existing GitHub Pages production path;
- configure Twitch or Notion production credentials.

## 16. Primary references

- Cloudflare Wrangler environments: <https://developers.cloudflare.com/workers/wrangler/environments/>
- Cloudflare Worker secrets: <https://developers.cloudflare.com/workers/configuration/secrets/>
- Cloudflare Access protection for `workers.dev`: <https://developers.cloudflare.com/workers/configuration/routing/workers-dev/>
- Cloudflare Access JWT validation: <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/>
- Cloudflare Access email one-time PIN: <https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/>
- Cloudflare Wrangler configuration: <https://developers.cloudflare.com/workers/wrangler/configuration/>
- Cloudflare agent resources (optional): <https://developers.cloudflare.com/agent-setup/>

Wrangler and this repository remain the implementation source of truth. Official documentation should be rechecked before any material deployment because Cloudflare behavior and limits can change.

## 17. Local event preview

The event lifecycle preview is a local review aid. On `localhost` or
`127.0.0.1`, the event list and detail pages show a small **Simulate an event**
control. Choose a published event and select **Simulate live**. The selected
event's clock is placed inside its real event window, so lifecycle state and
published set highlights move together. **Reset to real time** removes the
preview query.

The equivalent direct URL forms are `?preview-live=<published-slug>` and
`?preview-at=<ISO timestamp>`. `preview-at` intentionally works without a
slug, which is useful for checking the whole schedule at a chosen clock.
The control and all simulation behavior are inert on production hosts. The
preview does not write event data or change the generated public bundle.
