# 6. Spinner-markup zones: a CMS tab, stored beside — not inside — `Hotel.spinner`

**Status:** Decided and shipped (`/admin/content/spinner`, `lib/domain/spinner-markup.ts`,
`lib/infrastructure/spinner-markup-*.ts`, `components/admin/spinner-markup/`).

## Context

The building spinner (`Hotel.spinner`, `components/view-360/building-spinner/`) draws 160 baked
orbit frames and a handful of hand-authored hotspot markers, but a hotel team could not draw or
bind a single zone on it — every hotspot and its `keyframes` are static seed data in
`mock-data.ts`. The property wants a full markup pass: outline a room, a floor, or a facade band on
the frames a guest actually stops on, and bind each outline to the thing it should open.

A general-purpose polygon editor (points, rounded sides, undo/redo, autosave batching, a magnet to
close gaps between neighbours) already existed outside this repo, stripped of the domain it was
built for. Porting it faithfully — rather than writing a markup UI from scratch — is most of what
makes this pass tractable in one piece: `lib/domain/polygon/` and
`components/admin/spinner-markup/` are that port, retyped for this codebase and restyled to its
design tokens, but otherwise line-for-line the same maths and interaction model, with its own test
suite carried over.

## Decision

- **Zones only exist on a key-angle frame.** `Hotel.spinner.keyAngles` are the only frames a guest
  ever stops the orbit on; a zone anywhere else could never be shown. `saveSpinnerZones` in
  `content-service.ts` rejects a batch for any other frame index, and the guest-facing overlay
  (`SpinnerZonesOverlay`) never interpolates a zone's outline between frames the way a hotspot's
  `x`/`y` marker position does — a zone is visible, in full, only on the exact frame it was drawn
  on, invisible everywhere else including mid-turn (`orbit.isTurning`).
