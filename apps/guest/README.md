# StaySphere Guest

Guest is the public hotel discovery and direct-booking application. PMS owns hotel content, prices, availability, bookings, and guest records. Guest has no hotel-admin routes, D1 database, or R2 bucket; all live hotel data comes from the PMS API.

## Run locally

From the monorepo root:

    npm run dev:pms-guest

This starts PMS on port 3001 and Guest on port 3000 as separate Workers with separate local state. Guest reaches PMS through PMS_API_URL (defaults to http://localhost:3001). To start only Guest, run npm run dev:guest; set PMS_API_URL in .env.local or .dev.vars if needed.

## Guest routes

| Route | Purpose |
|---|---|
| / | Explore the hotel's arrival scene and rooms |
| /rooms, /rooms/[slug] | Search rooms, inspect details and the floor plan |
| /book/[slug] | Request a quote and place a demo booking through PMS |
| /booking/[reference] | View a booking confirmation with signed PMS access |
| /trips | Read saved trips, view the curated showcase, claim or cancel by reference and email |

There are no /admin routes here. Hotel staff use the PMS application for the back office and content management.

## Service boundary

Guest server components and actions call lib/application/pms-api.ts. The small app/api handlers are compatibility proxies for the booking UI and assistant. PMS validates prices, availability, booking requests, and access to confirmations. A regular booking is written only after the visitor submits the booking flow; loading a page is read-only. The public showcase is provisioned from the PMS back office and Guest only reads its curated demo records.

Guest must not import PMS repositories, composition roots, or infrastructure into public routes. Shared-looking domain shapes in lib/application/guest-contracts.ts describe HTTP payloads; they do not provide a local data source.

## Configuration and deployment

The only required server setting for a deployed Guest Worker is PMS_API_URL, pointing to the PMS origin. Guest does not provision or bind D1/R2 resources. The deployment script builds and deploys this stateless frontend; configure the Worker variable in its environment.

## Checks

Workspace scripts are available at the monorepo root: npm run typecheck:guest, npm run test:guest, npm run lint:guest, npm run build:guest, and npm run test:e2e:guest. Run them when requested and appropriate for the change.
