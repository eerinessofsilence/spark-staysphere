# Glossary

Domain terms as this codebase uses them — some are industry-standard, some are specific to this
product. Each links to where it's actually defined.

**Add-on** — An extra a guest buys alongside the room: a service (spa, transfer) or dining. Can
have a `parentId` pointing at another add-on (a wine pairing offered only inside a dinner), one
level deep only. `lib/domain/schemas.ts`'s `addOnSchema`.

**Catalog** — The room types, rate plans, and add-ons a hotel sells. Its *baseline* is always
static seed data (`lib/infrastructure/mock-data.ts`); see **Overlay** for how `/admin/content`
edits it. Not the same as **Inventory** (which physical room is free on which night).

**Direct saving** — `quote.price.directSaving`: the difference between this product's total and
`ratePlan.otaComparisonPrice` (a partner-site price for the same stay), floored at zero. Demo-only
— never sourced from a live OTA. `lib/domain/pricing.ts`.

**Facade** (of the building) — `'sea' | 'town'`. Every room's view maps to one: sea and pool
rooms face the sea side, city and garden rooms the town side (`facadeOf`,
`lib/domain/room-units.ts`). Used to group rooms in the floor plan and the tape chart.

**Facets** — `CatalogFacets`: the set of filterable values (views, bed types, price range, …)
actually present in the current search results, computed fresh each search so a filter panel never
offers an option with zero matches. `lib/application/catalog-service.ts`.

**Hold** — Two different things with the same name, worth keeping straight:
- `BookingEngineAdapter.hold()` (`lib/domain/ports.ts`) is a **port method that today's mock
  adapter fakes** — it returns a `holdId`/`expiresAt` but doesn't actually reserve anything. A
  production booking-engine adapter would make this real.
- The **inventory hold** is the thing that actually blocks a room from being sold twice: a row in
  D1's `inventory_holds` table, credited when a booking is *saved* as confirmed
  (`saveBooking` in `d1-hotel-repository.ts`/`mock-hotel-repository.ts`), and released when the
  booking is cancelled. This is the one that matters for availability.

**Idempotency key** — A client-generated string sent with a booking attempt
(`ConfirmBookingInput.idempotencyKey`). Replaying the same key returns the original booking
instead of creating or charging a second one — see `BookingService.confirm`'s first check, and
ONBOARDING.md's booking trace. `POST /api/bookings` requires it as the `Idempotency-Key` header,
at least 8 characters.

**Offer** (`RoomOffer`) — A room type presented for sale: the room, its rate plan, live status
and remaining count, and a priced breakdown, all resolved together by `CatalogService`. What the
catalog and room-detail pages actually render.

**OTA comparison price** — `ratePlan.otaComparisonPrice`, a demo stand-in for what a partner
site would charge for the same stay. Feeds **Direct saving**. Never a real, live scraped price —
see AGENTS.md's "no scraping" rule.

**Overlay** — What `/admin/content` actually writes: one row per edited entity in D1's
`catalog_entries` table (`kind`, `id`, `data`, `version`), never a change to the seed file. A row
whose id the seed already has replaces that entity when read; a new id is a new entity.
`mergeCatalog` (`lib/domain/catalog-overlay.ts`) is the pure function that combines seed + overlay
into what a read actually returns. See ARCHITECTURE.md's diagram.

**Quote** — A priced, availability-checked answer to "what would this stay cost right now,"
returned by `BookingEngineAdapter.quote()` and re-derived server-side at every step (search,
detail page, booking review, and again right before confirming) so a client-supplied total is
never trusted.

**Room type vs. room (unit)** — A **room type** (`RoomType`) is what's sold: "Deluxe Sea View," a
name, a view, a capacity, amenities, a gallery. A **room** (`PhysicalRoom`, a CMS entity of kind
`unit`) is one physical door with a stored number, e.g. `304` — its floor is read off the number
(`floorOf`). A type sells exactly as many rooms a night as it has stored rooms; hotel teams add,
renumber and remove them under `/admin/content/units`, and the demo seed lays them out with
`layOutRooms` (`lib/domain/room-units.ts`). `buildRoomUnits` turns stored rooms into the `RoomUnit`s
the allocator works with. The catalog sells room types; the floor plan and the tape chart show rooms.

**Room zone** — A traced outline on one of the arrival page's flat photo areas (e.g. the pool
photo), stored as fractions of the photo, mapped to a room slug — `HotelArea.roomZones`
(`lib/domain/schemas.ts`). Different from a **spinner hotspot**, which is the equivalent idea for
the *building spinner* (the draggable orbit), traced per-frame instead of on one static photo.

**Seed** — The static room/rate/add-on data in `lib/infrastructure/mock-data.ts`. Never mutated at
runtime by anything, including the CMS — see **Overlay**.

**Spinner hotspot / key angles** — `BuildingSpinnerData.hotspots`: a marker on the building
spinner (the draggable 160-frame orbit on `/`), which only "exists" across the sub-range of frames
where the thing it names actually faces the camera — tracked per frame via `keyframes`.
`keyAngles` are the specific frames the prev/next arrows jump between (front, side, back, side —
not an even quarter-turn, picked by hand to match the property's actual footprint). The maths is
`components/view-360/building-spinner/orbit.ts`; see that module's README.md for the mechanic and
SPINNER_SPEC.md's decision log for why.

**360° views** — The two views in `components/view-360/`: the **building spinner**
(`BuildingSpinner`, orbiting the outside) and the **panorama sphere** (`PanoramaViewer`, looking
around from inside a room, from a `media` item of `type: '360'`). One module, imported only
through its `index.ts`.

**Stay bucket** — Where a booking sits relative to today: `'upcoming' | 'in_house' | 'past' |
'cancelled'` (`stayBucket`, `lib/domain/availability.ts`). Shared by the guest's "My trips" list
and the admin bookings list, so the two screens can't disagree about whether a stay still counts
as upcoming.

**Tape chart** — The PMS-style view at `/admin/tape-chart`: one row per physical room, one column
per night, showing a real booking, simulated demand, or a closure. `InventoryService.getTapeChart`
(`lib/application/inventory-service.ts`); each cell is a `TapeChartSegment` with `kind: 'booking' |
'demand' | 'closed'`.

**Simulated demand / demand filler** — Baseline occupancy with no real booking behind it, there so
the demo doesn't read as an empty hotel. Deterministic (hashed from the room and date, not random)
and computed fresh on every read — nothing to reset. `allocateRoomType`
(`lib/domain/room-units.ts`) fills it into the lowest-ranked free rooms after real bookings are
placed; it's rendered as `kind: 'demand'` on the tape chart (or `'closed'` when an admin override
is behind it) and always labelled as simulated wherever it's shown.

**Unit number** — The specific room a guest picked on the floor plan, e.g. `"402"`
(`Booking.unitNumber`). Optional — most bookings don't name one, and get an automatically
allocated room instead (see `allocateRoomType`). Checked free for the whole stay before a booking
with one is confirmed.
