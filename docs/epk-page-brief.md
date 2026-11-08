# Noa Saitoshii EPK Page Brief

Status: implemented for local private preview; content and media review still required before public release  
Route: `/epk`  
Parent project: `noasaitoshii.com`

## Product Outcome

Create a focused, industry-facing page that lets a promoter, venue, journalist,
or collaborator understand Noa quickly, hear and see representative work, verify
selected performance credentials, obtain approved press assets, and make a
booking inquiry without assembling context from several platforms.

The EPK is part of NoaSaitoshii.com. It is not a separate microsite, a public
archive of every appearance, or a directory about other artists.

## Primary Audiences

1. Promoters, talent buyers, venues, and festival programmers.
2. Journalists, podcast producers, and community partners.
3. Collaborating artists and event producers.
4. Fans who want a deeper professional introduction.

The first three audiences control the hierarchy. The page should remain
welcoming to fans without becoming a second homepage.

## Positioning

Noa Saitoshii is a San Francisco-based DJ and multidisciplinary artist creating
immersive electronic music experiences across physical and virtual worlds. His
sound moves through melodic house, progressive, techno, and trance, with a
practice shaped by graphic design, world-building, and community-centered event
production.

The page should prove:

- Noa has a distinct sound and point of view.
- Noa is reliable in consequential performance contexts.
- Noa can hold a room alongside established touring artists.
- Saitoshiia demonstrates original event and world-building capability.
- Booking or covering Noa is operationally easy.

## Page Architecture

### 1. Identity and immediate action

- Noa Saitoshii name and one-sentence positioning.
- Location and performance formats: IRL, metaverse, livestream, solo, and B2B.
- Primary actions: `Listen`, `Watch live proof`, and `Booking contact`.
- Compact navigation to page sections.

Do not lead with the list of recognizable artists. Noa's identity and work must
remain the first impression.

### 2. Representative music

- One featured recorded set that best communicates Noa's present sound.
- Two or three secondary sets covering materially different performance modes.
- One-click playback or direct listening with clear platform labels.
- Set title, setting, year, genre/vibe, and a short reason each selection matters.

Avoid a complete archive. The EPK is a selection surface.

### 3. Live proof

- One primary performance video or concise highlight reel when approved footage
  exists.
- Up to three secondary clips showing crowd/room response, transitions, or
  virtual-world production.
- Poster, photograph, or event-page evidence may temporarily stand in for
  missing video, but placeholders must not ship as if they were proof.

No production AI imagery is permitted. Use only authored, captured,
commissioned, licensed, procedural, or code-native assets with provenance.

### 4. Short biography

- A press-ready short bio of approximately 100–150 words.
- Optional expandable long bio of approximately 250–400 words.
- Copy control for the short bio.
- Downloadable plain-text or press-kit copy only if it reduces real reuse
  friction.

The bio leads with sound, experience, and direction. It does not become a list
of credentials.

### 5. Selected performance highlights

Use precise relationship labels and a deliberately limited set:

- **Direct support / opening slots**
- **B2B performances**
- **Selected shared bills or stages**
- **Selected venues, event series, and communities**

Initial recognizable-artist pool, ordered by current public recognition:

1. Gabriel & Dresden
2. Morgan Page
3. Daxson
4. Valentina Soto
5. Triode
6. Donald Glaude
7. Monic

Before publishing, verify the correct relationship category, event, date,
venue, and supporting evidence for every listed artist. Never imply personal
endorsement, collaboration, friendship, touring history, or equal billing when
the evidence only proves a shared bill.

Artist names should remain unlinked in the first release. Links to their social
profiles do not materially improve Noa's SEO and turn a professional proof
section into a row of exits. If external verification becomes useful later,
link to the relevant event evidence or official event archive—not a general
artist directory.

### 6. Saitoshiia and experience design

- Explain Saitoshiia in one concise paragraph as Noa's event, community, and
  virtual-world practice.
- Show selected venues or event formats only where they demonstrate a booking-
  relevant capability.
- Link to Saitoshiia.com for the broader organization and event calendar.

This section supports Noa's authorship. It must not make the EPK read like the
Saitoshiia organization website.

### 7. Press assets

- Approved horizontal and square press photographs.
- Transparent and light/dark logo variants.
- Short and long biography text.
- Approved artist-name spelling and pronunciation note if needed.
- Photo credits, usage notes, and asset provenance.

Offer one reviewed download bundle only after every included asset has rights
and provenance recorded. Do not expose private source files or working assets.

