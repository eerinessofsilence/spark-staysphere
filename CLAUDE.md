# SPARK StaySphere 360

SPARK StaySphere 360 is a white-label 3D hotel booking and direct-sales platform. The demo hotel is **Asteria Cove** and the product line is **“See the stay. Book the room.”**

## Product intent

The product must feel like one connected booking experience, not a landing page or a disconnected screen set. Guests explore the hotel, filter rooms, inspect the exact room/view, choose services, and complete a clearly labelled demo booking. Hotel teams manage inventory, add-ons, and bookings in `/admin`, and edit the catalog itself — the hotel's copy, room types, rates, and add-ons — in `/admin/content`, without a deploy.

## Current scope

The guest journey is built end to end: arrival (`/`), catalog (`/rooms`, including a floor plan
where a guest picks the exact room), room detail (`/rooms/[slug]`), a six-step demo booking
(`/book/[slug]`), and confirmation (`/booking/[reference]`). Quotes and bookings are exposed as
server actions and as `POST /api/quotes`, `POST /api/bookings`, and `GET /api/bookings/:reference`;
the back office is server actions only, no new API routes.

The hotel's back office (`/admin`) has its own shell and two groups of screens, every one of them
live on demo data. Operations: an overview, a rooms × nights tape chart, bookings with detail and
cancel, and rates & availability. Content: the CMS at `/admin/content` — room types, their physical
rooms (`/admin/content/units`: a type is created first, then its rooms), rates and add-ons, and the
hotel's own copy (see TECH.md's "Content management (CMS)" and "Back office").

The UI is photography-led: hero areas with hotspots, room galleries, and licensed stock
photography stored locally in `public/images`. The arrival stage's facade/roof/cove photo is
replaced by a draggable building spinner (`Hotel.spinner`, `BuildingSpinner`)
— a baked 160-frame orbit drawn to a canvas, not a live 3D scene — whose hotspots open the rooms
on each floor; see `SPINNER_SPEC.md` for why a baked sequence replaced an earlier, same-day
three.js attempt. That spinner and the room gallery's panorama sphere (`PanoramaViewer`) are one
module, `components/view-360/`, whose README.md is the handoff doc for both. Playwright covers the
golden path at 1440px and 390px.

Bookings, payment attempts, admin overrides, and inventory holds persist to D1 (falling back to
in-memory when no D1 binding is configured) — see `lib/infrastructure/durable-hotel-repository.ts`
and TECH.md's Persistence section.

A persistent AI room finder — a round control on every guest route — turns a spoken or typed
request into a filter object through a `RoomSearchInterpreter` port (OpenAI, or a deterministic
keyword fallback with no key configured), sanitises it against the live catalog, and hands the
result to the same `CatalogService`/`buildPriceBreakdown` path everything else uses; see TECH.md's
"AI concierge" section.

Still future work: auth on `/admin` (and with it real team roles), saved brand settings and media
uploads, the property's own photography, and production PMS, channel manager, payment, and CRM
integrations.

## Technical decisions

- TypeScript strict mode; Zod is the runtime contract boundary.
- Business rules live in `lib/application`, not React components.
- Data access goes through `HotelRepository` and integration ports in `lib/domain/ports.ts`.
- Bookings, payment attempts, admin overrides, and inventory holds are durable (D1, falling back
  to in-memory). The room/rate/add-on catalog's *baseline* is always static seed data
  (`lib/infrastructure/mock-data.ts`), in every backend; `/admin/content` edits are a CMS overlay
  on top of it, never a change to the seed itself — see TECH.md's "Content management (CMS)".
- CMS business rules (slugs, references, currency, media, optimistic concurrency) live in
  `lib/application/content-service.ts`, the same layer as the rest of the app's rules — never in
  a component or a server action.
- All money flows through `buildPriceBreakdown` in `lib/domain/pricing.ts`; components never
  compute a total.
- The 360° views are imported only from `@/components/view-360` (lint-enforced); inside, pure
  maths is a tested function, a hook owns one side effect, a component only composes — see
  `components/view-360/README.md` and `docs/decisions/0005-view-360-module.md`.
- `lib/application/container.ts` is the only module that may import `lib/infrastructure`.
- UI follows `DESIGN_SYSTEM.md › Rules` — they exist because the first pass looked generic. Ink
  pills, clay accent, Phosphor filled icons, photography, no eyebrows, no stat tiles, no icon
  cards. `lib/ui.ts` holds the shared shapes (`pill`, `tag`, `iconButton`, `fieldClass`).
- Layout is a grid of Tailwind theme tokens in `app/globals.css`: `container-page`/`-reading`/`-form`,
  the `gutter` spacing step, and named column templates (`grid-cols-sidebar`, `-sidebar-start`,
  `-media`, `-main-aside`, `-shell`). No page free-hands `max-w-[…px]` or a `grid-cols-[…]` split —
  see `DESIGN_SYSTEM.md › Layout grid`.
- PMS or channel manager is the production source of truth for inventory, rates, and reservations.
- OTA integrations require official partner access; no scraping.
- Live payment is out of scope. Production must use provider-hosted/tokenized collection.

## Commit conventions

Always write [Conventional Commits](https://www.conventionalcommits.org/) in the imperative mood — `type(scope): summary`, e.g. `feat(booking): add idempotent hold confirmation`. Never a bare, generic message; this applies to every commit, not just feature work. See CONTRIBUTING.md for the full convention and AGENTS.md for working rules.

## Next implementation order

1. ~~Guest-facing room search/catalog and detail route.~~ Done.
2. ~~Quote → hold → demo payment → booking confirmation.~~ Done.
3. ~~`/admin` demo and mock adapter controls.~~ Done.
4. ~~Photography-led redesign with the design rules enshrined.~~ Done.
5. ~~Persist demo state (D1) so bookings survive a restart and are shared across isolates.~~ Done.
6. ~~Basic CMS in `/admin/content` for the hotel copy, room types, rates, and add-ons, with a D1
   overlay on the seed catalog.~~ Done.
7. ~~Back office for the demo: shell, overview, tape chart, bookings with cancel, rates &
   availability, and the CMS in the same shell; physical rooms and the guest floor plan.~~ Done.
8. Replace stock photography with the property's own, add real 360 tiles if the property has them,
   and the property's own rendered orbit frames in place of the demo `Hotel.spinner` sequence.
9. Auth on `/admin` (and `/admin/content` — `assertCanEditContent()` in `content-service.ts` is the
   one gate to wire it into) with team roles; then the first real PMS or channel-manager adapter
   behind the existing ports. A production PMS/channel-manager also becomes the owner of prices,
   rates and room assignment, which `TECH.md` documents but the CMS and rates screen do not
   enforce.
10. Deployment: Cloudflare Workers via `npm run build` and `wrangler`.
11. CMS v2, if ever needed: file uploads to R2 (`MediaStoragePort` is declared, not implemented),
    saved brand settings, draft/versioned content, multi-hotel support (`hotel_id` is already in
    every overlay row).

Read `AGENTS.md`, `TECH.md`, and `DESIGN_SYSTEM.md` before changing architecture or UI.
