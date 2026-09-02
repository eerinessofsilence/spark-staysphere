# SPARK StaySphere 360 — Technical Foundation

## Stack

- Vinext (Next-compatible App Router), React 19, TypeScript strict mode.
- Tailwind CSS 4 plus shadcn UI primitives.
- Zod for runtime validation and inferred domain types.
- Cloudflare/Sites-compatible Vite build.
- Phosphor Icons (`@phosphor-icons/react/dist/ssr`, filled weight) for every product icon;
  `lucide-react` remains only as an internal dependency of the generated shadcn primitives and
  is lint-banned elsewhere.
- Bricolage Grotesque, Onest, and Instrument Serif self-hosted through `next/font/google`.
- Playwright for golden-path end-to-end coverage at 1440px and 390px.
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

`lib/application/booking-intake.ts` is the shared slug-addressed intake used by both the booking
UI's server actions and the HTTP route handlers, so both entry points re-derive price on the server
and neither trusts a client-supplied total.

`lib/infrastructure` holds eight demo room types with rates and add-ons (static seed data, never
persisted), an in-memory repository with deterministic date-aware availability, mock
implementations of every adapter port, and the `DemoControlPort` backing `/admin` (status
overrides, add-on enablement, integration status rows).

## Persistence

Bookings, payment attempts, room-status overrides, add-on toggles, and confirmed-booking
inventory holds are durable: `lib/application/container.ts` exports
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

The room/rate/add-on *catalog* (names, prices, descriptions) is never written to D1 — it stays
static seed data in `mock-data.ts` in both backends, since nothing in the guest or admin UI edits
it. Only the state a booking or an admin action actually mutates is durable.

## Production source of truth

PMS/channel manager owns rooms, restrictions, rates, inventory, and reservation updates. StaySphere should call one internal booking API; the frontend must not independently synchronize OTA inventory. Booking.com/Airbnb access is through official partner programs or the selected channel manager.

## API boundaries

Implemented as route handlers in this app; there is no separate API service.

- `POST /api/quotes` — price and availability for a stay, including selected add-ons.
- `POST /api/bookings` — creates a booking; requires an `Idempotency-Key` header of at least eight
  characters. Returns 409 for `unavailable` or `price_changed`, 402 for `payment_declined`.
- `GET /api/bookings/:reference` — reads a booking from the current process.

The guest UI reaches the same intake through server actions (`app/book/[slug]/actions.ts`) rather
than fetching these routes, and `/admin` writes through server actions on the `DemoControlPort`.

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

There is no 3D scene. The earlier procedural React Three Fiber massing and SVG interiors were
removed as schematic; a real GLB or 360 tile set, if it ever exists, slots into the same
`HotelArea`/`media` records without a UI rewrite.

## Current limitations

Demo state is process-local and resets with the worker isolate — bookings, availability overrides,
and add-on enablement do not survive a restart, and are not shared between isolates. There is no
database, no auth on `/admin`, no real payment, and no PMS, channel manager, or OTA connection.
Downstream CRM/PMS delivery is best-effort and swallowed on failure; production needs a queue with
retries. The photographs are licensed stock standing in for the property's own and must be
replaced before any real launch.