### 8. Booking and contact

- Primary contact: `contact@saitoshii.com`.
- Link to the governed booking-inquiry flow when that system is public.
- Performance formats, home market, and travel availability only when current.
- Optional technical summary; keep private riders and sensitive logistics out
  of the public page.

## Homepage Relationship

The homepage keeps its compact `Shared lineups & stages with` credibility line.
It may link the section label or a restrained `Press / EPK` action to `/epk`.
Individual artist names should not become Instagram links.

The homepage introduces. The EPK substantiates.

## SEO and Sharing

- Unique title and meta description focused on `Noa Saitoshii`, `DJ`, `electronic
  music`, `San Francisco`, and `electronic press kit`.
- Canonical URL: `https://noasaitoshii.com/epk`.
- Dedicated Open Graph image using approved Noa production assets.
- `Person` or `MusicGroup` structured data only after choosing the accurate
  schema identity; do not invent awards, affiliations, or endorsements.
- Descriptive headings and real text for biography, performance highlights,
  formats, and contact.
- Internal links from the homepage, contact area, and relevant event pages.

Outbound links are included for user utility, not as an SEO tactic.

## Visual Direction

Follow the Noa Saitoshii L7 brand package:

- typography-led, dark-warm, editorial, nocturnal, and precise;
- BD Megalona for expressive identity, Saitoshii Inter for functional reading,
  and Geist Mono for metadata;
- image-free hierarchy must work before photography or atmosphere is enabled;
- use the existing schedule-ledger and index-row language where appropriate;
- spend visual emphasis on one strong hero or live-proof moment;
- preserve readable measure, responsive reflow, visible focus, reduced motion,
  and the shared token system.

The page should feel like a confident artist dossier, not a generic EPK
template, résumé, sponsor wall, or collage of third-party logos.

## Content Inventory Required Before Implementation

- Approved short and long biography.
- One featured set and two or three supporting sets.
- One primary live video or an explicitly accepted first-release fallback.
- Verified performance-credit ledger with relationship, event, date, venue, and
  evidence for every listed artist.
- Approved press photos and photo credits.
- Approved logo exports and usage notes.
- Current booking contact and performance-format copy.
- Approved Saitoshiia description and link.

## Release Slices

### Slice A — content and evidence

- Build the verified performance-credit ledger.
- Select representative audio/video.
- Draft short and long bios.
- Inventory approved press assets and provenance.

### Slice B — page implementation

- Add `/epk` using existing Astro layouts, tokens, components, and patterns.
- Add metadata, structured-data candidate, internal navigation, copy controls,
  and responsive/accessibility behavior.

### Slice C — proof

- Content-fact review.
- Mobile and desktop visual QA.
- Keyboard, focus, contrast, and reduced-motion checks.
- Link, metadata, structured-data, and download-bundle validation.
- Private/local review before any staging or production deployment.

## Definition of Done

The EPK is complete when an unfamiliar promoter can understand Noa's artistic
position, hear and see representative work, verify carefully worded performance
proof, obtain approved reusable assets, and reach the correct booking path in
under two minutes—without the page overstating relationships, exposing private
material, or sending the visitor through several external platforms.

## Local Preview Implementation

The initial `/epk` route was implemented on 2026-08-12 as a private local-preview
surface. It includes the positioning architecture, representative set selection,
press-ready short and full biographies, evidence-bounded performance context,
Saitoshiia authorship, press-readiness state, and governed booking paths.

The route deliberately ships with `noindex, nofollow` metadata and remains
unapproved for production. Public release still requires:

- Noa's copy and positioning approval;
- a final relationship-by-relationship performance-credit review;
- one selected live reel or explicitly approved video set;
- approved horizontal and square press photography with credits and rights;
- reviewed logo exports and one provenance-complete press download bundle;
- Noa's final desktop/mobile taste approval and production deployment approval.

Functional and design proof completed on 2026-08-12: the Astro build and all 60
tests passed; `/epk` rendered without horizontal overflow at 1280 px and 390 px;
the bio-copy interaction worked; the route emitted `noindex, nofollow`; and the
desktop hero, desktop profile, mobile hero, and mobile music rows were visually
inspected. The implementation receipt is in
`docs/epk-design-proof-2026-08-12.yaml`.

The refinement pass replaced the two generic SoundCloud profile links in the
EPK selection with verified direct recording URLs and added `/epk/bios.txt`, a
static text download generated from the same canonical EPK data as the page.
This gives press and bookers reusable copy without creating a second biography
source that can drift.
