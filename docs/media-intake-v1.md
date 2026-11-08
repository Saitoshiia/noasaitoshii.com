# Show Media Intake V1

Last verified: 2026-07-30
Status: pilot-complete local release; production activation intentionally gated

This is the implementation, threat, cost, and operator contract for
`noasaitoshii.com/send`.

## Outcome

V1 is a trusted-friends-first private media drop for original show photos and
short video clips. It is designed to become public-facing without changing the
core trust boundary, but this work does not remotely deploy it or connect paid
storage.

The local release is end-to-end:

```text
mobile picker / desktop drop
  -> personalized or shared private invite
  -> attributable identity + explicit versioned permission
  -> bounded upload session
  -> 16 MiB resumable parts
  -> private R2-compatible quarantine
  -> server-side signature allowlist
  -> separate private eligible store
  -> technical eligibility
  -> explicit operator approve / reject
  -> approved original download
```

The contributor page is `/send`. The loopback-only review page is
`/send/review`.

The completed pilot also includes reload-safe multipart recovery, an atomic
checksum-verified Mac pull, a durable JSONL delivery manifest, delivery
acknowledgement, operator metrics, foreground watch mode, lifecycle templates,
bounded request throttling, and automatic 45-day state-metadata cleanup.

The operator API now also exposes a versioned
`/api/media-intake/operator/control-plane` metadata snapshot for the planned
Notion and Miinrva app clients. It contains sanitized invitation/submission
state and private review paths, never media bytes, object keys, cookies, IP
addresses, or direct bucket URLs. Personalized invitation commands accept a
stable request ID and replay the same link after an ambiguous retry; production
use requires the separate `MEDIA_INTAKE_INVITATION_SIGNING_SECRET`.

## Accepted media

Only `.jpg`, `.jpeg`, `.png`, `.heic`, `.heif`, `.mov`, `.mp4`, and `.m4v` are
eligible.

The browser extension and MIME checks are usability filters, not the security
decision. After multipart upload, the Worker reads the first 64 KiB and requires
a matching JPEG, PNG, ISO-BMFF HEIC/HEIF, QuickTime, or MP4 signature. JSON,
JavaScript, SVG, PDF, ZIP, documents, audio-only files, and unknown binaries
have no accepted route.

Original filenames are metadata only. Object keys use server-generated UUIDs,
and download names are sanitized before entering a response header.

## Implemented security boundary

- Same-origin API requests only.
- Disabled-by-default remote intake.
- Strong invite secret stored as a SHA-256 hash, never the plaintext code.
- Opaque personalized links for one-time recipients and revocable trusted
  friends. Opening one moves the bearer secret into a Secure, HttpOnly,
  SameSite=Strict cookie and redirects to `/send` so the secret leaves the
  address bar.
- Personalized links record intended recipient provenance without pretending
  to prove legal identity. Confirmed name/handle and invite identity are kept
  separately and mismatches are surfaced to the operator.
- Every submission requires a name or social handle, a credit preference, and
  two unchecked permission confirmations. The server stores its own exact
  consent wording, version, acceptance time, and a keyed one-way IP
  pseudonym when production rate-limit configuration is present.
- Explicit local mode restricted to `localhost` and `127.0.0.1`.
- A fail-closed server-verification hook for Cloudflare Turnstile; its browser
  challenge remains part of the public-opening gate.
- Defaults of 12 files per session, 5 GiB per file, 10 GiB per session, and
  20 GiB per UTC day.
- 72-hour upload-session expiry.
- HttpOnly, SameSite=Strict upload-session cookies; Secure outside loopback.
- No upload credential in browser-readable JavaScript or local storage.
- Reload recovery stores only non-secret file descriptors and requires the
  contributor to reselect matching originals before resuming missing parts.
- Fixed 16 MiB multipart uploads with exact part-size validation.
- Server-generated session, file, and storage identities.
- Separate private quarantine and eligible buckets with no public object URLs.
- Content-signature verification before promotion and a held state on mismatch.
- Technically eligible files stop at `pending_review`; only an explicit private
  operator approval makes them downloadable. Rejection never makes an object
  downloadable.
- No automatic previewing, transcoding, or parsing of an untrusted upload.
- No media bytes through n8n.
- Operator listing/download separated from the contributor API.
- Dedicated Keychain-backed operator credential for remote Mac pulls.
- Atomic partial-file delivery with size, eligible ETag, and SHA-256 proof.
- Delivery acknowledgement only after the local manifest is fsynced.
- Separate hourly per-IP limits for failed invite guesses and accepted session
  creation without retaining the raw IP; the higher accepted-session ceiling
  avoids penalizing friends sharing venue Wi-Fi.
- Daily pruning of attempt keys, session metadata older than 45 days, and
  invitation records 45 days after expiry or revocation.
- `no-store`, `nosniff`, and explicit cross-origin denial.

The Durable Object is the atomic reservation/state ledger, preventing concurrent
sessions from racing past the daily byte ceiling.

## Honest residual risk

This is safer than accepting arbitrary DM attachments because it narrows
formats, storage topology, size, access, and handling. It does not make
untrusted media harmless.

