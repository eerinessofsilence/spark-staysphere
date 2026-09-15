# SPARK StaySphere 360 — Technical Foundation

## Stack

- Vinext (Next-compatible App Router), React 19, TypeScript strict mode.
- Tailwind CSS 4 plus shadcn UI primitives.
- Zod for runtime validation and inferred domain types.
- Cloudflare/Sites-compatible Vite build.
- Two icon sets, split by job — see DESIGN_SYSTEM.md rule 5: Heroicons outline
  (`@heroicons/react/24/outline`) for interface marks, Phosphor filled
  (`@phosphor-icons/react/dist/ssr`, `weight="fill"`) for marks that denote a physical thing (a
  bathtub, a bed, a room's amenities). `lucide-react` is lint-banned outside `components/ui/` (the
  generated shadcn primitives), see `.oxlintrc.json`.
- Inter and Instrument Serif (italic accent only) self-hosted through `next/font/google`; the
  interface face is really San Francisco on Apple platforms, with Inter as the fallback for
  everyone else — see DESIGN_SYSTEM.md's Typography section.
- Vitest for unit tests (`lib/domain/**`, pure logic — `npm run test`); Playwright for
  golden-path end-to-end coverage at 1440px and 390px (`npm run test:e2e`).
- Not installed: TanStack Query and React Hook Form. Server components own data fetching and
  the booking form is small enough that controlled inputs are simpler than a form library.

## Data flow

```text
Route / component
  → application service (quote, hold, confirm)
  → domain port (repository or external adapter)
  → mock implementation now / HTTP production adapter later
```

Domain schemas are in `lib/domain/schemas.ts` and the pricing rules in `lib/domain/pricing.ts` —
one function, `buildPriceBreakdown`, produces every total in the product, so the catalog card, the
detail summary, the booking review, and the booking engine quote can never disagree.

Ports for the repository, PMS, channel manager, booking engine, payment, CRM, and the demo admin
controls are in `lib/domain/ports.ts`. `CatalogService` resolves offers and facets; `BookingService`
owns idempotency, the price/availability recheck, the hold, demo authorization, persistence, and
best-effort CRM/PMS delivery. `lib/application/container.ts` is the composition root and the only
module that imports `lib/infrastructure`.

`HotelRepository` is not one interface a service takes whole — it `extends` four narrower ones
(`CatalogReader`, `AvailabilityReader`, `BookingStore`, `PaymentAttemptStore`), and each service's
constructor declares only the slice it actually calls (`CatalogService` takes
`CatalogReader & AvailabilityReader`; `BookingService` takes a `Pick` of the catalog reads it needs
plus the full booking and payment stores). Every concrete repository still implements all four, so
this changes nothing about what `container.ts` wires in, only what each constructor's declared
type says it may call. `Clock` (`lib/domain/ports.ts`, real implementation `lib/domain/clock.ts`)
is the same idea for "now": `BookingService` and `ContentService` take one as an optional
constructor parameter (default the real clock), so a test can pass a fixed date without either
service's own "today" formula changing.

`lib/application/booking-intake.ts` is the shared slug-addressed intake used by both the booking
UI's server actions and the HTTP route handlers, so both entry points re-derive price on the server
and neither trusts a client-supplied total. `app/api/_lib/http.ts` is the same idea for the HTTP
routes' shared boilerplate: `parseJsonBody` (read → Zod-validate → 400 on failure) and
`mapBookingError`/`toBookingErrorResponse` (one `BookingErrorCode` → HTTP status table), so
`/api/quotes`, `/api/bookings`, and the booking form's server actions can't map the same failure
to three different outcomes.

`lib/infrastructure` holds the demo room types with rates and add-ons (static seed data, never
persisted), an in-memory repository with deterministic date-aware availability, mock
implementations of every adapter port, and the `DemoControlPort` backing `/admin` (status
overrides, add-on enablement, integration status rows).

## Persistence

