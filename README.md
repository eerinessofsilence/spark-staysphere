# SPARK StaySphere 360

White-label interactive hotel discovery and direct-booking platform. This repository currently provides the base web project, strict domain contracts, mock hotel inventory, repository boundaries, and integration interfaces.

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
```

## What exists

- Next-compatible App Router site foundation.
- Zod schemas/types for hotel, rooms, rates, availability, add-ons, guests, bookings, payments, and integrations.
- Repository plus PMS/channel manager/booking/payment/CRM adapter ports, each with a mock implementation.
- Eight demo room types, demo rates/add-ons, an in-memory repository, and demo integration statuses.
- `BookingService` with idempotency, quote recheck, hold, and demo payment boundaries.
- Base product, architecture, agent, and design-system documentation.

## Next slice

Build the connected guest journey: room search/catalog → room detail → add-ons → guest details → demo payment → confirmation. Keep UI code dependent on application services and ports, not on mock arrays.

See `TECH.md` for the production integration model and `AGENTS.md` for contribution rules.
