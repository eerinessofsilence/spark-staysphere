# SPARK StaySphere 360

SPARK StaySphere 360 is a white-label 3D hotel booking and direct-sales platform. The demo hotel is **Asteria Cove** and the product line is **“See the stay. Book the room.”**

## Product intent

The product must feel like one connected booking experience, not a landing page or a disconnected screen set. Guests explore the hotel, filter rooms, inspect the exact room/view, choose services, and complete a clearly labelled demo booking. Hotel teams later manage inventory, add-ons, and bookings in `/admin`.

## Current scope

The guest journey is built end to end: arrival (`/`), catalog (`/rooms`), room detail
(`/rooms/[slug]`), a six-step demo booking (`/book/[slug]`), confirmation (`/booking/[reference]`),
and hotel operations (`/admin`). Quotes and bookings are exposed as server actions and as
`POST /api/quotes`, `POST /api/bookings`, and `GET /api/bookings/:reference`.

The 3D scene is procedural React Three Fiber, lazy-loaded behind the SVG poster. Room artwork is
procedural SVG. Playwright covers the golden path at 1440px and 390px.

Still future work: a database, auth on `/admin`, real GLB/360 assets, and production PMS, channel
manager, payment, and CRM integrations.

## Technical decisions

- TypeScript strict mode; Zod is the runtime contract boundary.
- Business rules live in `lib/application`, not React components.
- Data access goes through `HotelRepository` and integration ports in `lib/domain/ports.ts`.
- Demo state is in memory and resets with the process.
- All money flows through `buildPriceBreakdown` in `lib/domain/pricing.ts`; components never
  compute a total.
- `lib/application/container.ts` is the only module that may import `lib/infrastructure`.
- PMS or channel manager is the production source of truth for inventory, rates, and reservations.
- OTA integrations require official partner access; no scraping.
- Live payment is out of scope. Production must use provider-hosted/tokenized collection.

## Commit conventions

Always write [Conventional Commits](https://www.conventionalcommits.org/) — never a bare, generic message. Format: `type(scope): summary` in the imperative mood, e.g. `feat(booking): add idempotent hold confirmation`. Common types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`, `style`. Add a body when the *why* isn't obvious from the diff. This applies to every commit in this repository, not just feature work.

## Next implementation order

1. ~~Guest-facing room search/catalog and detail route.~~ Done.
2. ~~Quote → hold → demo payment → booking confirmation.~~ Done.
3. ~~`/admin` demo and mock adapter controls.~~ Done.
4. ~~Procedural React Three Fiber scene, 360 viewer, tests.~~ Done.
5. Persist demo state (D1 or Redis) so bookings survive a restart and are shared across isolates.
6. Replace the simulated 360° pan with real tiles, and `<ResortModel />` with a loaded GLB.
7. Auth on `/admin`, then the first real PMS or channel-manager adapter behind the existing ports.
8. Deployment: Cloudflare Workers via `npm run build` and `wrangler`.

Read `AGENTS.md`, `TECH.md`, and `DESIGN_SYSTEM.md` before changing architecture or UI.