Bookings (and the room a guest chose, in `booking_units`), payment attempts, room-status overrides,
and confirmed-booking inventory holds are durable: `lib/application/container.ts` exports
`durableHotelRepository`/`durableDemoControlPort` (`lib/infrastructure/durable-hotel-repository.ts`),
which resolve a D1 binding *at call time* (never once at module load, since `env` bindings are
only guaranteed once a request is in flight — see `lib/infrastructure/cloudflare-env.ts`) and read
through D1 when one is configured, falling back to the process-local in-memory store from before
otherwise.

D1 is enabled by setting `"d1": "DB"` in `.openai/hosting.json` (see
`@openai/sites-vite-plugin`'s README and the `d1_databases` block in `vite.config.ts`, which was
already scaffolded for this). `npm run dev`/`vinext dev` then run against a real, locally emulated
D1 database via `@cloudflare/vite-plugin` — no Cloudflare account or `wrangler login` is needed for
this; Miniflare persists the SQLite file under `.wrangler/state/v3` (gitignored) across `vinext
dev` restarts, which is what makes local demo bookings survive a restart. The Site Creator
platform is expected to provision the real D1 database that this same binding name resolves to in
production.

Schema (`lib/infrastructure/d1-schema.ts`) is applied with idempotent `CREATE TABLE IF NOT EXISTS`
statements the first time any D1 function runs per isolate — there is no migration runner. Each
statement must be a single line: `D1Database.exec()` splits its input on `\n`, not `;`, so a
multi-line `CREATE TABLE` silently breaks into unparsable fragments; schema init uses `batch()`
with one prepared statement per table instead.

The room/rate/add-on *catalog* (names, prices, descriptions) is never written directly — the seed
in `mock-data.ts` stays fixed in every backend. What `/admin/content` edits is an overlay on top of
it: see "Content management (CMS)" below.

## Content management (CMS)

`/admin/content` lets a hotel team edit the hotel's copy, room types, rates, and add-ons without a
deploy — but the seed in `mock-data.ts` is never mutated. Every edit is a row in one D1 table,
`catalog_entries (kind, id, hotel_id, data, version, updated_at)`, keyed by `(kind, id)` where
`kind` is `'hotel' | 'room' | 'unit' | 'rate' | 'addon'` (`room` a room type, `unit` one physical room) and `data` is the full entity as JSON. A row with
an id the seed already has *replaces* that entity wholesale; a new id is a new entity. "Reset demo
state" on `/admin` clears the whole table for the hotel, so the catalog falls back to seed.

```text
Seed (mock-data.ts)  ──┐
                        ├─▶ mergeCatalog (lib/domain/catalog-overlay.ts) ─▶ HotelRepository read
CMS overlay (D1)     ──┘
```

`lib/domain/catalog-overlay.ts`'s `mergeCatalog` is the one merge function both the D1 and
in-memory backends call — `durable-hotel-repository.ts`'s `getHotel`/`listRooms`/`listRatePlans`/
`listAddOns` fetch the seed array and the matching overlay rows (through `CatalogContentPort`,
resolved D1-or-in-memory the same way and at the same call time as the rest of that file) and merge
them. `HotelRepository` reads are therefore always the *current* catalog, CMS-hidden rooms
included — hiding a room from guests is a business rule, not a storage rule, so it lives in
`CatalogService.getHotel`/`search`/`getRoomDetail` instead (a hidden room's hotspots, floor zones,
and spinner markers are stripped from the guest-facing `Hotel`; `search`/`getRoomDetail` exclude
it, the latter via the existing `RoomNotFoundError` → 404). `/admin/content` reads through
`HotelRepository` directly, unfiltered, since a hotel team needs to see and edit a hidden room's
hotspot too.

