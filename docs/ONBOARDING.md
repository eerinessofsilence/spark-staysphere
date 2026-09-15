# Onboarding

Your first day, start to end. Everything here links to a real file — when in doubt, the code is
the source of truth and this page is the map to it.

## Before you read anything else

1. Get it running: README.md's Quick start (`npm install`, `npm run dev`). You don't need an
   OpenAI key for anything in this guide.
2. Read this page.
3. Read ARCHITECTURE.md's "Four rules that don't bend". That's the whole architecture in four
   sentences; everything else is detail.
4. Read DESIGN_SYSTEM.md's **Rules** section (not the whole file yet) if you're touching UI at
   all. It exists because the first version of this product looked like a generic template, and
   the rules are what fixed that.

Everything past this point can wait until you need it.

## The product, in one paragraph

SPARK StaySphere 360 is a demo hotel booking site for a fictional property, Asteria Cove. A guest
arrives, turns the building, searches rooms, picks one (down to the exact physical room, if they
want), adds services, and completes a **demo** booking — no real payment, no real inventory. A
hotel team manages that demo inventory and edits the property's own copy from `/admin`, without a
deploy. Read CLAUDE.md for the fuller version and the roadmap.

## The one idea worth understanding before you touch code

**A route or a component never talks to data directly.** It calls an application service
(`lib/application/`), which is the only thing that knows the business rules, which talks to a
domain port (`lib/domain/ports.ts`), which is implemented by something in `lib/infrastructure/`
— and `lib/application/container.ts` is the *only* file allowed to import that infrastructure
layer. If you're about to write `hotelRepository.listRooms(...)` inside a component, stop: you
want a service method instead. See ARCHITECTURE.md for the full picture.

## Trace one booking, start to finish

This is the fastest way to see every layer actually work together. Follow a guest confirming a
booking on `/book/[slug]`, one hop at a time:

1. **The button.** `components/booking/booking-flow.tsx`'s review step calls `confirmBooking(...)`
   with everything the guest chose — room, dates, guests, add-ons, guest details, and the total
   *the guest saw on screen* (`expectedTotal`) plus an idempotency key generated once per attempt
   (`crypto.randomUUID()`, kept in a ref so a retry reuses it).
2. **The server action.** `app/book/[slug]/actions.ts`'s `confirmBooking` checks the idempotency
   key's shape, parses the whole input through `bookingRequestBodySchema` (Zod), and calls
   `confirmForSlug`.
3. **The shared intake.** `lib/application/booking-intake.ts`'s `confirmForSlug` resolves the room
   by slug, and — if the guest picked an exact room on the floor plan — checks that room is still
   free for the stay, before handing off to `BookingService.confirm`. This same function is what
   `POST /api/bookings` calls too, so a server action and an HTTP client can never disagree about
   what "confirm a booking" means.
4. **The business rules.** `BookingService.confirm` (`lib/application/booking-service.ts:277`) is
   where the actual guarantees live, in order: replay the idempotency key if it's been seen before
   (return the original booking, charge nothing twice); re-quote the stay on the server and refuse
   if the price the guest saw has moved (`price_changed`) or the room's gone (`unavailable`); hold
   the room with the (mock) booking engine; run the (demo) payment; and only then build and save
   the `Booking`.
5. **The port, and its two implementations.** `saveBooking` is a method on `HotelRepository`
   (really its `BookingStore` slice — see ARCHITECTURE.md). `lib/infrastructure/durable-hotel-repository.ts`
   picks one of two concrete implementations *at call time*: `d1-hotel-repository.ts`'s
   `saveBooking` if a D1 binding resolves, `mock-hotel-repository.ts`'s in-memory version if not.
   Both insert the booking, credit the room's inventory hold, and do it atomically with the same
   idempotency guarantee — see either file's own comments for exactly how.
6. **Back at the top.** The action returns `{ ok: true, reference }`, and the component navigates
   to `/booking/[reference]` — a fresh page load that reads the same booking straight back out of
   the repository.

Every step above is real code you can open right now. If you change one of the business rules in
step 4, that's the one function to change — not the route, not the component.

## Read next, in this order

1. **ARCHITECTURE.md** — the four layers, the four rules, and a "where does X live" table for
   when you're hunting for a specific piece.
2. **GLOSSARY.md** — skim it once so the domain terms (tape chart, seed vs. overlay, stay bucket,
   hold…) aren't new the first time you hit one in a comment.
3. **HOWTO.md** — recipes for the tasks you'll actually do first: add a room type, add a photo,
   add a route, add a rule with a test.
4. **TESTING.md** — when to write a unit test vs. an e2e spec, and the e2e suite's quirks.
5. **TROUBLESHOOTING.md** — a list of traps this codebase has already hit. Skim it now so it's
   familiar; come back to it when something behaves strangely.
6. **DESIGN_SYSTEM.md** and **TECH.md** in full, whenever you're doing UI work or want the deep
   technical reference (persistence, the CMS's concurrency model, the AI concierge, all with the
   *why*, not just the *what*).

## Your first change

A safe, real, non-trivial first PR that touches the stack without touching anything load-bearing:

**Add a new amenity icon.** `components/rooms/feature-icon.ts` maps an amenity's text (e.g.
"Rain shower") to a Phosphor icon and a flat tint, matched by regex against the name — order
matters, the narrowest rule has to come first (the file's own comment explains why). Every
amenity already in the seed catalog matches something, so to see the *un*matched case: open a
room in `/admin/content`, add a made-up amenity (e.g. "Turndown service") to its list, save, and
look at the room page — it renders with the fallback eye mark. Add a matching pattern and tint to
`feature-icon.ts`, save again, and watch it pick up the real icon. Small, visual, and it takes you
through a domain file, a design-system constraint (which icon set, which tint), and the CMS.

Once that's merged, a good second step is picking one item from HOWTO.md's "Add a domain rule with
a test" — `lib/domain/pricing.ts` and its test file are the easiest place in the codebase to write
a unit test with no mocks at all.