Signature validation is not antivirus and cannot detect every malicious
polyglot or a future decoder vulnerability. V1 deliberately avoids thumbnails,
EXIF extraction, ffmpeg, or opening files during intake. Noa still controls the
final download/open step. That topology is the primary defense.

Before a general-public opening:

1. Require Turnstile and validate every token server-side.
2. Create a Cloudflare rate-limit rule for session creation.
3. Generate recipient links from the private operator surface; prefer one-time
   links for Instagram contacts and revocable trusted links for known friends.
4. Set R2 lifecycle rules to abort incomplete multipart uploads after one day,
   delete held quarantine after seven days, and expire eligible objects after
   the chosen pull window.
5. Set billing notifications and confirm the account cannot silently create an
   unacceptable spend.
6. Verify both buckets, CORS, and public-access settings are private.
7. Run a real iPhone fixture pass in Safari and Instagram's in-app browser,
   including an airplane-mode interruption.
8. Add an isolated parser/sandbox only if previews or normalization become
   necessary. Do not install ffmpeg merely to claim a stronger scan.

## Cost model

The implementation adds no application dependency and no subscription product.
Cloudflare R2, Workers, and Durable Objects can begin inside free allowances,
but those limits and prices must be rechecked immediately before activation.

Cost is bounded by byte reservations and short retention, not by monitoring
alone. Production values are operator-configurable without a UI rewrite.

## Local operation

```bash
cd /Users/noasaitoshii/Miinrva/projects/noasaitoshii/websites/noasaitoshii.com
npm run preview:intake
```

Then use:

```text
Contributor: http://127.0.0.1:8787/send
Private review: http://127.0.0.1:8787/send/review
```

Local mode inserts its non-secret fixture invite. Uploaded objects live only in
Wrangler's ignored `.wrangler/` development state.

The operator workflow, holding-folder permissions, pull/watch commands,
delivery semantics, close procedure, and incident stop conditions are in
`docs/media-intake-operator-runbook.md`.

Proof commands:

```bash
npm test
npm run build
```

The suite covers format sniffing, descriptor limits, cross-origin denial,
malformed input, fail-closed missing configuration, production cookie security,
invite expiry, personalized one-time link consumption, secret non-disclosure,
idempotent invitation retry, sanitized control-plane projection, versioned
consent, identity/credit validation, atomic throttling, explicit
approval before download, mismatch holding, metadata retention, verified Mac
delivery, acknowledgement recovery, idempotency, and partial cleanup on
integrity failure.

The 2026-07-28 live pilot proof used a 256 MiB multipart fixture: pause, reload,
reselect, missing-part resume, promotion, operator listing, Mac pull into a
mode-700 temporary folder, byte/ETag/SHA-256 verification, three-entry fsynced
manifest, delivery acknowledgement, and a zero-work second pull all passed.
Desktop and 390 px mobile browser checks passed with no console errors.

The dependency hardening pass on 2026-07-28 removed unused React, Router,
React-icons, React-Vite, GitHub Pages, and legacy Vite packages; moved the
remaining Astro/Cloudflare tooling to reviewed fixed versions; regenerated and
installed the lockfile with lifecycle scripts disabled; and finished with zero
reported npm vulnerabilities. All 29 tests, the 18-page build, Cloudflare
staging dry-run, and local `/send` plus `/send/review` browser smoke passed.

## Production activation gate

The repository includes exact binding and lifecycle templates, but this work
did not create a remote bucket, Durable Object, secret, Turnstile widget,
lifecycle policy, billing alert, deployment, or DNS change.

> **STOP — VERIFY BEFORE DEPLOY**
>
> Expected change: two private R2 buckets, one Durable Object namespace,
> hashed invite/operator secrets, Turnstile when public, lifecycle deletion,
> rate limits, and a reviewed cost ceiling.
>
> If any bucket is public, a secret would enter Git/chat/shell history, lifecycle
> deletion is absent, or billing can exceed the accepted ceiling, cancel the
> activation and keep using the local/trusted-friends release.

Remote activation follows `docs/cloudflare-deployment-runbook.md` and requires a
separate evidence packet plus Noa's approval for each security-relevant account
change.

The included permission language is a carefully bounded product draft, not
legal advice. Before opening intake to the general public, have qualified
counsel review the wording, retention disclosure, age policy, and any
event/venue-specific publicity or third-party-rights concerns. A contributor
cannot grant rights they do not possess.

## Design provenance

The interaction anatomy was quarried from the MIT-licensed beUI file-upload
block, then rebuilt as a Saitoshii-owned component using the site's tokens,
typography, state language, BEM CSS, mobile layout, and accessibility rules. No
beUI dependency, Tailwind skin, icon dependency, or copied component code ships.

The reusable extraction is
`../../../../../docs/saitoshii-ui/file-upload-reference-extraction.md`.

## Future engineering references

Research candidates, not installed dependencies:

- Uppy for uploader state and future cross-reload recovery.
- tus / tusd if a self-hosted resumable protocol becomes preferable.
- `file-type` for broader signatures after a dependency security pass.
- OWASP File Upload Cheat Sheet for continuing threat review.
- Cloudflare's creator-upload and R2 multipart examples.

Adopt none automatically. The dependency-free path is smaller and adequate for
trusted-friends V1.