`lib/application/content-service.ts` owns every business rule a write has to pass: kebab-case,
unique, immutable-after-creation slugs; a rate's `roomTypeId` and an add-on's `parentId` must
reference an existing entity (parent one level deep, no self-reference); a visible (non-hidden)
room type needs at least one physical room, one rate and one `image` media item, checked both when a room is edited and
when it is un-hidden; every price's currency must equal the hotel's; a media `url` must resolve in
the media library, and a `360` item must be an equirectangular (2:1) file from
`public/images/panoramas`; an entity referenced by any booking can only be hidden or withdrawn,
never deleted, and a hard delete is refused for anything that came from the seed regardless
(`content-service.ts`'s own `seedIds`, built in `container.ts` from `mock-data.ts` — the only place
that touches infrastructure directly, per the container-only-import rule). Every write is
optimistic-concurrency-checked: `CatalogContentPort.upsertEntry` takes an `expectedVersion` (`0`
for an entity never overlaid) and returns a conflict, writing nothing, if the stored version has
moved on. `assertCanEditContent()` is the single authorization choke point — it always allows for
now (auth is CLAUDE.md's roadmap step 9) — every mutator in `content-service.ts` calls it first.

An add-on's `enabled` flag used to live in its own `addon_toggles` D1 table, written only by
`/admin`'s quick switch. It is now just a field on the add-on entity, written through the same
overlay path from both the on-sale switch in `/admin/content`'s add-on list and the CMS's own form
(`ContentService.setAddOnEnabled`), so the two can never disagree about which value won; the old
table's `CREATE TABLE` was dropped from `d1-schema.ts` (an already-provisioned local D1 keeps an
unused, harmless copy — there is no migration runner).

There is no upload path in v1 (`.openai/hosting.json` has `r2: null`). The whole media library is
`public/images/**`, minus the spinner's orbit frames, read into a committed JSON manifest by
`scripts/generate-media-manifest.mjs` (`npm run generate:media-manifest`) — width/height are parsed
straight out of each WebP's own header bytes (`VP8 `/`VP8L`/`VP8X`), no image library. `MediaAsset`/
`MediaLibraryPort` (declared in `lib/domain/ports.ts`) are what `content-service.ts` validates media
urls against; `MediaStoragePort` is declared alongside them for a future upload adapter, not
implemented.

`/admin/content`'s forms are server actions with Zod validation, driven by `useActionState`
through one shared client wrapper, `components/admin/content/content-form.tsx`'s `ContentForm`.
It dispatches from its own submit handler rather than `<form action>`: React resets every
uncontrolled field once a form action finishes, which after a failed save wiped what had been
typed and refilled the invalid field under its own error. The wrapper owns, for every form:

- **Unsaved changes, measured.** The form's `FormData` is compared with the last saved snapshot,
  so reordering a list, a Select or a switch counts as much as typing. While anything differs the
  sticky button bar says "Unsaved changes", `beforeunload` warns, and
  `components/admin/shell/unsaved-changes.tsx`'s guard (mounted once in the admin shell) catches
  in-admin link clicks — which never fire `beforeunload` — and asks in the product `Modal`.
- **Where the result is.** The button bar sticks to the bottom of the screen while its form is on
  it. A failed save says so there ("Not saved — 1 field needs attention"), opens any `<details>`
  around the first error, scrolls it to the middle and focuses its control; `Field` marks its error
  with `data-field-error`, and the list editors show `media.1.label`-style errors on their own row.
- **Versions shared on the page.** `version-channel.ts` lets controls that write the same entity
  (a room's form and its "Hide from the site" button; an add-on's form and its on-sale switch)
  announce each step they save (`from` → `to`); another control still holding `from` steps along,
  so a person's own click is never reported back to them as someone else's edit. A genuine
  conflict keeps the edits in the form and offers "Save my version" or "Discard mine and load
  theirs".

