# SPARK StaySphere 360

SPARK StaySphere 360 is a white-label 3D hotel booking and direct-sales platform. The demo hotel is **Asteria Cove** and the product line is **“See the stay. Book the room.”**

## Product intent

The product must feel like one connected booking experience, not a landing page or a disconnected screen set. Guests explore the hotel, filter rooms, inspect the exact room/view, choose services, and complete a clearly labelled demo booking. Hotel teams later manage inventory, add-ons, and bookings in `/admin`.

## Current scope

The guest journey is built end to end: arrival (`/`), catalog (`/rooms`), room detail
(`/rooms/[slug]`), a six-step demo booking (`/book/[slug]`), confirmation (`/booking/[reference]`),
and hotel operations (`/admin`). Quotes and bookings are exposed as server actions and as
`POST /api/quotes`, `POST /api/bookings`, and `GET /api/bookings/:reference`.

The UI is photography-led: hero areas with hotspots, room galleries, and licensed stock
photography stored locally in `public/images`. Playwright covers the golden path at 1440px and
390px.

Bookings, payment attempts, admin overrides, and inventory holds persist to D1 (falling back to
in-memory when no D1 binding is configured) — see `lib/infrastructure/durable-hotel-repository.ts`
and TECH.md's Persistence section.

Still future work: auth on `/admin`, the property's own photography, and production PMS, channel
manager, payment, and CRM integrations.

## Technical decisions

- TypeScript strict mode; Zod is the runtime contract boundary.
- Business rules live in `lib/application`, not React components.
- Data access goes through `HotelRepository` and integration ports in `lib/domain/ports.ts`.
- Bookings, payment attempts, admin overrides, and inventory holds are durable (D1, falling back
  to in-memory). The room/rate/add-on catalog is always static seed data, in every backend.
- All money flows through `buildPriceBreakdown` in `lib/domain/pricing.ts`; components never
  compute a total.
- `lib/application/container.ts` is the only module that may import `lib/infrastructure`.
- UI follows `DESIGN_SYSTEM.md › Rules` — they exist because the first pass looked generic. Ink
  pills, clay accent, Phosphor filled icons, photography, no eyebrows, no stat tiles, no icon
  cards. `lib/ui.ts` holds the shared shapes (`pill`, `tag`, `iconButton`, `fieldClass`).
- PMS or channel manager is the production source of truth for inventory, rates, and reservations.
- OTA integrations require official partner access; no scraping.
- Live payment is out of scope. Production must use provider-hosted/tokenized collection.

## Commit conventions

Always write [Conventional Commits](https://www.conventionalcommits.org/) — never a bare, generic message. Format: `type(scope): summary` in the imperative mood, e.g. `feat(booking): add idempotent hold confirmation`. Common types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`, `style`. Add a body when the *why* isn't obvious from the diff. This applies to every commit in this repository, not just feature work.

## Next implementation order

1. ~~Guest-facing room search/catalog and detail route.~~ Done.
2. ~~Quote → hold → demo payment → booking confirmation.~~ Done.
3. ~~`/admin` demo and mock adapter controls.~~ Done.
4. ~~Photography-led redesign with the design rules enshrined.~~ Done.
5. ~~Persist demo state (D1) so bookings survive a restart and are shared across isolates.~~ Done.
6. Replace stock photography with the property's own, and add real 360 tiles if the property has them.
7. Auth on `/admin`, then the first real PMS or channel-manager adapter behind the existing ports.
8. Deployment: Cloudflare Workers via `npm run build` and `wrangler`.

Read `AGENTS.md`, `TECH.md`, and `DESIGN_SYSTEM.md` before changing architecture or UI.
