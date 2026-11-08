# Noa website public build guard

Authority: project-leads-2026-09-07.md, Noa website step 5. Work only in canonical nested website. Preserve a91e5c1 and all concurrent changes. Root owns Git/index/commits.

Own only package.json scripts, tools/exclude-deferred-routes.mjs, a new tools/verify-public-artifact.mjs if useful, tests/public-build.test.mjs, and docs/delivery-build-receipt.md plus launcher-required receipt metadata. Do not change dependency fields or lockfile.

Make the default production deploy command build and verify the public artifact before Wrangler may run. Prove /epk and /send trees absent, including bios, and required homepage/events/404 assets present. Tests must cover an accidentally retained deferred artifact and a missing required artifact. Preserve ordinary protected-preview build. Avoid source deletion; exclude only generated output. No deploy, installs, credentials, live config, remote mutation, Git writes, UI changes, or other source edits.

Acceptance: focused tests and npm run build:public; inspection proves default deploy is ordered after build/guard. Do not execute deploy, including a test that invokes real Wrangler. Capture changed-file SHA256 and exact commands/results in receipt. Existing 71-test evidence need not be repeated unless your change warrants it. Finish with the launcher-defined receipt and metadata. No children. If ownership conflict, report and work only unaffected paths.