Actions that flip one flag — "Hide from the site", an add-on's on-sale switch, in the list or on its
own page — act at once and offer Undo for a few seconds; everything else waits for Save. Deletes
are offered only where `ContentService.rateRemoval`/`addOnRemoval` allow one (otherwise the reason
is shown instead), confirmed in the product `Modal`, and a deleted add-on's page sends the person
back to the list with a notice rather than to a 404. Room numbers follow a type's floor and view
(`buildRoomUnits`), so `updateRoom` and `createRoom` refuse a change that would renumber a room a
guest picked for an upcoming stay, and the editor says which rooms are held.

`Field` (`components/admin/content/fields.tsx`) reads its own error out of the wrapper's context by
its error key (`name`, not always the same as its DOM `id`; the hotel form's are id-based paths like
`areas.pool.hotspots.bar.cta`). Reorderable lists (`amenities`, a rate's `includedServices`, a room's
`media`, an add-on's `photos`) have no drag-and-drop library — up/down/remove buttons, with state
serialized into one hidden JSON input the server action reads back with `parseJsonList`; text still
in an "add" field is saved with the list. A gallery item's type follows from the file picked
(`mediaTypeOf`: panoramas are 360° views) and its label is required, prefilled from the file name,
because the room page shows it as the name of that view. The media picker is the shared product
`Modal`: it opens on the room's own folder when that folder has photos not yet in the gallery,
searches by name, and marks photos already added. The content list searches by name and filters to
room types, add-ons, or only what is hidden or withdrawn.

## Physical rooms, the floor plan and the tape chart

The catalog sells room types; a floor plan and a PMS tape chart need doors. Physical rooms are
stored: a `PhysicalRoom` (`number`, `floor`, `roomTypeId`) is a CMS entity of kind `unit`, seeded in
`mock-data.ts` by `layOutRooms` with the numbers the demo building always had (floor by floor, sea
facade first) and edited under `/admin/content/units`. A room type sells exactly as many rooms a night
as it has stored rooms — `durable-hotel-repository.ts`'s `getAvailability` counts `listPhysicalRooms`
and hands that to `resolveRemaining` — so the CMS, the catalog, the guest floor plan and the back
office can never report a different number of rooms. A room's floor is read off its number (`305` is on
the 3rd floor, `G04` on the ground floor) and its facade follows its type's view (sea and pool → sea
side, city and garden → town side); `buildRoomUnits` needs every room type, hidden ones included.

A room type is created first and its rooms after it: `setRoomHidden` won't put a type on sale without
at least one room. `content-service.ts` refuses a duplicate number; renumbering a room a current
booking chose; and removing a room a current booking chose, a seed room, the last room of a type on
sale, or any room whose type would be left with fewer rooms than the stays it already has booked on
one night.

`allocateRoomType` is the one rule for who is in which room on each night, and both views call it:
bookings that named a room get it; other confirmed bookings go, in booking order, to the
lowest-ranked room free for their whole stay (a stay never changes rooms mid-way); whatever
availability still counts as taken fills the lowest-ranked free rooms as simulated demand, or as
closed when an admin override is behind it. Ranks are hashed per room type so occupied doors scatter.
`InventoryService` (`lib/application/inventory-service.ts`) exposes it as `getFloorPlan` (one stay,
guest-facing, hidden types left out), `getTapeChart` (every room across a window of nights, with
bookings, demand, closures and daily arrivals and departures) and `getBookingRoom`. Simulated demand
is cut into 2–5-night blocks only so the tape chart reads like a PMS, and is labelled as simulated
wherever it appears.

A booking may carry `unitNumber`, the room the guest picked. `booking-intake.ts` checks that room is
free for the stay (`isUnitFreeForStay`) before confirming — skipped on an idempotent replay, which
would otherwise find the room taken by itself — and refuses with `unavailable`. It is stored in
`booking_units (booking_id, unit_number)`, joined into every booking read; a separate table because
there is no migration runner to `ALTER` `bookings`. Known gaps: two concurrent requests for the same
room can both pass the check (in production the PMS owns room assignment), and because chosen rooms
are honoured booking by booking, the rooms free for a whole stay can occasionally number fewer than
the catalog's per-night minimum.

## Back office

