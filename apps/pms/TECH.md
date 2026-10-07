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

## Hosting

Two hosts, one codebase. **Cloudflare Workers** is the native target: `npm run build` (vinext +
`@cloudflare/vite-plugin`) and `npm run deploy` (`scripts/deploy.mjs`, which finds or creates the
D1 database and R2 bucket and runs `wrangler deploy`). **Vercel** is the second: `npm run
build:vercel` (`NITRO_PRESET=vercel vinext build`) swaps the Cloudflare plugin for Nitro's Vercel
preset in `vite.config.ts` and writes Vercel's Build Output API into `.vercel/output` — one Node
22 function (`__server`) plus the static assets. Vercel itself sets `VERCEL=1`, so a build it
runs takes that branch without being told; `vercel.json` only names the build command.

What differs between the two is exactly one module, `lib/infrastructure/cloudflare-env.ts`. It is
the only importer of `cloudflare:workers`; on the Vercel build that import is aliased to
`node-workers-shim.ts` (`env` = `process.env`), and the same accessors then hand back:

- `getDemoDatabase()` — a **Turso** (libSQL) database behind D1's own `prepare/bind/all/first/
  run/batch` shape (`libsql-d1.ts`), from `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. libSQL is
  SQLite, so every `*-d1.ts` store runs unchanged, `changes()` guards and all; `libsql-d1.test.ts`
  runs the real stores against an in-memory libSQL to prove it.
