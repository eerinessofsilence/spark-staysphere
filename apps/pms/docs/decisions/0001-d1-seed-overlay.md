# 1. D1 for durable state; the catalog stays seed data with a CMS overlay

**Status:** Decided and shipped (`lib/infrastructure/durable-hotel-repository.ts`,
`d1-schema.ts`, `catalog-overlay.ts`).

## Context

This is a demo product with no real backend yet: no production PMS, no real database
provisioning story. Bookings, payment attempts, admin overrides, and CMS edits still need to
survive a server restart and be shared across isolates, or the demo resets itself constantly and
can't be trusted for a walkthrough. At the same time, the room/rate/add-on catalog is seed data
maintained by hand in `mock-data.ts` — hand-tuned demo content, not something that should silently
mutate.

## Decision

- **D1** (Cloudflare's SQLite), resolved through a binding at call time (never cached at module
  scope — an `env` binding is only reliable once a request is in flight), with an in-memory
  fallback of the same shape when no binding resolves. Locally, this runs against a real,
  Miniflare-emulated D1 database with no Cloudflare account needed — see README's Quick start.
- **No migration runner.** Schema is idempotent `CREATE TABLE IF NOT EXISTS` DDL, applied once per
  isolate the first time any D1 function runs. Quoting `d1-schema.ts`'s own reasoning: "idempotent
  DDL is cheap enough to run on first use rather than requiring a separate `wrangler d1 migrations`
  step." The trade-off this accepts: adding a column later means a new table and a read-time
  merge, not an `ALTER TABLE` — which is exactly what happened for `booking_units` (see
  TECH.md's "Physical rooms" section).
- **The catalog's baseline never lives in a table it's mutated through.** `mock-data.ts` stays the
  seed; `/admin/content` writes go to one D1 table, `catalog_entries (kind, id, data, version)`,
  and `mergeCatalog` (`lib/domain/catalog-overlay.ts`) is the one pure function both backends call
  to combine seed + overlay into what a read returns. "Reset demo state" just clears that table.

## Why not the alternatives

- **A real Postgres/Redis backend now:** no production PMS to sync against yet, and this is a
  demo — the durability need is "survives a restart, shared across isolates," which D1 already
  gives for free with the platform this ships on.
- **Migrations from day one:** with no other backend to coordinate against and a schema that's
  still moving, `CREATE TABLE IF NOT EXISTS` plus additive new tables costs less than standing up
  and maintaining a migration tool for a demo. Revisit if the schema needs a destructive change
  (renaming or dropping a column) — that's the point where "no migration runner" stops being free.
- **Writing CMS edits into the same rows as the seed:** would make "what does a hotel actually see
  by default" unrecoverable without a second copy of the seed kept somewhere else. The overlay
  keeps the seed inspectable and the reset trivial.

## Consequences

- Every repository function resolves its D1 binding fresh, which is more verbose than a
  module-level client but is what correctness requires here (see TROUBLESHOOTING.md's `env`
  binding trap).
- A destructive schema change (not just an addition) has no tooling support yet and would need one
  before this stops being a demo.
- See `docs/decisions/0004-hotel-repository-port-slices.md` for how the read/write surface built on
  top of this is organized.