`/admin` is the hotel's own product: one shell (`app/admin/layout.tsx`) around two groups of
screens in the sidebar nav (`components/admin/shell/admin-nav.tsx`), Operations and Content. What
reads and writes real demo data, and what is a labelled preview of a later feature:

| Route | What it does | Backed by |
| --- | --- | --- |
| `/admin` | Tonight's occupancy, 14-night occupancy chart, arrivals and departures, recent bookings, integration status | `InventoryService.getTapeChart`, `HotelRepository.listBookings`, `DemoControlPort` — live |
| `/admin/reset` | "Reset demo state" — not in the sidebar; reachable by URL for the demo owner and the e2e harness, not by navigation | `DemoControlPort.reset`, `ContentService.resetContent` — live |
| `/admin/tape-chart` | Rooms × nights (7/14/30), filter by room type, booking detail dialog | `InventoryService.getTapeChart` — live; demand is simulated and says so |
| `/admin/bookings`, `/admin/bookings/[reference]` | Search and stay-bucket filters; detail is three cards — guest (contact, party, totals across their stays), booking (status, room, rate, payment, dates, extras, cancel), room (photo, facts, price summary) — over the guest's booking history, matched by email | `BookingService.getConfirmation`/`cancelAsHotel`, `InventoryService.getBookingRoom`, `HotelRepository.listBookings` — live |
| `/admin/rates` | Base nightly and OTA-comparison price per room type, rooms left for seven nights, availability override | `ContentService.updateRate` (the CMS overlay), `DemoControlPort` overrides — live |
| `/admin/content` — Rooms & add-ons | One nav item, three tabs: Room types (`/admin/content`: cover, price, room count), Rooms (`/admin/content/units`: grouped by type; add a room under a type — the number starts at the first free one on its floor — renumber or remove one), Add-ons (`/admin/content/add-ons`: by category, with the on-sale switch); room type, room, rate and add-on editors under each | `ContentService`, `HotelRepository.listPhysicalRooms` — live |

Every screen in the sidebar nav reads or writes real demo data. Four more routes exist but are not
linked from the nav — reachable only by typing the URL — and each says on screen that it is a
preview: `/admin/settings` (brand preview, "changes aren't saved in this demo"),
`/admin/settings/team` ("sign-in and roles arrive with admin auth"), `/admin/integrations` (mock
adapter status, "nothing is connected to a real system"), and `/admin/media` (the committed
manifest, read-only — there is no upload path, see "Content management (CMS)"). Brand settings,
team roles, integration credentials and media uploads are left out until they can actually save.

`BookingService.cancelAsHotel` is the desk's cancel: the same `not_found`/`already_cancelled`/
`stay_started` rules as the guest's, without the email check, since the desk is trusted (until
auth, anyone who can open `/admin` is). A cancelled booking releases its nights and its room at
once, because both the floor plan and the tape chart recompute `allocateRoomType` on read. The rates
screen saves through `ContentService.updateRate` with the rate's `version`, so it and the CMS rate
form share one concurrency check and one overlay row. Every write revalidates the admin screens
that show it and the guest routes it reprices.

## AI concierge

A guest can describe what they want in their own words — voice or text — from a persistent
control on every guest route (`components/assistant/`). The rule that governs it: **the model
interprets language, it never produces inventory, availability, or money.**

```text
utterance (voice → text, or typed)
  → RoomSearchInterpreter port          ← OpenAI, structured output
  → SearchIntent                        ← criteria/filters as a Partial, plus unresolved phrases
  → AssistantService.ask                ← sanitises every enum and amenity against the live facets,
                                           clamps adults/children and dates with search-params.ts's
                                           own clamps, merges onto the guest's existing stay
  → CatalogService.search               ← the existing service, unchanged
  → RoomOffer[] priced by buildPriceBreakdown
```

