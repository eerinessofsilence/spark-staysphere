# SPARK StaySphere 360

SPARK StaySphere 360 is a white-label 3D hotel booking and direct-sales platform. The demo hotel is **Asteria Cove** and the product line is **“See the stay. Book the room.”**

## Product intent

The product must feel like one connected booking experience, not a landing page or a disconnected screen set. Guests explore the hotel, filter rooms, inspect the exact room/view, choose services, and complete a clearly labelled demo booking. Hotel teams later manage inventory, add-ons, and bookings in `/admin`.

## Current scope

The repository contains a Vinext/React/TypeScript site foundation, strict Zod domain schemas, adapter contracts, demo hotel data, and an in-memory repository. UI flows, real 3D, API routes, admin, and production integrations remain future work.

## Technical decisions

- TypeScript strict mode; Zod is the runtime contract boundary.
- Business rules live in `lib/application`, not React components.
- Data access goes through `HotelRepository` and integration ports in `lib/domain/ports.ts`.
- Demo state is in memory and resets with the process.
- PMS or channel manager is the production source of truth for inventory, rates, and reservations.
- OTA integrations require official partner access; no scraping.
- Live payment is out of scope. Production must use provider-hosted/tokenized collection.

## Next implementation order

1. Build the connected guest-facing room search/catalog and detail route.
2. Add quote → hold → demo payment → booking confirmation.
3. Add `/admin` demo and mock adapter controls.
4. Add procedural React Three Fiber scene, 360 viewer, tests, QA, and deployment.

Read `AGENTS.md`, `TECH.md`, and `DESIGN_SYSTEM.md` before changing architecture or UI.