- `getMediaBucket()` — **Vercel Blob** behind R2's `put/get/head/list/delete` (`blob-r2.ts`),
  from `BLOB_READ_WRITE_TOKEN`. Keys are kept verbatim so `/media/<key>` keeps working; R2's
  custom metadata (a photo's filename and pixel size) rides in a `<key>.meta.json` sidecar.

Without those variables the Vercel build still runs, on the in-memory fallbacks — which on a
serverless host means nothing survives between invocations, so they are not optional there.
Secrets (`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `OPENAI_API_KEY`, `INBOUND_EMAIL_SECRET`) are
plain environment variables on both hosts.

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
already scaffolded for this). `npm run dev`/`vite` then run against a real, locally emulated
D1 database via `@cloudflare/vite-plugin` — no Cloudflare account or `wrangler login` is needed for
this; Miniflare persists the SQLite file under `.wrangler/state/v3` (gitignored) across Vite
dev-server restarts, which is what makes local demo bookings survive a restart. The Site Creator
platform is expected to provision the real D1 database that this same binding name resolves to in
production. R2 (`"r2": "MEDIA"` in the same file, the `r2_buckets` block in `vite.config.ts`) is
resolved the same call-time-or-in-memory-fallback way, by `getMediaBucket()` alongside
`getDemoDatabase()` in `cloudflare-env.ts`; the building spinner's uploaded frames are its only
tenant so far (`lib/infrastructure/durable-spinner-frame-storage.ts`), served back through
`app/media/[...path]/route.ts`.

Schema (`lib/infrastructure/d1-schema.ts`) is applied with idempotent `CREATE TABLE IF NOT EXISTS`
statements the first time any D1 function runs per isolate — there is no migration runner. Each
statement must be a single line: `D1Database.exec()` splits its input on `\n`, not `;`, so a
multi-line `CREATE TABLE` silently breaks into unparsable fragments; schema init uses `batch()`
with one prepared statement per table instead.

The room/rate/add-on *catalog* (names, prices, descriptions) is never written directly — the seed
in `mock-data.ts` stays fixed in every backend. What `/admin/content` edits is an overlay on top of
it: see "Content management (CMS)" below. Spinner-markup zones are durable the same D1-or-in-memory
way, but in their own table (`spinner_zones`) rather than the `catalog_entries` overlay — see that
section's own note on why.

## Content management (CMS)

`/admin/content` lets a hotel team edit the hotel's copy, room types, rates, and add-ons without a
deploy — but the seed in `mock-data.ts` is never mutated. Every edit is a row in one D1 table,
`catalog_entries (kind, id, hotel_id, data, version, updated_at)`, keyed by `(kind, id)` where
`kind` is `'hotel' | 'room' | 'unit' | 'rate' | 'addon'` (`room` a room type, `unit` one physical room) and `data` is the full entity as JSON. A row with
an id the seed already has *replaces* that entity wholesale; a new id is a new entity. "Reset demo
state" on `/admin` clears the whole table for the hotel, so the catalog falls back to seed.

The `hotel` entry also carries the property's facilities — `Hotel.facilities`, an icon key from
`facilityIconSchema` plus a name each — edited on the Facilities tab of Hotel Settings
(`/admin/content/hotel`) and shown as chips on a room page, after the room's own amenities. The icon
vocabulary is fixed in the schema and drawn by `components/hotel/facility-icon.ts`, so the guest
site never meets a key it cannot render. A room type's own `RoomType.facilities` — names from that
same list, picked on the room's own content page (`RoomFacilitiesPicker`) rather than typed — narrows
which of them its page shows; `undefined` (no selection ever made) shows every one, so a room type
from before this field existed keeps showing what it always did.

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

The photo library combines the committed `public/images/**` manifest (excluding spinner frames)
with uploads in the `MEDIA` R2 bucket. Hotel, room and add-on photo editors accept multiple JPEG,
PNG or WebP files up to 10 MB each, or a batch selected from the library. The browser decodes and
resizes uploads to 2400 pixels, strips metadata and encodes WebP. `ContentService.uploadPhoto`
authorizes content editing and validates byte size and image headers before storing each file;
dimensions come from the bytes. `MediaLibraryPort` resolves both seed and uploaded URLs
asynchronously. Uploaded bytes and metadata persist in R2 under `photos/`, served through the
same-origin media route. Without a storage binding uploads fail explicitly. Saving the form
publishes the chosen ordered URLs; removing a photo from a gallery does not delete its library
asset. The About gallery preserves `aboutPhoto` as its cover for older consumers.
The committed manifest is still regenerated with `npm run generate:media-manifest` when local
seed photography changes.

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
back to the list with a notice rather than to a 404. Room numbers are stored per room, so moving a
room type to another floor or view renumbers nothing; a room a current booking chose is protected
where its number actually lives, in the room editor (see "Physical rooms" below).

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

**Spinner markup** (`/admin/content/spinner`) is the one CMS tab that isn't a `catalog_entries`
overlay. A zone — a polygon drawn on one of the building spinner's key-angle frames, bound to a
physical room, a floor (optionally one facade), a room type, or a plain link — has no seed value
to overlay and autosaves polygon-by-polygon, so it's stored in its own table instead:
`spinner_zones (id, hotel_id, frame_index, polygon, target, updated_at)`, written through
`SpinnerMarkupPort`'s plain `applyZoneBatch(hotelId, {upserts, deletes})`, scoped by `hotel_id`
alone — no version, no conflict to resolve, the same as the ported polygon editor's own reference
`saveBatch`. `ContentService.saveSpinnerZones` rejects a frame that isn't one of the spinner's
`keyAngles` and a target that doesn't currently exist; `CatalogService.getSpinnerZones` resolves
each zone's target through the live catalog for the guest and silently drops one that no longer
resolves. The editor itself (`components/admin/spinner-markup/`) is a port of a general-purpose
polygon editor built outside this repo — geometry and validation live in `lib/domain/polygon/`,
carrying over that project's own test suite. The frames themselves — and which of them are key
angles, and which one the orbit opens on — are edited at `/admin/content/spinner/frames`, the
one CMS screen that writes to R2; see "Photography and media" and
`docs/decisions/0006-spinner-markup.md`.

## Physical rooms, the floor plan and the front desk

The catalog sells room types; a floor plan and a PMS front desk need doors. Physical rooms are
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
guest-facing, hidden types left out), `getFrontDesk` (every room across a window of nights, with
bookings, demand, closures and daily arrivals and departures) and `getBookingRoom`. Simulated demand
is cut into 2–5-night blocks only so the front desk reads like a PMS, and is labelled as simulated
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

`/admin` is the hotel's own product: one shell (`app/admin/layout.tsx`) around its operations
navigation and the featured 360 Orbit (`components/admin/shell/admin-nav.tsx`). What reads and
writes real demo data, and what is a labelled preview of a later feature:

| Route | What it does | Backed by |
| --- | --- | --- |
| `/admin` | Tonight's occupancy, 14-night occupancy chart, arrivals and departures, recent bookings, integration status | `InventoryService.getFrontDesk`, `HotelRepository.listBookings`, `DemoControlPort` — live |
| `/admin/reset` | "Reset demo state" — not in the sidebar; reachable by URL for the demo owner and the e2e harness, not by navigation | `DemoControlPort.reset`, `ContentService.resetContent` — live |
| `/admin/front-desk` | Rooms × nights (7/14/30), filter by room type, stay dialog (dates, party, rate, payment) whose status badge is the desk's menu: check in, check out, no-show, one step back, cancel | `InventoryService.getFrontDesk`, `BookingService.setStayStateAsHotel` — live; demand is simulated and says so |
| `/admin/housekeeping`, `/admin/housekeeping/[id]` | Every physical room with its cleaning status (dirty, in progress, clean, inspected, out of order) and what today holds for it — occupied, arriving, departed, vacant, with the guest — filtered by status; the status is a menu on the row and, on the room's page, tiles plus a note for the desk. A room nobody has marked yet shows a default derived from its occupancy (`lib/domain/housekeeping.ts`: a departure is dirty, a stayover clean, the rest hashed so the board reads like a morning). Behind `permHousekeeping` — Owner, General manager, Front desk | `HousekeepingService` over `HousekeepingStore` (`housekeeping_states`, D1 with the in-memory fallback) and `InventoryService.getFrontDesk` for occupancy — live |
| `/admin/bookings`, `/admin/bookings/[reference]` | Search and stay-bucket filters; detail is three cards — guest (contact, party, totals across their stays), booking (status, room, rate, payment, dates, extras, cancel), room (photo, facts, price summary) — over the guest's booking history, matched by email | `BookingService.getConfirmation`/`cancelAsHotel`, `InventoryService.getBookingRoom`, `HotelRepository.listBookings` — live |
| `/admin/rates` | Base nightly and OTA-comparison price per room type, rooms left for seven nights, availability override | `ContentService.updateRate` (the CMS overlay), `DemoControlPort` overrides — live |
| `/admin/accounting`, `/admin/accounting/reports` | Collected, awaiting payment, owed back (cancelled after paying — cancelling leaves payment attempts untouched and there is no refund model yet) and booked value; totals by payment method; every booking's payment state, newest first. Reports are printable arrivals, departures, and in-house lists for a chosen day. | `buildLedger` (`lib/application/accounting.ts`) over `HotelRepository.listBookings`/`listPaymentAttempts`, plus booking and inventory reads for reports — live; payments are simulated and the screen says so |
| `/admin/channel-manager` | A Channex/OTA connection and mapping walkthrough, including custom channels | Browser-local state and fixed demo data only — explicitly labelled mock; connecting a channel does not write or synchronize anything |
| `/admin/content` — Rooms | Two tabs: Room types (`/admin/content`: cover, price, room count) and Rooms (`/admin/content/units`: grouped by type; add a room under a type — the number starts at the first free one on its floor — renumber or remove one); room type, room and rate editors under each | `ContentService`, `HotelRepository.listPhysicalRooms` — live |
| `/admin/content/add-ons` — Services | Its own nav item: every add-on by category, with the on-sale switch, and the add-on editors under it | `ContentService` — live |
| `/admin/content/hotel` — Hotel settings | Hotel details, copy, facilities, and local-media references for the guest property pages | `ContentService.updateHotel` — live |
| `/admin/content/spinner` — 360 Orbit | Overview (key-angle frames, zone coverage), `/markup` (draw and bind zones per frame), `/frames` (upload frames, pick key angles and the start frame) | `ContentService.getSpinnerMarkupContent`/`saveSpinnerZones`/`updateSpinnerScene`/`uploadSpinnerFrame` — live |
| `/admin/settings/team`, `/admin/settings/team/[id]`, `/admin/settings/team/roles` | Team directory, member role assignment, custom roles, and the permission matrix | `TeamService` plus enforced `permTeamRoles` permission — live |

The first time the back office opens in a browser, a short guided tour plays
(`components/admin/onboarding/`): one card at a time against a dimmed screen, pointing at the
property switcher, the nav, 360 Orbit, the bell and the assistant. A step points at whatever
carries `data-tour="…"`, and a step whose target has no boxes right now is skipped — which is
what makes one list work for both layouts, the sidebar's steps dropping out on a phone and the
menu button's step dropping out on a desktop, with nothing in the tour knowing about breakpoints.
"Seen" is remembered per browser (`localStorage`), like the bell's own "last seen", because
there is no per-user session to hang it on yet; `/admin/account` plays it again on demand.

An empty Reservations or Accounting screen offers "Add sample bookings" (`SampleBookingService`,
`lib/application/sample-bookings.ts`): a dozen stays relative to today — past, in house, upcoming,
and cancelled with and without payment — saved through `HotelRepository.saveBooking`/
`cancelBooking`, so inventory holds, the front desk and accounting agree with them. Totals come
from `buildPriceBreakdown`. Each has a fixed idempotency key, so pressing it twice adds nothing,
and none falls in the 45–48-day window the e2e suite books into. Past and in-house stays are why
it skips `BookingService.confirm`, which rightly refuses them.

Most sidebar screens read or write real demo data. `/admin/channel-manager` is the deliberate
exception: its connections are browser-local and explicitly labelled mock. Three more routes are
not linked from the main sidebar list — reachable only through another control or by URL — and each
says on screen that it is a preview: `/admin/settings` (brand preview, "changes aren't saved in
this demo"), `/admin/integrations` (mock adapter status, "nothing is connected to a real system"),
and `/admin/media` (the seed and uploaded photo library, with uploads available in the content
editors). Brand settings and real integration credentials remain previews. `/admin/account` is reached from the account menu: its
language setting persists in the admin cookie, while profile and subscription changes remain
browser-local previews.

`BookingService.cancelAsHotel` is the desk's cancel: the same `not_found`/`already_cancelled`/
`stay_started` rules as the guest's, without the email check, since the desk is trusted — a
signed-in team member (see "Sign-in" below), not anyone who can type the URL. A cancelled booking releases its nights and its room at
once, because both the floor plan and the front desk recompute `allocateRoomType` on read.
`BookingService.setStayStateAsHotel` is the desk's other move: a confirmed booking's `stayState`
(`booked` → `checked_in` → `checked_out`, or `booked` → `no_show`, each undoable one step —
`lib/domain/stay-state.ts`) is the guest's whereabouts, separate from the booking's own `status`,
which stays `confirmed` throughout; it never touches inventory. D1 keeps it in
`booking_stay_states` (its own table, like `booking_units`, since there is no migration runner
to ALTER `bookings`), the badge on every admin screen reads it, and the board's bar colours prefer
it over the calendar. The rates
screen saves through `ContentService.updateRate` with the rate's `version`, so it and the CMS rate
form share one concurrency check and one overlay row. Every write revalidates the admin screens
that show it and the guest routes it reprices.

### Sign-in

`/admin` is behind a session. The door is a two-step wizard in its own route group,
`app/(auth)/admin` — `/admin/sign-in` (who you are) then `/admin/welcome` (what you are here
for) — outside `app/admin/layout.tsx` so that layout, which sends anyone without a session to
the door, never wraps the door itself. Same URL prefix, a different tree, no sidebar.

```text
/admin/sign-in  → signInAction        ← team address + the shared password (lib/application/team-directory.ts,
                                         ADMIN_PASSWORD or the demo one); a wrong address and a wrong
                                         password fail identically; the assistant's rate limiter, own bucket
                → cookie admin-session ← { memberId, interests, onboarded, exp } + HMAC-SHA256 over it
                                         (ADMIN_SESSION_SECRET), httpOnly, /admin, seven days — no store
/admin/welcome  → saveInterestsAction ← as many of ADMIN_INTERESTS as apply, or "skip"; marks the
                                         session onboarded and lands on the first interest's screen
app/admin/layout.tsx                  ← no session → /admin/sign-in; not onboarded → /admin/welcome
every admin server action             ← requireAdminSession(): a layout guards what renders, not
                                         what can be posted to
ContentService                        ← its `authorize` (the old assertCanEditContent choke point) is
                                         requirePermission('team.perm…'), handed in by the container
```

`lib/application/admin-session.ts` owns all of it: encode/decode (a payload the browser can read
but cannot forge — constant-time compare, expiry, member still on the team), `signIn`, and the
cookie itself. There are no per-member passwords because there are no per-member accounts, only
the demo team; unset, `ADMIN_PASSWORD` is the demo password and the sign-in page prints it,
which is the only time it does (`adminAuthConfig().demo`). The session secret's development
fallback is fixed so a dev-server restart doesn't sign everyone out. The interests picked in
step two are remembered on the session, shown on `/admin/account` (with a way back to step two),
and decide where sign-in lands; the account menu at the foot of the sidebar signs out
(`signOutAction`: clear the cookie, back to the door). Playwright signs in once through the real
door (`e2e/auth.setup.ts`) and the other projects start from that browser state.

`team-directory.ts`'s `permissions` table (which role may do what) is a real, enforced gate, not a
preview: `admin-session.ts`'s `requirePermission(key)` — `requireAdminSession` plus `hasPermission`
on the signed-in member's role — is what `ContentService`'s `authorize` now is, and a handful of
server actions that don't go through `ContentService` (booking cancel, the front desk's own quote
and create, the demo rate/availability override, "Reset demo state") call it directly. A denial
comes back as an ordinary `ContentError`/form failure (`{ kind: 'forbidden', message }`), the same
shape as a validation or a rule error, not a thrown exception a page has to recover from. Still
ahead: real per-member *accounts* — the gate checks which role is signed in, but every role still
signs in with the one shared password, so who is actually behind it is on trust.

### Communications

`/admin/communications` is the desk's inbox: every guest thread of the selected hotel in one list
(search, and filters for unread and each channel), the open thread beside it, and a reply box.
`CommunicationsService` (`lib/application/communications-service.ts`) owns the rules — a thread is
one guest on one channel about one stay, a reply is trimmed and bounded, opening a thread is what
clears its unread count — over a `MessagingStore` port (`lib/domain/ports.ts`) that is D1
(`conversations`, `conversation_messages`) with the same in-memory fallback as everything else.
Unread threads reach the desk two ways without a socket: the bell's "Messages" section and a count on
the Communications sidebar item, both read server side on every admin render (`app/admin/layout.tsx`).
A hotel whose inbox is empty gets five demo threads written from its own bookings the first time the
list is opened, so the screen is never blank; they are ordinary rows afterwards.

How messages get in and out:

- **Guest chat.** Guest's confirmation page (`../guest/app/booking/[reference]/page.tsx`) carries
  `GuestChat` (`../guest/components/booking/guest-chat.tsx`). Sending posts to `POST /api/conversations`
  (`{ reference, name, email, body }`); the reference is honoured only when it belongs to that
  email, the same rule as the booking lookup. The guest sees replies by polling
  `GET /api/conversations/:id?email=…` every eight seconds while the page is open; reading never
  marks anything seen — only the desk opening the thread does.
- **Email in.** `POST /api/inbound/email` takes what an inbound-mail relay hands over
  (`{ from: { email, name }, subject, text, reference? }`) and files it as an email-channel thread.
  It is closed unless the caller presents `INBOUND_EMAIL_SECRET` in `x-inbound-secret`, and closed
  entirely while that secret is unset. Wiring it up means pointing Cloudflare Email Routing (an
  `email()` Worker that parses the message and calls this route) or a provider's inbound-parse
  webhook at it; neither is part of the demo.
- **Replies out.** A desk reply on email, WhatsApp or SMS goes through the `OutboundMessenger` port.
  Email has a real adapter: `container.ts` resolves `RESEND_API_KEY` at call time (never cached, the
  same rule as every other key in `cloudflare-env.ts`) and sends through Resend
  (`lib/infrastructure/resend-outbound-messenger.ts`) when it is set, falling back to the logging
  adapter (`lib/infrastructure/logging-outbound-messenger.ts`) — which delivers nothing but still
  leaves the reply in the thread — when it is not. WhatsApp and SMS have no provider yet and always
  log. Site-chat replies need no carrier: the guest's page reads them.
- **Automation, out.** `/admin/settings/automations` is a per-hotel list of `EmailAutomationRule`s —
  the four the product ships with (booking confirmed, an arrival reminder a day before check-in,
  booking cancelled, a thank-you after check-out), each on by default, plus whatever a hotel team
  builds itself: a custom rule off one of five triggers — the three lifecycle events above, or a
  calendar-relative "N days before check-in" / "N days after check-out" — with its own subject and
  body. A built-in rule's trigger *kind* is fixed (it's what the matching event fires), but its
  `days`, subject, body and on/off switch are exactly as editable as a custom rule's; a built-in
  can't be deleted, a custom rule can. Every field a rule's text can carry —
  `{{guestFirstName}}`, `{{reference}}`, `{{checkIn}}`, `{{total}}`, `{{hotelName}}`, and so on
  (`AUTOMATION_PLACEHOLDERS`) — is substituted at send time; the settings screen's preview modal
  (`AutomationPreviewButton`) renders the same substitution against a fabricated sample stay, never
  a real booking, so the team can see exactly what a guest gets before switching a rule on.
  `EmailAutomationsService` (`lib/application/email-automations-service.ts`) is the one place that
  decides whether to fire: `BookingService.confirm`/`cancelTrip`/`cancelAsHotel` call it through the
  same optional-callback shape `afterCheckout` already used for guest-document deletion, and
  `setStayStateAsHotel`'s existing checkout hook now also calls it, each firing every enabled rule
  whose trigger matches that event. The two calendar-relative triggers have no lifecycle event to
  hang off, so `GET /api/internal/scheduled-automations` — a daily Vercel Cron job gated by
  `CRON_SECRET`, the same bearer-token pattern as `/api/internal/document-deletions` — and the
  Cloudflare Worker's own `scheduled()` (ticking every ten minutes, `vite.config.ts`'s
  `triggers.crons`) both call `runScheduledAutomations` (`lib/application/scheduled-automations.ts`),
  which matches every enabled `before_check_in`/`after_check_out` rule against every confirmed
  booking whose check-in or check-out lands exactly `days` away from today. Unlike the old single
  fixed "exactly tomorrow" arrival reminder, several rules can now share a booking and Cloudflare's
  own tick would otherwise refire the same email all day, so a send log
  (`AutomationSendLogStore`, `automation_sends` in D1) is checked before sending and written after —
  the scheduled sweep's only idempotency; the three event triggers fire once, from the code path
  that already guards their own event, and need none. Every automation's email is filed into the
  guest's own thread through `CommunicationsService.sendSystemEmail` — a booking's `email`-channel
  thread specifically, never whichever channel `start()` would reuse, so an open site-chat thread
  for the same stay can't silently swallow the send — so the desk sees what went out in
  Communications, same as a reply it typed itself. Rules persist per hotel in `AutomationRuleStore`
  (`email_automation_rules` in D1, the in-memory fallback everywhere else); a hotel with no stored
  rows still gets the four built-ins, merged in at read time.

### Languages

The guest site speaks eight languages through `lib/i18n` (`LocaleProvider`, `useT`, the `l*`
formatters in `format.ts`), chosen in the header's `LanguagePicker` and remembered in
`localStorage` — nothing the server knows, so every guest page renders English first and corrects
itself after mount. The back office is deliberately not inside that choice: a hotel's team member
and a guest in the same browser are two people. `/admin` has its own, `lib/i18n/admin`, in three
languages (`ADMIN_LOCALES`: English, German, Russian), picked on `/admin/account` and kept in a
cookie scoped to `/admin` (`admin-locale`, set by `setAdminLocaleAction`), so the server reads it
the same way it reads the selected hotel and every screen renders in it from the first byte — no
English flash, and `<title>`s and server actions' own messages come back in it too.

```text
cookie admin-locale
  → getAdminLocale() / getAdminT()        ← server components, generateMetadata, server actions
  → AdminLocaleProvider (app/admin/layout) ← seeded from the same read, so the client agrees
  → useAdminLocale() / useAdminT()        ← client components
```

`adminT(locale)` is pure and synchronous, so the server, a client component and a test all
translate identically; `translateAdmin` falls back to English (never to the raw key), though the
dictionaries' types make a missing key a compile error first. The dictionary is one file per
group of screens under `lib/i18n/admin/dictionaries/` (`shell`, `dashboard`, `account`,
`operations`, `frontDesk`, `content`, `catalog`, `spinner`, `assistant`, `settings`), each a
`defineArea({ en, de, ru })` whose keys are inferred from `en` — a key missing from `de` or `ru` is
a type error — merged by `index.ts`. Dates, money, counts and the fixed vocabularies (views, beds,
statuses, payment methods…) go through the guest site's own `l*` formatters with the admin locale,
since `AdminLocale` is a subset of `Locale`; nothing in `/admin` hand-builds "3 nights" any more.

What is not translated, on purpose: the hotel's own catalog copy (room, rate and add-on names,
descriptions, the hotel's text — content, not chrome, as on the guest site), product and
integration names, and the CMS's own validation and rule messages from `content-service.ts`, which
still arrive in English through `ContentFormState` — translating those means error codes rather
than sentences at the service boundary, which is a change to the application layer this did not
make. The admin assistant's interpreter (keyword fallback and the OpenAI prompt) reads English
requests; the panel says so under its example chips. The default is English, so the e2e suite,
which reads English text, runs unchanged.

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
Guest's `../guest/lib/formatting.ts`/`../guest/components/assistant/assistant-panel.tsx` from the app's own numbers; nothing
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

### Admin assistant

The back office has the same control (`components/admin/assistant/`, mounted once in
`AdminShell`), for a hotel team member rather than a guest, as a chat window docked beside the page
rather than a dialog over it — setting a hotel up is done alongside the screens it changes. "Set
the Deluxe Sea View rate to 320", "hide Garden Studio", "mark Panorama Suite sold out", "take the
airport transfer off sale", "create a room type and a room for it", "create a rate for Deluxe Sea
View", "create a service", "open room rates". The guest
rule holds with one more clause — **the model interprets language; it never produces inventory,
availability, or money, and it never writes.**

```text
message (typed)  + draft (what is being set up so far)  + the last few turns
  → AdminCommandInterpreter port        ← OpenAI structured output, or keyword-admin-interpreter.ts;
                                           with a draft open, the message is read as the answer to
                                           its next question (plus anything else it volunteers)
  → AdminCommand                        ← one of a fixed set of actions, plus the target *as the
                                           admin worded it* — never an id
  → AdminAssistantService.ask           ← resolves the words against the live catalog's own names
                                           (exact, then containing, then every-word; a tie is
                                           returned as a question, never guessed), reads the
                                           current value and the entity's version
  → a question                          ← something is still needed: the draft, plus which field
    or AdminProposal                    ← what would change, from what, to what; shown and confirmed
  → AdminAssistantService.apply         ← the admin's click, through the same ContentService /
                                           DemoControlPort mutators the forms use, with the version
                                           the proposal was read at — so a change made in between
                                           is the same conflict the form would report; may hand
                                           back a follow-up draft ("now a room for it")
```

The conversation's state is the `draft` (`adminDraftSchema` in `lib/domain/admin-assistant.ts`):
the panel holds it and sends it back with every message, so the server keeps no session and it
works the same across isolates and reloads. A new room type is gathered field by field in a fixed
order (name, description, floor, size, capacity, bed, view), one answer at a time or all at once,
and created `hidden` — amenities and photos are added on its own CMS page, which is what
`setRoomHidden(false)` insists on. "Cancel" drops the draft.

`ask` only reads. `apply` is a second server action (`app/admin/assistant/actions.ts` — the back
office is server actions only, no new API routes) that re-parses the proposal with
`adminProposalSchema` because it round-trips through the browser; `ask` parses the draft and the
history the same way. The action set is deliberately the mutators that already exist — a nightly
price, a room type's `hidden`, its availability override, an add-on's `enabled`, `createRoom`,
`createPhysicalRoom`, `createRate`, `createAddOn`, and navigation — so the assistant has no write path of its own; extending it
is a matter of adding an action and its mapping, not a new way to write. Every sentence the panel
shows (`formatAdminQuestion`, `formatAdminProposal`, `formatAdminAssistantReply`,
`formatAdminApplyOutcome` in `lib/formatting.ts`) is composed from the draft's and the proposal's
own names and numbers. The interpreter, its fallback, the rate limit and the no-logging rule are
the guest assistant's, reused; voice is not offered — a request here is about to be confirmed as a
write, and typed is the sharper tool for that. It is bound to the CMS's hotel (`ContentService` on
`DEMO_HOTEL_SLUG`), so a proposal always describes the catalog `apply` will touch.

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
`BuildingSpinner` draws the current frame to a single `<canvas>` rather than mounting elements —
160 full-size images left in the DOM after one full turn would be unreasonable — loads frames
nearest-first around the opening frame and fills in the rest in the background, and animates
between `keyAngles` stops on an arrow button or arrow key (a press during a turn queues the next
stop). A drag turns it directly, about a frame per 4px; there is no inertia and no idle rotation.
A tap on a hotspot opens a card beside it (the product's sheet on a phone) with the room type's
price from the catalog offer; `?frame=N` and `?unit=<slug>` deep-link into it. If the frames can't
load it falls back, silently, to the area's still photo with the markers pinned front-on.

A room gallery's 360° tab is `PanoramaViewer`: an equirectangular sphere over Pannellum, vendored
at `public/vendor/pannellum`, mounted only while its tab is open.

Both views are one module, `components/view-360/`, with a single public entry (`index.ts`; a deep
import fails `npm run lint`). Its README.md is the maintained reference — structure, invariants,
and how to replace the frames, add a hotspot, or give a room a sphere — and
`docs/decisions/0005-view-360-module.md` records why it is shaped that way. See `SPINNER_SPEC.md`'s
decision log (2026-09-06) for the frame-count, hotspot, and baked-vs-live-WebGL reasoning behind a
baked frame sequence over a live scene. A same-day detour into a live three.js model built from
procedural block massing (`Hotel.model`) was tried and replaced by this spinner hours later; its
files and the `Hotel.model` schema were removed as dead code once the spinner took over.

The orbit's frames, key angles and start frame are editable from `/admin/content/spinner/frames` —
the one place in this project a CMS screen writes to R2. Each chosen file is re-encoded to WebP in
the browser (`OffscreenCanvas`, no server-side image library) and uploaded under a fresh
`frameSetId` so an upload in progress can never collide with what's already live; `Hotel.spinner`
itself only changes once every frame has a URL (`ContentService.updateSpinnerScene`), through the
same `hotel`-kind overlay row `updateHotel` already writes. Replacing the frames clears the
spinner's hotspots and every zone drawn in `/admin/content/spinner/markup` — both name frame
indices from a sequence that no longer exists — with a confirmation that says so before it
happens; picking different key angles on the *same* frames leaves both alone. See
`docs/decisions/0006-spinner-markup.md`.

## Current limitations

Without a D1 binding, demo state (including the CMS overlay) is process-local and resets with the
worker isolate. `/admin` is behind a session (see "Sign-in" under Back office), but a shared
password and a demo team, not accounts: every role signs in with the same password, so the gate
knows which role is behind a request (`ContentService`'s `authorize` is `requirePermission`, a real
check against `team-directory.ts`'s `permissions`) but not which actual person. Live payment is a
no-op until CLAUDE.md's roadmap step 9 — no real payment, and no PMS,
channel manager, or OTA connection. Downstream CRM/PMS delivery is best-effort and swallowed on
failure; production needs a queue with retries. The photographs are licensed stock standing in for
the property's own and must be replaced before any real launch using the CMS photo uploader
(see "Content management (CMS)") or the spinner frame manager (see "Photography and media").
The CMS itself has no drafts, version history, or scheduled publishing (every save is immediate and
live), and supports one hotel at a time, though every overlay row already carries a `hotel_id`. The
AI concierge's rate limiter is per-isolate, not shared; without `OPENAI_API_KEY` its search still
works (the keyword interpreter) but its mic does not (no transcription fallback exists).
