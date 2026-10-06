# StaySphere PMS

PMS is the hotel team's back-office application: bookings, front desk, rates, accounting,
housekeeping, team access, and hotel content. The public discovery and booking experience lives in
the separate [`apps/guest`](../guest/README.md) app. The marketing Product Site lives in
[`apps/site`](../site/README.md).

PMS owns hotel content, prices, availability, booking records, guest records, and the curated demo
showcase. Guest reads public data and submits bookings through the PMS HTTP API; it has no PMS
repository or shared local database.

## Run locally

From the monorepo root:

```bash
npm install
npm run dev:pms             # PMS at http://localhost:3001
npm run dev:pms-guest       # PMS + Guest together
```

PMS uses locally emulated D1 and R2. Bookings, admin overrides, CMS edits, and uploaded frames
survive a restart. Guest runs as a separate Worker with its own state and reaches PMS through
`PMS_API_URL` (default `http://localhost:3001`). PMS links back to Guest through `GUEST_APP_URL`;
local development defaults to `http://localhost:3000`. Set `GUEST_APP_URL` to the deployed Guest
origin in production so the CMS preview and booking links cross to the correct app.

The admin sign-in is at `/admin/sign-in`. The local demo password is `staysphere`; set
`ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in `apps/pms/.dev.vars` for deployments. For the admin
assistant, `OPENAI_API_KEY` is optional; without it, the deterministic command interpreter is used.
See `TECH.md` for hosting, persistence, and sign-in details.

## What PMS serves

The `/admin` application provides the hotel overview, front desk, bookings, rates, accounting,
housekeeping, communications, guest records, settings, and CMS. CMS-managed rooms, rates, add-ons,
hotel copy, spinner frames, and spinner zones are returned to Guest through the public catalog API.

Guest-facing pages are not served from PMS. They live in `apps/guest`; their routes, booking flow,
and browser tests are documented in the [Guest README](../guest/README.md).

The public HTTP API includes catalog and media reads, quotes, booking creation, trip access,
assistant search, and guest conversations. PMS rechecks price and availability before confirming a
booking and requires an idempotency key for booking creation. The showcase API returns only
curated records for the fixed demo hotel.

## Architecture

```text
PMS route or admin component
  → application service
  → domain port
  → repository or adapter
```

`lib/application/container.ts` is the composition root and the only module that imports
`lib/infrastructure`. Guest is a separate HTTP client and must not import PMS implementation
modules. `apps/site`, `apps/pms`, and `apps/guest` have independent workspace dependencies,
commands, and deployments.

Payments and partner integrations are demo/mock implementations. PMS never collects raw card data.
Photography and panorama assets are stored locally and credited in `public/images/CREDITS.md`.

## Checks

Run app-scoped commands from the monorepo root when requested:

```bash
npm run typecheck:pms
npm run test:pms
npm run lint:pms
npm run build:pms
npm run check:docs:pms
npm run test:e2e:pms
```
