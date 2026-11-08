# Show Media Intake Operator Runbook

Last verified: 2026-07-30
Operating state: local pilot complete; remote activation gated

This is the concise operating guide for Noa's show-media holding bin. The
security architecture and residual-risk analysis live in
`docs/media-intake-v1.md`.

## Local pilot

Start the loopback-only app:

```bash
cd /Users/noasaitoshii/Miinrva/projects/noasaitoshii/websites/noasaitoshii.com
npm run preview:intake
```

Wrangler prints the actual loopback port. Open:

```text
Contributor: http://127.0.0.1:<port>/send
Operator review: http://127.0.0.1:<port>/send/review
```

The local fixture invite is inserted automatically. Closing the terminal stops
the app. Local objects and state stay under the ignored `.wrangler/` directory.

## Recipient links

Open the operator review page and create either:

- `One-time recipient` for a specific Instagram DM. It permits one successful
  submission and then closes.
- `Trusted friend` for a known repeat contributor. It remains revocable and is
  capped at 100 successful submissions.

Add the intended handle or name, optionally label the show, choose the lifetime,
and create the link. Copy it immediately into the private DM. The full secret is
shown once; only its SHA-256 fingerprint is retained.

The intended handle is provenance, not verified identity. Review the confirmed
handle, any mismatch warning, credit preference, optional email, and recorded
consent version with the submission. Revoke any link that was posted publicly,
sent to the wrong person, or is no longer needed.

Technically valid files arrive as `Needs review`. Approve only media you expect
and want to pull; reject everything else. A file cannot be downloaded until it
has been explicitly approved.

## Notion Command Center

The private production
[`Media Drop Command Center`](https://app.notion.com/p/Media-Drop-Command-Center-3ad1cc9d368881beb083edbae0455b90)
is live under `Noa HQ → Events`. It provides the mobile invitation generator,
active/closed link views, new-submission queue, contributor/consent metadata,
and private deep links into one exact submission on this review page.

The databases and their fail-closed queue buttons are ready, but synchronization
is intentionally inactive. Link generation and submission updates will not
leave Notion until the separately gated n8n workflows are imported, bound,
tested end to end, and activated.

Cloudflare remains the authority. Notion does not store media, approve files,
or expose bucket URLs. n8n will poll outward from the private network; no public
n8n webhook is required.

## Private Mac holding folder

Create one narrow private folder. Do not use the whole home folder, Desktop, or
a broadly shared Dropbox root.

```bash
install -d -m 700 "/absolute/path/to/Noa Show Media Holding"
```

Inspect what is ready without downloading:

```bash
npm run pull:intake -- \
  --origin http://127.0.0.1:<port> \
  --output "/absolute/path/to/Noa Show Media Holding" \
  --dry-run
```

Pull once:

```bash
npm run pull:intake -- \
  --origin http://127.0.0.1:<port> \
  --output "/absolute/path/to/Noa Show Media Holding"
```

Or keep a foreground terminal watching while an event window is open:

```bash
npm run pull:intake -- \
  --origin https://noasaitoshii.com \
  --output "/absolute/path/to/Noa Show Media Holding" \
  --watch \
  --interval-seconds 60
```

Watch mode is intentionally foreground-only. It does not install a daemon,
launch agent, cron job, or n8n schedule.

## Delivery guarantees

Every successful pull:

- writes to a hidden mode-600 partial file;
- checks the received byte length;
- checks an eligible-store MD5 ETag when Cloudflare supplies one;
- computes SHA-256;
- links the completed file into place without overwriting an existing file;
- appends and fsyncs `show-media-intake-manifest.jsonl`;
- acknowledges delivery only after the local manifest is durable.

If acknowledgement fails after download, the next pull uses the manifest to
acknowledge the existing file instead of downloading a duplicate.

## Remote operator credential

Remote pulls require a dedicated random operator key stored only in macOS
Keychain. Local loopback pulls do not.

Read-only status:

```bash
tools/media-intake-operator-key.sh status
```

Creating or rotating the key changes the credential boundary and is part of the
separate remote-activation approval. `create` stores the plaintext only in
Keychain and prints only its SHA-256 hash for Cloudflare configuration.

Keychain identity:

```text
Service: miinrva.show-media-intake.operator-key
Account: noasaitoshii
```

Never pass the operator key through a CLI flag, environment variable, `.env`
file, shell profile, chat, or documentation.

## Normal event close

1. Close the event invite window or set `MEDIA_INTAKE_ENABLED` to false.
2. Run a final pull.
3. Confirm the review surface shows `Needs review: 0` and `Ready to pull: 0`.
4. Preserve the JSONL manifest beside the originals.
5. Move only delivered media into the working library.
6. Let the R2 lifecycle policies expire remote quarantine and eligible objects.

Do not manually open held files. A held state means the contents did not match
the approved extension/signature route.

## Incident stop conditions

Stop intake and keep the evidence if:

- spend or request volume exceeds the expected event envelope;
- the ready count rises without expected invitations;
- bucket public access is enabled;
- lifecycle rules are missing;
- repeated checksum, byte-count, or ETag verification fails;
- a secret appears in logs, chat, shell history, or repository files;
- a file reaches the Mac without a manifest record.

Disabling the remote intake flag is the safest first containment step. Do not
delete buckets, logs, manifests, or credentials during diagnosis.