`lib/domain/assistant.ts` derives the OpenAI Structured Outputs JSON Schema from the same Zod
schema (`assistantIntentWireSchema`) the response is parsed back through with `z.toJSONSchema` —
one source for the contract in both directions, never a hand-maintained second copy. The
deterministic summary sentence and the "I ignored …" line are composed in
`lib/formatting.ts`/`components/assistant/assistant-panel.tsx` from the app's own numbers; nothing
the model writes is ever shown as a fact about a room.

`lib/application/container.ts` resolves `getOpenAiKey()` (`lib/infrastructure/cloudflare-env.ts`)
at call time — same rule as `getDemoDatabase`, since `env` bindings are only reliable once a
request is in flight — and picks `lib/infrastructure/openai-search-interpreter.ts` when a key
resolves, falling back to `lib/infrastructure/keyword-search-interpreter.ts` (a small, deterministic
phrase-to-filter vocabulary) otherwise or if the OpenAI call itself throws. The same shape as the
D1-or-in-memory fallback in `durable-hotel-repository.ts`, and the reason a keyless `npm run dev`
and `npm run test:e2e` still answer end to end. Speech has no such fallback:
`lib/infrastructure/openai-transcriber.ts` is the only transcriber, so
`POST /api/assistant/transcribe` returns 503 when no key is configured.

Both OpenAI adapters call the REST API with `fetch` (`https://api.openai.com/v1`), not the `openai`
npm package — the Worker build does not need an SDK for two endpoints. Model ids are named
constants (`ASSISTANT_MODEL` in `openai-search-interpreter.ts`, `ASSISTANT_TRANSCRIBE_MODEL` in
`openai-transcriber.ts`) so they are swappable in one place each; both were verified against
OpenAI's current model list rather than assumed, and should be re-checked before being rolled
forward. Interpretation runs at `temperature: 0` with a capped `max_tokens`. Transcription is
`multipart/form-data` to `/v1/audio/transcriptions`, with the filename's extension matched to the
browser's actual recording container (`.webm` for Chrome/Firefox Opus, `.m4a` for Safari) since the
endpoint sniffs it.

`lib/application/assistant-rate-limit.ts` is a per-isolate sliding-window limiter plus a
one-request-in-flight lock per client, the same process-local shape as the rest of the demo's
in-memory state. Production needs a KV- or Redis-backed limiter shared across isolates. Neither
route ever logs an utterance or audio — only a correlation id and the outcome — and the uploaded
recording is never written anywhere; it is discarded with the request once transcription returns.

## Production source of truth

PMS/channel manager owns rooms, restrictions, rates, inventory, and reservation updates. StaySphere should call one internal booking API; the frontend must not independently synchronize OTA inventory. Booking.com/Airbnb access is through official partner programs or the selected channel manager.

## API boundaries

Implemented as route handlers in this app; there is no separate API service.

- `POST /api/quotes` — price and availability for a stay, including selected add-ons.
- `POST /api/bookings` — creates a booking; requires an `Idempotency-Key` header of at least eight
  characters. Returns 409 for `unavailable` or `price_changed`, 402 for `payment_declined`.
  `paymentMethod` (`card` | `apple_pay` | `google_pay` | `bank_transfer` | `pay_at_hotel`) is
  optional and defaults to `card`; the two that settle later record a `demo_pending` payment
  attempt instead of an authorization.
  An optional `unitNumber` (e.g. `"402"`) books that exact room; it must belong to the room type and
  be free for the whole stay, or the request gets 409 `unavailable`.
- `GET /api/bookings/:reference?email=…` — reads a booking from the current process. The
  reference alone opens nothing: `email` must match the guest's own, the same rule
  `findTrip`/`cancelTrip` enforce for "My trips", since a reference is guessable in bulk.

The guest UI reaches the same intake through server actions (`app/book/[slug]/actions.ts`) rather
than fetching these routes. The back office is server actions only: overrides and the demo reset
through the `DemoControlPort` (`app/admin/actions.ts`), the desk's cancel through `BookingService`
(`app/admin/bookings/actions.ts`), base rates and the CMS through `ContentService`
(`app/admin/rates/actions.ts`, `app/admin/content/**/actions.ts`) — no new HTTP routes.

