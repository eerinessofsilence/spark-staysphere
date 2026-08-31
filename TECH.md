# SPARK StaySphere 360 — Technical Foundation

## Stack

- Vinext (Next-compatible App Router), React 19, TypeScript strict mode.
- Tailwind CSS 4 plus shadcn UI primitives.
- Zod for runtime validation and inferred domain types.
- Cloudflare/Sites-compatible Vite build.
- Planned: React Three Fiber/Drei, TanStack Query, React Hook Form, Playwright.

## Data flow

```text
Route / component
  → application service (quote, hold, confirm)
  → domain port (repository or external adapter)
  → mock implementation now / HTTP production adapter later
```

Domain schemas are in `lib/domain/schemas.ts`. Ports for PMS, channel manager, booking engine, payment, CRM, and local storage are in `lib/domain/ports.ts`. `BookingService` owns availability/price recheck, hold, demo authorization, and idempotent persistence. `lib/infrastructure` contains eight demo room types, rates, add-ons, the in-memory repository, and mock implementations of every adapter port (`mock-adapters.ts`) plus demo `IntegrationStatus` rows for the future admin integrations panel.

## Production source of truth

PMS/channel manager owns rooms, restrictions, rates, inventory, and reservation updates. StaySphere should call one internal booking API; the frontend must not independently synchronize OTA inventory. Booking.com/Airbnb access is through official partner programs or the selected channel manager.

## Target API boundaries

- `GET /hotels/:slug`
- `GET /hotels/:id/rooms?checkIn=&checkOut=&guests=`
- `POST /quotes`
- `POST /holds`
- `POST /bookings` with `Idempotency-Key`
- `GET /bookings/:reference`
- Admin: room status, add-on enablement, bookings, integration status.

## Storage model

PostgreSQL-ready entities: hotels, room types, rate plans, availability snapshots, add-ons, guests, bookings, booking add-ons, payment attempts, integration connections, and webhook deliveries. Redis later provides short-lived holds, idempotency cache, rate limiting, and queues. R2/S3 stores images, GLB/GLTF, and 360 tiles.

## Security and payments

- Never store raw card data; use provider-hosted/tokenized fields.
- Separate demo/sandbox/production credentials and environments.
- Validate all external payloads and verify webhook signatures.
- Log integration correlation IDs, not secrets or sensitive payment fields.
- Require server-side final quote and availability checks.

## Current limitations

The repository is an architecture foundation. Mock state is process-local; no real API, database, 3D scene, auth, admin, payment, PMS, or OTA connection exists yet.
