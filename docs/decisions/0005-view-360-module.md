# 5. The 360° views are one module with a single public entry

**Status:** Decided and shipped (`components/view-360/`, its README.md, and the
`no-restricted-imports` pattern in `.oxlintrc.json`).

## Context

The two 360° views — the building spinner on `/` and the panorama sphere in a room gallery — lived
in `components/hotel/` beside the arrival scene that happens to host one of them:

- `building-spinner.tsx` was one 816-line component doing everything at once: frame preloading,
  canvas drawing, drag and keyboard handling, stop animation, URL sync, hotspot interpolation, and
  two copies of the hotspot card (desk and phone).
- `panorama-viewer.tsx` mixed the library loader, DOM construction for markers, per-frame
  projection read-back and hit-testing in one effect.
- Helpers were duplicated across `hotel-scene.tsx` and the spinner: the cover-crop maths, the
  phone media query, the `ResizeObserver` stage size, the marker → card anchor measurement, the
  "carry the stay into this link" builder, the room fact chips, and two copies of the same
  `RoomFacts` type.
- Dependencies ran the wrong way: `components/rooms/room-gallery.tsx` imported from
  `components/hotel/`, and the spinner imported a hook from the scene's own folder.
- None of the orbit arithmetic had a unit test, because none of it could be called outside React.

## Decision

- **One folder, one entry.** `components/view-360/index.ts` exports `BuildingSpinner`,
  `PanoramaViewer` and their public types. Lint fails any import of a file inside the folder from
  outside it, so internals can change freely.
- **Split by responsibility.** Pure maths in `orbit.ts` and `sphere-geometry.ts` with unit tests;
  one hook per kind of state or side effect (`useFrameSequence`, `useCanvasFrame`, `useOrbit`,
  `useFrameUrlSync`); small components for marker, card, controls and overlays; the two top-level
  components only compose. Pannellum is confined to `pannellum.ts`.
- **Shared helpers moved down, not into the module.** What the arrival scene also needs went to
  `components/site/` (`cover-fit.ts`, `useElementSize`, `useMediaQuery`, `useAnchoredCard` +
  `useMarkerAnchor`), `components/rooms/room-facts.tsx`, and `withStayQuery` in
  `lib/application/search-params.ts`. The module depends on those; nothing it depends on depends
  on it.
- **Vitest also collects `components/**/*.test.ts`**, so a component module's pure logic is tested
  next to it.
- **Behaviour is unchanged**, apart from two fixes the split made obvious: the canvas no longer
  clears (and flashes the stage empty) when the next frame hasn't decoded yet, and a phone tap on
  a marker in the still-photo fallback now opens the sheet like it does on the live orbit.

## Why

Single responsibility and a stable interface are what make the views easy to hand over: the
README names the one file to change for each common task, the lint rule keeps consumers off the
internals, and the rules most likely to break (which frame, which stop, where a hotspot is, what
was clicked) are now covered by unit tests instead of living in effects.

## Why not the alternatives

- **A workspace package (`packages/view-360`):** real isolation, but a build step, a second
  `tsconfig`, and path aliases to maintain for a module with two consumers in one app. The lint
  boundary gets the same guarantee for free; promoting the folder to a package later is a move,
  not a rewrite.
- **Moving the maths into `lib/domain`:** `lib/domain` is business rules and contracts. Frame
  arithmetic and polygon hit-testing are presentation, and would read there as if the booking
  engine depended on them.
- **Splitting files but staying in `components/hotel/`:** leaves the room gallery importing from
  the arrival scene's folder, and gives no single place to document or enforce the boundary.
- **Moving the Zod schemas into the module:** every other contract lives in `lib/domain/schemas.ts`,
  and `CatalogService` filters `Hotel.spinner` server-side. The module re-uses the inferred types.

## Consequences

- New behaviour goes on the right side of the "pure function / hook / composing component" line;
  the README says which file owns what.
- A new consumer imports from `@/components/view-360` only. If it needs something that isn't
  exported, add it to `index.ts` deliberately rather than reaching past it.
- Anything that becomes useful outside 360° views (as `cover-fit.ts` did) moves down to
  `components/site/` or `components/rooms/` rather than being imported out of the module.