Still to build when a real backend exists: `GET /hotels/:slug`, `GET /hotels/:id/rooms`,
`POST /holds` as a standalone call, and authenticated admin endpoints.

## Storage model

PostgreSQL-ready entities: hotels, room types, rate plans, availability snapshots, add-ons, guests, bookings, booking add-ons, payment attempts, integration connections, and webhook deliveries. Redis later provides short-lived holds, idempotency cache, rate limiting, and queues. R2/S3 stores images, GLB/GLTF, and 360 tiles.

## Security and payments

- Never store raw card data; use provider-hosted/tokenized fields.
- Separate demo/sandbox/production credentials and environments.
- Validate all external payloads and verify webhook signatures.
- Log integration correlation IDs, not secrets or sensitive payment fields.
- Require server-side final quote and availability checks.

## Photography and media

The product is photography-led. `public/images` holds every photograph as local WebP (hero areas
at 2000px, room galleries at 1600px, ~4 MB in total) and `public/images/CREDITS.md` records the
source and photographer for each. Nothing loads from an external image host at runtime.

The arrival screen is driven by `Hotel.areas` — each area has a photo with recorded dimensions,
a caption, and hotspots stored as fractions of the photo. `HotelScene` maps those fractions
through the same `object-fit: cover` maths the browser applies, so markers stay pinned across
viewports. Room galleries come from `RoomType.media`, where each image carries a `label` that
becomes its tab.

The building itself is a model a guest can turn: `Hotel.spinner` (`BuildingSpinnerData`) is a
baked 160-frame orbit around the exterior — `frames` (one image per angle, all sharing one
framing so hotspot fractions project through a single size), `keyAngles` (the stops the prev/next
arrows jump between, since stepping 160 frames one at a time is unusable), and `hotspots`, each
carrying `keyframes` for the sub-range of frames where it actually faces the camera.
`components/hotel/building-spinner.tsx` draws the current frame to a single `<canvas>` rather than
mounting elements — 160 full-size images left in the DOM after one full turn would be
unreasonable — loads frames in batches around whatever's current and fills in the rest in the
background, and animates between `keyAngles` stops on an arrow press or drag release with a
spring, not a dead stop. One finger drags it and it flicks on release; `prefers-reduced-motion`
disables the idle turn. A tap on a hotspot, or on the rail beside the stage, lists the room types
on that floor at the catalog's own price. See `SPINNER_SPEC.md`'s decision log (2026-09-06) for the frame-count, hotspot, and
baked-vs-live-WebGL reasoning behind path A, a baked frame sequence over a live scene. A same-day
detour into a live three.js model built from procedural block massing (`Hotel.model`) was tried
and replaced by this spinner hours later; its files and the `Hotel.model` schema were removed as
dead code once the spinner took over.

## Current limitations

Without a D1 binding, demo state (including the CMS overlay) is process-local and resets with the
worker isolate. There is no auth on `/admin` or `/admin/content` — `assertCanEditContent()` in
`content-service.ts` is a no-op until CLAUDE.md's roadmap step 9 — no real payment, and no PMS,
channel manager, or OTA connection. Downstream CRM/PMS delivery is best-effort and swallowed on
failure; production needs a queue with retries. The photographs are licensed stock standing in for
the property's own and must be replaced before any real launch; the CMS has no upload path to do
that with yet (`MediaStoragePort` is declared, not implemented — see "Content management (CMS)").
The CMS itself has no drafts, version history, or scheduled publishing (every save is immediate and
live), and supports one hotel at a time, though every overlay row already carries a `hotel_id`. The
AI concierge's rate limiter is per-isolate, not shared; without `OPENAI_API_KEY` its search still
works (the keyword interpreter) but its mic does not (no transcription fallback exists).
