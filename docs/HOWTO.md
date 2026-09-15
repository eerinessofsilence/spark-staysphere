# How-to

Recipes for the tasks you'll most likely do first. Each one names the real files involved — read
ARCHITECTURE.md's "where does X live" table if you get lost.

## Add a room type

Two ways, and they end up in the same place (both read back through `mergeCatalog`, see
ARCHITECTURE.md), but they're for different purposes.

**Through the CMS (`/admin/content/rooms/new`) — for a demo-time edit, no deploy.** Fill in the
form; `ContentService.createRoom` (`lib/application/content-service.ts`) validates it and picks a
kebab-case id from the name. The new room type starts **hidden** — it needs at least one room
(added under `/admin/content/units`), one photo and one rate before it can go on the site (its own
page shows a checklist of what's missing). This writes one row to the D1 `catalog_entries`
overlay table; the seed file is never touched.

**In the seed (`lib/infrastructure/mock-data.ts`) — for a permanent addition to the demo.** Add an
entry to the `roomSeed: RoomSeed[]` array (near the top of the room section):

```ts
{
  slug: 'garden-loft',
  name: 'Garden Loft',
  areaM2: 34,
  floor: 2,
  capacity: 3,
  bedType: 'queen',
  view: 'garden',
  nightlyPrice: 210,
  description: '...',
  amenities: ['Private balcony', 'Espresso machine'],
  photos: [{ file: 'bedroom', label: 'Bedroom', width: 1600, height: 1067 }],
}
```

`demoRooms`/`demoRates` are both built from this array with `.map(...)` right below it — a room
type and a `Direct Flexible` rate plan are created together, `id`s and `roomTypeId` derived from
the slug. Three things to know:

- **Photos.** `photos[].file` must exist at `public/images/rooms/<slug>/<file>.webp` (or set
  `from: 'another-slug'` to borrow that room's folder — see "Add a photo" below and the comment on
  `RoomSeed` for why that's normal here).
- **Physical room count.** How many doors this room type has in the seed comes from
  `seedRoomCounts` in `lib/infrastructure/mock-data.ts` — add an entry there, or it gets 5.
- **No manual numbering in the seed.** `demoPhysicalRooms` lays the rooms out with `layOutRooms`
  (`lib/domain/room-units.ts`): floor by floor, sea facade first. After that, numbers are stored —
  hotel teams renumber, add and remove rooms under `/admin/content/units`.

## Add a photo

1. Drop the WebP file in `public/images/<area>/...` (rooms go under `rooms/<slug>/`).
2. Run `npm run generate:media-manifest`. This reads every file under `public/images/**` (except
   the spinner's own orbit frames) and rewrites `lib/infrastructure/media-manifest.generated.json`
   — width/height are parsed out of the WebP's own header bytes, no image library involved. This
   file is committed; the CMS's media picker never touches the filesystem at request time.
3. Add a line to `public/images/CREDITS.md` — every photograph in this product is licensed stock
   standing in for the property's own, and every one is credited. Nothing is hotlinked.
4. Use it: through the CMS's media picker (an existing room or add-on's photo/media field), or by
   referencing the path directly in a seed entry (see "Add a room type" above).

## Change a 360° view

The building spinner on `/` and the panorama sphere in a room gallery are one module,
`components/view-360/`. Its README.md has the recipes — replace the orbit with the property's own
render, add or move a hotspot, give a room a sphere, swap the panorama library — plus the rules that
keep the views working and the by-hand checks to run afterwards. Two things to know before opening
it:

- Import only from `@/components/view-360`. `npm run lint` fails on a path into the folder.
- A new rule about frames, stops, hotspots or hit-testing goes in `orbit.ts` or
  `sphere-geometry.ts` with a unit test beside it, not into a component or an effect.

## Add a guest route

A guest route is a Server Component in `app/`; it fetches through a service, never a repository
directly. Look at `app/rooms/[slug]/page.tsx` as a working example: it calls `catalogService`
(from `lib/application/container.ts`) for data, and any interactive piece (a form, a picker) is a
separate Client Component it imports. If the route needs a mutation, it's a server action in a
neighbouring `actions.ts` with `'use server'` at the top (see `app/book/[slug]/actions.ts`) — not
a new API route; see AGENTS.md's "back office is server actions only" rule, which applies to guest
routes too outside the four existing `app/api/*` handlers.

## Add a server action

1. In the route's own `actions.ts`, add `'use server'` at the top if the file doesn't have it yet.
2. Parse the input through a Zod schema — reuse one from `lib/domain/schemas.ts` if the shape
   already exists there (see TECH.md and this session's own history for why: the party-size
   limits used to be copied in four places before they were unified onto one schema).
3. Call an application service; never touch `lib/infrastructure` or a repository directly (the
   `container.ts` rule — see ARCHITECTURE.md).
4. Map the result to whatever shape the UI needs, reusing `mapBookingError`
   (`app/api/_lib/http.ts`) if the service can throw a `BookingError` or a not-found error — see
   "Add an API route" below for its exact shape.
5. If the write should be visible on other pages without a client refetch, call `revalidatePath`
   for each affected route (see any existing `actions.ts` in `app/admin/**` for the pattern).

## Add a domain rule, with a test

Business rules that don't need a mock (pure functions of their input) belong in `lib/domain/`, and
they're the easiest thing in this codebase to unit-test — no repository, no server, nothing to set
up.

1. Write the function in the relevant domain file (`pricing.ts`, `availability.ts`, `room-units.ts`,
   `booking.ts`, `dates.ts`, or a new one if it's a genuinely new concern).
2. Write `<file>.test.ts` next to it. `lib/domain/pricing.test.ts` is a good template — it builds
   small fixtures (`ratePlan()`, `addOn()` helper functions) and asserts exact numbers, not just
   "changed" or "didn't throw".
3. `npm run test` runs the whole `lib/domain/**/*.test.ts` suite via vitest (config:
   `vitest.config.ts`, deliberately separate from `vite.config.ts` — see TESTING.md for why).
4. If the rule also needs to be reachable from a service, call it from `lib/application/` — the
   application layer is where the rule gets *used*, `lib/domain` is where it's *defined*.

If a rule genuinely needs external state (today's date, a random id), don't reach for `new Date()`
or `crypto.randomUUID()` directly inside the rule if you want it unit-testable — see how
`BookingService`/`ContentService` take an optional `Clock` (`lib/domain/ports.ts`,
`lib/domain/clock.ts`) defaulting to the real one, so a test can pass a fixed date instead.

## Add an admin screen

1. Add the route under `app/admin/` — `app/admin/rates/page.tsx` is a reasonably sized example
   that both reads and writes.
2. Wrap it in `AdminPage`/`AdminPageHeader` (`components/admin/shell/admin-page.tsx`) — every
   admin screen uses these for consistent chrome.
3. Register it in the sidebar: add a `{ href, label, icon }` entry to the right group (`Operations`
   or `Content`) in `components/admin/shell/admin-nav.tsx`. A route that exists but isn't in this
   file is only reachable by typing the URL — that's a real, current state for four routes
   (`/admin/settings`, `/admin/settings/team`, `/admin/integrations`, `/admin/media`); don't add a
   fifth by accident.
4. If the screen shows data with nothing real behind it yet, say so visibly in the page header's
   `actions` (a `tag()` reading "Preview" or similar) — DESIGN_SYSTEM.md's back-office section is
   explicit that this can't be a footnote.
5. Writes go through a service via a server action in the route's own `actions.ts` — see "Add a
   server action" above. No new API route for back-office data.

## Add an API route

Only `app/api/quotes`, `app/api/bookings`, and `app/api/assistant/*` exist today, and the back
office deliberately has none — see AGENTS.md. If you do need one (an external caller that isn't
this app's own UI), reuse the shared helpers in `app/api/_lib/http.ts` rather than writing the
parse/validate/error-map sequence again:

```ts
import { parseJsonBody, toBookingErrorResponse } from '../_lib/http';

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseJsonBody(request, yourRequestSchema, 'The request is not valid.');
  if (!parsed.ok) return parsed.response;

  try {
    return Response.json({ result: await yourService.doTheThing(parsed.data) });
  } catch (error) {
    return toBookingErrorResponse(error, 'Your route failed', 'Could not do the thing.');
  }
}
```

`toBookingErrorResponse` maps `RoomNotFoundError`/`HotelNotFoundError` to 404 and every
`BookingErrorCode` to its status (409 for `unavailable`/`price_changed`, 402 for
`payment_declined`, 404 for `not_found`, 400 otherwise) — see `app/api/quotes/route.ts` and
`app/api/bookings/route.ts` for two working examples of the whole pattern.
