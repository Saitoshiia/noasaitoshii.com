# Booking Inquiries V1

Status: production transport prepared; Turnstile widget created; activation remains blocked on secure credential wiring and end-to-end proof

## What exists

- `/book` is the public-facing, branded Astro inquiry form.
- `POST /api/booking-inquiries` is the Cloudflare Worker validation and
  anti-abuse boundary.
- The browser sends a small flat form payload. The Worker validates and
  normalizes it into `noa-booking-inquiry.v1`.
- The canonical automation packet, inactive n8n scaffold, and Notion mapping
  live under:
  - `ops/n8n/contracts/booking-inquiry-*`
  - `ops/n8n/workflows/booking-inquiry-ingest-gateway.scaffold.json`
  - `ops/notion/reports/booking-inquiries/2026-07-29/`

Current production preparation:

- `Noa Booking Inquiries` contains the approved intake, review, decision,
  graduation receipt, and canonical relation properties.
- Cloudflare contains the private `noa-booking-inquiries-v1` Queue,
  `noa-booking-inquiries-dlq-v1` dead-letter Queue, one HTTP pull consumer, and
  `noa-booking-inquiry-idempotency-v1` KV namespace.
- The Worker config binds the Queue, KV namespace, and a native two-per-minute
  rate limiter.
- Cloudflare contains the Managed Turnstile widget
  `noasaitoshii-booking-inquiries`, restricted to `noasaitoshii.com`, with
  pre-clearance disabled. Its private secret is not stored in source control and
  has not yet been bound to a deployed Worker environment.
- n8n contains `booking-inquiry-ingest-gateway`, inactive, MCP-disabled, and
  deliberately non-executable.

No public deployment, schedule, outbound response, acceptance, graduation, or
canonical event/project/booking creation was activated.

## Local review

```bash
cd /Users/noasaitoshii/Miinrva/projects/noasaitoshii/websites/noasaitoshii.com
npm run preview:intake
```

Open the loopback URL Wrangler prints, then visit `/book`.

The `local` Wrangler environment sets `BOOKING_INQUIRY_MODE=local`. Local mode
uses bounded in-process adapters so the complete form-to-Worker interaction can
be reviewed without remote resources. Accepted local packets are ephemeral:
they disappear when the Worker process restarts and are not written to Notion.
Production mode fails closed when any required binding is absent.

## Verification

```bash
node --test tests/booking-inquiry-ui.test.mjs
node --test worker/booking-inquiry.test.mjs
node --test /Users/noasaitoshii/Miinrva/ops/n8n/scripts/lib/booking-inquiry-ingest-contract.test.mjs
npm test
npm run build
```

The integrated proof should also submit one representative inquiry through the
loopback `/book` surface and confirm an HTTP `202` response without printing
contact data or packet contents.

## Security boundary

The Worker enforces:

- exact same-origin requests;
- JSON content type and a bounded request body;
- allowlisted fields and controlled enum mappings;
- IANA timezone and DST-safe date validation;
- conditional location validation;
- contact-email validation;
- professional-fee and privacy acknowledgement;
- a silent honeypot path;
- rate-limit, Turnstile, idempotency, and Queue adapter boundaries;
- no request-body or sensitive adapter-error logging;
- fail-closed production behavior.

The local challenge bypass and in-memory adapters are reachable only when
`BOOKING_INQUIRY_MODE` is explicitly `local`.

## Production activation gates

Production remains blocked until a separately approved credential/activation
slice provides and proves:

1. a least-privilege Cloudflare Queue pull credential stored only in n8n;
2. secure Turnstile secret storage plus hostname/action-checked server
   validation using the existing approved widget;
3. Cloudflare credential binding and executable workflow connections while the
   n8n workflow remains inactive;
4. sandbox write/read-back, retry, duplicate-race, ack-failure, and dead-letter
   proof;
5. one synthetic end-to-end submission with exact Notion read-back;
6. schedule-registry registration before any recurring n8n trigger;
7. dependency, security, preview, and public deployment approvals.

The Notion schema now has dedicated email, source identity, timezone, human
decision, and graduation receipt fields. Exactly-once persistence still
depends on serialized Queue consumption plus verified Notion read-back.

## Rollback

Before production activation, website rollback is code-only: remove the `/book`
route/component/styles/client, remove the booking Worker module and its router
call, and remove `BOOKING_INQUIRY_MODE` from the local Wrangler environment.
Cloudflare Queue, KV, and Turnstile resources now exist but remain unactivated by
the public website. Deleting those external resources is a separate, explicitly
approved operational action and is not required for a code rollback.
