# SPARK StaySphere 360 — Technical Foundation

## Stack

- Vinext (Next-compatible App Router), React 19, TypeScript strict mode.
- Tailwind CSS 4 plus shadcn UI primitives.
- Zod for runtime validation and inferred domain types.
- Cloudflare/Sites-compatible Vite build.
- React Three Fiber + drei + three for the optional 3D scene, loaded on demand.
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

`lib/infrastructure` holds eight demo room types with rates and add-ons, an in-memory repository
with deterministic date-aware availability, mock implementations of every adapter port, and the
`DemoControlPort` backing `/admin` (status overrides, add-on enablement, integration status rows).

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

## 3D and media

`components/hotel/resort-massing.tsx` is an SVG poster that renders on the server and carries the
arrival screen on its own. `components/hotel/resort-canvas.tsx` is the React Three Fiber scene; it
is `React.lazy`-loaded only when a visitor presses **3D**, lands in its own ~876 KB chunk, and is
wrapped in an error boundary that returns to the poster if WebGL is unavailable. Both use the same
hotspot data, so replacing `<ResortModel />` with a loaded GLB does not touch the surrounding UI.

Room artwork (`components/rooms/room-visual.tsx`) is procedural SVG derived from the room's slug,
view, and zone. No external image host is involved, and the same call site accepts photography or
a 360 tile set later.

## Current limitations

Demo state is process-local and resets with the worker isolate — bookings, availability overrides,
and add-on enablement do not survive a restart, and are not shared between isolates. There is no
database, no auth on `/admin`, no real payment, and no PMS, channel manager, or OTA connection.
Downstream CRM/PMS delivery is best-effort and swallowed on failure; production needs a queue with
retries. The 360° viewer is a simulated pan over the procedural artwork, not a photographic tile
set, and is labelled as such in the UI.