- **A free drag now settles on the nearest key angle** (`nearestKeyAngle` in `orbit.ts`,
  wired into `use-orbit.ts`'s `endDrag`). Before this, a guest could stop the building on any of
  160 frames; now every stop is one that can actually carry a zone, matching how a reference
  competitor's own viewer behaves (an arc snaps to its stops; a zone only exists on those stops).
  The arrow-key/button turn already only ever targeted `keyAngles` and is unaffected.
- **Storage is a new table, `spinner_zones`, not a `catalog_entries` overlay row.** Every other CMS
  entity is one versioned row per `(kind, id)`, replaced wholesale under optimistic concurrency
  (`docs/decisions/0001-d1-seed-overlay.md`). A zone doesn't fit that: the ported editor autosaves
  one polygon-sized batch at a time, there is no seed value a first edit could conflict with (zones
  start empty, drawn from scratch), and forcing a version number onto something with no prior
  value to version against would be ceremony with nothing behind it. `SpinnerMarkupPort` is instead
  a plain scoped upsert/delete — `applyZoneBatch(hotelId, {upserts, deletes})` — guarded only by
  `hotelId`, the same shape as the reference editor's own `saveBatch`/`schema.sql`.
- **A zone's target is a discriminated union** (`SpinnerZoneTarget` in `spinner-markup.ts`): a
  physical room (`unit`), a floor with an optional facade (`floor`), a room type directly
  (`roomType`), or a plain link (`link`). This was the open question going in — a hotel doesn't
  necessarily have same-facing room types stacked floor over floor, so "one zone → one room type"
  wasn't going to be enough on its own. All four are implemented; if one turns out unused in
  practice, removing it is one union arm, one segment in `ZoneTargetEditor`, and one branch in
  `CatalogService.resolveZoneTarget` and `SpinnerZonesOverlay`'s `labelFor` — not a schema
  migration, since existing rows with that `kind` just become unresolvable and are dropped the same
  way a zone bound to a since-deleted room already is.
- **A target is resolved, never trusted, at read time.** `CatalogService.getSpinnerZones` follows
  each zone's target through the *current* catalog — the same "never hand back raw seed/CMS data"
  rule `getHotel` already applies to hotspots and floor zones — and silently drops a zone whose
  target no longer resolves (a deleted unit, a hidden or deleted room type) rather than showing it
  broken. `ContentService.saveSpinnerZones` additionally rejects a *write* whose target doesn't
  exist yet, so a zone is never saved pointing at nothing by mistake; the read-time drop exists for
  what happens *after* a save, when something else in the catalog changes later.
- **Frame upload and key-angle editing** (`/admin/content/spinner/frames`) followed in the same
  pass, once R2 was wired up (`.openai/hosting.json`'s `r2` binding, previously `null`). The
  browser re-encodes every chosen file to WebP itself (`OffscreenCanvas`/`createImageBitmap`, no
  server-side image library) before uploading it — `ContentService.uploadSpinnerFrame` stores
  bytes through `SpinnerFrameStoragePort`, a small, indexed, R2-or-in-memory port shaped like
  `SpinnerMarkupPort`, keyed `spinner/<hotelId>/<frameSetId>/<NNN>.<ext>` and served back through
  the one public route this pass added, `app/media/[...path]/route.ts`. `Hotel.spinner` itself is
  still the same CMS-editable `hotel` overlay row every other Hotel Settings field already goes
  through (`ContentService.updateHotel`'s own `...current` spread has quietly kept it there since
  before this pass existed) — `updateSpinnerScene` is just a second writer of that one row, guarded
  by the same version.
- **Replacing the frames is destructive to what's drawn on them; changing which frames are key
  angles is not.** `updateSpinnerScene` tells the two apart by comparing the incoming frame
  URLs/dimensions against what's currently live: identical frames, only different `keyAngles`/
  `startFrame` → hotspots and zones are left alone (they only ever showed up on a key-angle frame
  in the first place, so removing a stop from `keyAngles` just makes that frame's markup
  unreachable, not wrong); a genuinely different set of frames → every hotspot (`sea-view`, the
  floor pins, …) and every zone is cleared, since both name frame indices from a sequence that no
  longer exists. `/admin/content/spinner/frames`'s own confirm dialog warns with the actual counts
  before a destructive replace goes through, and the previous frame set is swept from storage only
  after the new one is confirmed live.
- **`Hotel.spinner.startFrame`** is a new, optional field: which frame the orbit opens on absent a
  deep link, previously always "the lowest `keyAngles` value" by construction. `openingFrame` in
  `orbit.ts` now checks it between the `?unit=` arc and that fallback, so existing fixtures with no
  `startFrame` behave exactly as before.

## Consequences

- `components/view-360/building-spinner/spinner-zones-overlay.tsx` is additive: the existing
  hotspot markers (`sea-view`, `cove`, `city-view`, and the seed's `*-floor-N` pin markers) are
  untouched, still driven by `orbit.ts`'s `buildTrack`/`hotspotPosition` arc interpolation exactly
  as before. Zones are a second, independent layer, visible only on a key-angle frame, that will
  eventually replace those pin markers once a hotel has drawn real zones — but nothing forces that
  migration, and an empty zone table means the spinner behaves exactly as it did before this pass.
- `ContentService.resetContent()` now also clears `spinner_zones` and, if the current frames were
  an uploaded set rather than the seed's own, sweeps them from R2 too — so `/admin/reset` returns
  the spinner to its unmarked, un-uploaded state along with the rest of the demo catalog.
- The ported editor's three-column layout needs desktop width; `e2e/spinner-markup.spec.ts` is
  desktop-only for that reason, unlike the guest golden path's 1440/390 pair.
- Replacing the frames resets `hotspots` to `[]`. Nothing currently repopulates it: a hotel that
  uploads new frames loses the seed's hand-authored `sea-view`/`cove`/`city-view` markers for good
  and is left with zones as the only way to draw on the orbit — which is fine going forward
  (zones are the richer replacement) but is a one-way door worth knowing about before uploading a
  first real set.
- `MediaStoragePort` (`lib/domain/ports.ts`) is unrelated and still not implemented — it is the
  general media-library upload path (`/admin/media`'s disabled button), a separate future step.
  `SpinnerFrameStoragePort` only ever writes under the `spinner/` prefix; `app/media/[...path]/route.ts`
  enforces that prefix and is not a general file server.
- `e2e/spinner-frames.spec.ts` is desktop-only for the same layout reason, and covers uploading a
  smaller replacement set, the destructive-replace confirmation, and the new sequence reaching the
  guest orbit.
