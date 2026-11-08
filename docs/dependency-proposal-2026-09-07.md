# Dependency readiness — mature patch proposal

This supersedes the cooldown-only recommendation in the earlier closeout. Read-only evidence collected September 7; no dependency manifest field, lockfile or installed dependency was changed. The current registered receipt remains 3 high / 4 moderate / 0 critical.

## Narrow proposal

Retain current direct dependencies and existing overrides; propose four additional exact overrides:

| Package | Current | Proposed | npm publication |
|---|---|---|---|
| js-yaml | 4.3.0 | 4.3.1 | 2026-07-31T17:39:51Z |
| nanoid | 3.3.16 | 3.3.18 | 2026-08-07T16:41:05Z |
| postcss | 8.5.19 | 8.5.26 | 2026-08-06T08:33:00Z |
| undici | 7.28.0 | 7.29.0 | 2026-07-24T12:52:58Z |

All are older than 14 days. Official npm bulk-advisory lookup for these four exact versions plus retained astro 7.1.3 returned HTTP 200 and `{}` on September 7. This is evidence for those versions only, not proof of the eventual resolved dependency graph or installed-tree cleanliness.

js-yaml and nanoid patched floors are corroborated by GitHub advisories GHSA-5p4m-2wfm-xmqj and GHSA-2v37-7h3g-55p8. PostCSS and Undici floors come from the fresh registered audit. The previously referenced Astro GHSA-26w7-cxv4-gfx2 returned 404 in this lookup; do not assert its affected range from memory or downgrade Astro based on it.

Compatibility: Astro/internal-helpers request js-yaml ^4.1.1; PostCSS requests Nanoid ^3.3.12 (candidate PostCSS requests ^3.3.17). Those accept the proposed patch versions. Miniflare pins Undici exactly to 7.28.0, so the 7.29.0 override deliberately crosses that pin within the same major and needs full Worker/local-runtime testing after approval. Root must review that tradeoff. Upgrading Wrangler 4.125.0 and vite-plugin 1.53.1 is an older alternative but introduces Miniflare 5 alpha and wider tooling churn; it is not the preferred minimal fix.

Provenance: metadata points to nodeca/js-yaml, ai/nanoid, postcss/postcss, and nodejs/undici upstream repositories. npm signatures are advertised for all four; SLSA attestation locators are advertised for Nanoid, PostCSS and Undici, absent for js-yaml. Signature/attestation availability was observed, not cryptographically verified. No preinstall/install/postinstall script is advertised for these four. Undici advertises a prepare script and js-yaml a prepack script; use registry artifacts and ignore scripts in the proposed resolution. No tarball or fetched executable was downloaded.

## Exact actions for root security review (not executed)

1. Review a package.json patch adding `"js-yaml": "4.3.1"`, `"nanoid": "3.3.18"`, `"postcss": "8.5.26"`, `"undici": "7.29.0"` to overrides, preserving all existing fields.
2. After exact approval, resolve with `npm install --package-lock-only --ignore-scripts` in this project. Inspect the lock diff and ensure the four versions resolve, no unrelated downgrades/new lifecycle surprises occur, then run the registered audit.
3. Only after that review/approval, refresh installed dependencies with `npm ci --ignore-scripts`; confirm existing native tooling still builds without running unreviewed lifecycle scripts. Stop if a binary rebuild is required; vet that exact action separately.
4. Run full tests, public build guard, local Worker smoke and fresh registered audit. A clean receipt is required before release readiness.

Verdict: **CAUTION / proposal ready for root review**, not a completed SAFE preflight. Threat register last_scan is July 24 and needs current threat-source reconciliation by the root security lane. No installation approval is requested until that evidence and the Miniflare pin tradeoff are resolved. Source/build work can proceed meanwhile.

Sources: https://registry.npmjs.org/ ; https://github.com/advisories/GHSA-5p4m-2wfm-xmqj ; https://github.com/advisories/GHSA-2v37-7h3g-55p8 ; registered receipt ops/security/reports/dependency-audit/dependency-audit-20260907T232933Z.json at Miinrva root.
