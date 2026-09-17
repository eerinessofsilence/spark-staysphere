# SPARK StaySphere 360

White-label interactive hotel discovery and direct-booking platform. **See the stay. Book the room.**

The demo property is **Asteria Cove**, a fictional hotel with room types from studios to a
penthouse (see `lib/infrastructure/mock-data.ts` for the seed catalog). The guest journey runs end
to end: arrival → room search → room detail → services → guest details → demo payment →
confirmation, with a hotel-side back office at `/admin`.

## Quick start

Requires Node.js 22.13+.

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server. `npm run dev` runs against a real,
locally emulated D1 database (no Cloudflare account needed) — bookings, admin overrides, and CMS
edits made in `/admin` survive a restart. To start clean, delete `.wrangler/state`, or use
"Reset demo state" on `/admin/reset`.

**Optional — the AI room finder.** Without a key, search still answers through a deterministic
keyword interpreter and voice input is unavailable. To enable OpenAI interpretation and
transcription, put `OPENAI_API_KEY=sk-...` in a gitignored `.dev.vars` file at the repo root (not
`.env` — see `lib/infrastructure/cloudflare-env.ts`).

## Checks

CI (`.github/workflows/ci.yml`) runs all of these on every pull request — locally, run whichever
ones cover what you changed:

```bash
npm run typecheck
npm run test         # vitest: pure domain and application logic
npm run lint
npm run build
npm run check:docs   # fails if a doc names a file that no longer exists
npm run test:e2e     # Playwright golden path, 1440px and 390px
```

`npm run test:e2e` starts its own dev server on port 3100. The first run needs
`npx playwright install chromium`. The suite shares one dev server and one D1 database across
every spec (`workers: 1`), so a spec that reads "how many bookings exist" can see ones an earlier
spec made; the CMS and golden-path specs reset demo state at the start of their own runs.

## Routes

**Guest**

| Route | What it does |
|---|---|
| `/` | Arrival: the property area by area with hotspots into the catalog (a draggable building spinner over the facade), how it works, stay search |
| `/rooms` | Catalog: URL-driven dates, guests, budget, room type, view, beds, area, floor, amenities, sort, plus a floor plan to pick the exact room |
| `/rooms/[slug]` | Room detail: photo gallery with a draggable 360° tab and fullscreen, facts, add-ons, sticky server-quoted summary |
| `/book/[slug]` | Six-step booking: stay, room and rate, services, guest details, demo payment, review |
| `/booking/[reference]` | Confirmation: reference, dates, room, services, price breakdown |
| `/trips` | "My trips": bookings this browser remembers, plus claim-by-reference-and-email and self-service cancel |

**Back office** (`/admin`, server actions only — see TECH.md's "Back office")

| Route | What it does |
|---|---|
| `/admin` | Overview: tonight's occupancy, 14-night chart, arrivals/departures, recent bookings, integration status |
| `/admin/reset` | "Reset demo state" — not in the sidebar; for the demo owner and the e2e suite |
| `/admin/front-desk` | Rooms × nights, 7/14/30-night window, filter by room type |
| `/admin/bookings`, `/admin/bookings/[reference]` | Search, stay-bucket filters, booking detail, desk cancel |
| `/admin/rates` | Base nightly and OTA-comparison price per room type, availability override |
| `/admin/content` and its editors | The CMS: room types, rates, add-ons, and the hotel's own copy — no deploy needed |
| `/admin/settings`, `/admin/settings/team`, `/admin/integrations`, `/admin/media` | Labelled previews — brand settings, team roles, integration credentials, and media uploads are not yet wired to anything real |

**API** (the guest UI reaches quotes/bookings through server actions instead; these exist for external callers)

| Route | What it does |
|---|---|
| `POST /api/quotes` | Server-authoritative price and availability for a stay |
| `POST /api/bookings` | Creates a demo booking; requires an `Idempotency-Key` header |
| `GET /api/bookings/:reference?email=…` | Reads a booking; `email` must match the guest's own |
| `POST /api/assistant/search` | An utterance, interpreted into a filter object and priced through `CatalogService` |
| `POST /api/assistant/transcribe` | One audio recording, transcribed to plain text |

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

- Simulated demand (base occupancy without a real booking behind it) is deterministic, computed
  fresh on every read — there is nothing to reset there. Bookings, payment attempts, admin
  overrides, and inventory holds are **durable** (D1 locally and in production), so a demo booking
  survives a `npm run dev` restart. The room/rate/add-on **catalog** (names, prices, descriptions)
  stays static seed data — `/admin/content` edits are a durable overlay on top of it, never a
  change to the seed. See TECH.md's Persistence and "Content management (CMS)" sections.
- Payment is **demo only**. No card fields are rendered and no card data is collected.
- Photography is **licensed stock** from Unsplash standing in for the property's own, stored
  locally in `public/images` and credited in `public/images/CREDITS.md`. Nothing is hotlinked.
  The room gallery's 360° tab is a real draggable panorama (Pannellum, vendored at
  `public/vendor/pannellum`), but over a stand-in equirectangular photo, not the property's own
  tiles.
- Every adapter (PMS, channel manager, booking engine, payment, CRM) is a mock. `/admin/integrations`
  says so, and `/admin/settings`, `/admin/settings/team`, and `/admin/media` are labelled previews
  with nothing behind them yet.
- The AI room finder (the round control, bottom-right) interprets an utterance into a filter
  object — it never invents a room, a price, or availability, and every enum it may use is one the
  catalog already owns. With `OPENAI_API_KEY` set (see Quick start) it uses OpenAI for
  interpretation and transcription; unset, search still answers through a deterministic keyword
  interpreter and the mic is unavailable. See TECH.md's "AI concierge" section.

## Documentation map

New to this codebase? Start with `docs/ONBOARDING.md` — it's a five-minute path through the rest
of this, including a guided trace of one booking through every layer.

| Doc | For |
|---|---|
| `docs/ONBOARDING.md` | Day one: reading order, the mental model, a first change to make |
| `docs/ARCHITECTURE.md` | The layers, the four rules, a "where does X live" table |
| `docs/HOWTO.md` | Recipes: add a room type, a route, a rule with a test, an admin screen, an API route |
| `docs/GLOSSARY.md` | Domain terms (front desk, seed vs. overlay, stay bucket, hold, …) |
| `docs/TESTING.md` | Unit vs. e2e, and the e2e suite's shared-state quirks |
| `docs/TROUBLESHOOTING.md` | Traps this codebase has already hit |
| `TECH.md` | The deep technical reference — persistence, the CMS's concurrency model, the AI concierge, production integration, all with the *why* |
| `DESIGN_SYSTEM.md` | The design contract — read the **Rules** section before adding any UI |
| `AGENTS.md` | Working rules (commit conventions, what never to touch) |
| `CLAUDE.md` | Product intent and the implementation roadmap |
