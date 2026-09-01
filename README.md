# SPARK StaySphere 360

White-label interactive hotel discovery and direct-booking platform. **See the stay. Book the room.**

The demo property is **Asteria Cove**, a fictional hotel with eight room types. The guest journey
runs end to end: arrival → room search → room detail → services → guest details → demo payment →
confirmation, with a hotel-side operations view at `/admin`.

## Quick start

Requires Node.js 22.13+.

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e     # Playwright golden path, 1440px and 390px
```

`npm run test:e2e` starts its own dev server on port 3100. The first run needs
`npx playwright install chromium`.

## Routes

| Route | What it does |
|---|---|
| `/` | Arrival: procedural scene with orbit, 360° auto-rotate, fullscreen, and four hotspots; stay search |
| `/rooms` | Catalog: URL-driven dates, guests, budget, room type, view, beds, area, floor, amenities, sort |
| `/rooms/[slug]` | Room detail: zone switcher, 360° preview, specs, add-ons, sticky server-quoted summary |
| `/book/[slug]` | Six-step booking: stay, room and rate, services, guest details, demo payment, review |
| `/booking/[reference]` | Confirmation: reference, dates, room, services, price breakdown |
| `/admin` | Demo operations: availability overrides, add-on enablement, session bookings, integration status |
| `POST /api/quotes` | Server-authoritative price and availability for a stay |
| `POST /api/bookings` | Creates a demo booking; requires an `Idempotency-Key` header |
| `GET /api/bookings/:reference` | Reads a booking created in this process |

## Architecture

```text
route / component
  → application service (CatalogService, BookingService)
  → domain port (HotelRepository, BookingEngineAdapter, PaymentProvider, …)
  → mock implementation now / HTTP production adapter later
```

`lib/application/container.ts` is the composition root and the only module that imports
`lib/infrastructure`. No component reads the mock arrays directly, and no client component
computes a price: every total on screen comes from a server quote.

## What is real and what is not

- Inventory, rates, availability, and partner-site comparison prices are **simulated demo data**
  held in memory. They reset when the server process restarts.
- Payment is **demo only**. No card fields are rendered and no card data is collected.
- The 3D scene and room artwork are **procedural**, generated locally from the room data. There is
  no GLB, no photography, and no external image host.
- Every adapter (PMS, channel manager, booking engine, payment, CRM) is a mock. `/admin` says so.

See `TECH.md` for the production integration model, `DESIGN_SYSTEM.md` for tokens, and `AGENTS.md`
for contribution rules.
