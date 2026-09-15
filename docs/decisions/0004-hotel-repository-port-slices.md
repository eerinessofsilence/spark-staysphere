# 4. Split `HotelRepository` into four narrower interfaces

**Status:** Decided and shipped (`lib/domain/ports.ts`; see git history for the refactor commit,
"refactor: split HotelRepository so each service declares its own slice").

## Context

`HotelRepository` had grown to twelve methods covering four unrelated concerns: catalog reads
(`getHotel`, `listRooms`, `listRatePlans`, `listAddOns`), availability (`getAvailability`),
bookings (`findBookingByIdempotencyKey`, `saveBooking`, `getBookingByReference`, `cancelBooking`,
`listBookings`), and payment attempts (`savePaymentAttempt`, `listPaymentAttempts`). Every service
that took one as a constructor parameter — `CatalogService`, `ContentService`, `InventoryService`,
`BookingService` — declared the *whole* interface even though each one only ever called a subset
of it, so the constructor signature said nothing true about what the service actually depended on.

## Decision

Split into four interfaces — `CatalogReader`, `AvailabilityReader`, `BookingStore`,
`PaymentAttemptStore` — with `HotelRepository` now `extends`-ing all four (structurally identical
to before; every concrete backend, D1 or in-memory, still implements all four with no code
change). Each service's constructor now declares the intersection it actually calls, checked
method-by-method against its own source:

- `CatalogService`: `CatalogReader & AvailabilityReader`
- `ContentService`: `CatalogReader & Pick<BookingStore, 'listBookings'>`
- `InventoryService`: `AvailabilityReader & Pick<CatalogReader, 'listRooms'> &
  Pick<BookingStore, 'listBookings'>`
- `BookingService`: `Pick<CatalogReader, 'listAddOns' | 'listRatePlans' | 'listRooms'> &
  BookingStore & PaymentAttemptStore`

`container.ts` wires the same `durableHotelRepository` into all four — nothing changes about what
object is passed, only what each constructor's declared type says it may call.

## Why

Interface Segregation: a service depending on the whole read/write surface of the app's durable
state, when it only reads the catalog, makes that dependency invisible in the type system — a
reviewer (or an agent) reading `ContentService`'s constructor couldn't tell from the signature
alone that it never touches bookings or payments. Splitting the port makes the dependency the
signature actually claims.

## Why not the alternatives

- **One interface per service, hand-named:** would mean four bespoke interfaces with overlapping
  members (`ContentService` and `BookingService` both need catalog reads) instead of four small,
  composable ones — more interfaces to maintain for less reuse.
- **Leave it as one interface and rely on code review to catch scope creep:** the whole point of
  a type system is to make this check automatic; asking a human to notice a new
  `this.repository.cancelBooking(...)` call creeping into `ContentService` is strictly worse than
  the compiler refusing to let it typecheck.

## Consequences

- A new method on `HotelRepository` now has to be added to the right one of the four interfaces,
  not just the top level — a small extra decision at the point of adding it, in exchange for every
  existing service's dependency staying accurate without anyone having to update it.
- This is a compile-time-only change: it doesn't fix `app/admin/page.tsx` and a few other pages
  that still call the raw exported `hotelRepository`/`demoControl` from `container.ts` directly
  instead of going through a service — a separate, still-open issue this decision doesn't address.
