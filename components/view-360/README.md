# 360° views — `components/view-360`

The product's two "turn it around" views, as one self-contained module. Everything a new
developer needs to change them is in this folder; this page is the map.

| View | Camera | Used by | Data it renders |
|---|---|---|---|
| `BuildingSpinner` | Orbits the **outside** of the building — a baked frame sequence you drag | The arrival stage on `/` (`components/hotel/hotel-scene.tsx`) | `Hotel.spinner` (`BuildingSpinnerData`) |
| `PanoramaViewer` | Looks around from one fixed point **inside** a place — an equirectangular sphere | The 360° tab of a room gallery (`components/rooms/room-gallery.tsx`) | A `RoomType.media` item with `type: '360'` |

Why the spinner is a baked sequence and not a live 3D scene: `SPINNER_SPEC.md`. Why this is a
module: `docs/decisions/0005-view-360-module.md`.

## Using it

```tsx
import { BuildingSpinner, PanoramaViewer } from '@/components/view-360';

<BuildingSpinner
  spinner={hotel.spinner}          // Hotel.spinner, already filtered by CatalogService
  zones={spinnerZones}             // GuestSpinnerZone[] from catalogService.getSpinnerZones — optional
  fallbackPhoto={area.photo}       // shown if the frames can't load
  title={area.name}
  stayQuery={stayQuery}            // the guest's dates, carried into every hotspot link
  rooms={roomFacts}                // RoomFacts by room slug — built by the page from catalog offers
  active                           // false for a hidden cross-fade layer
  initialFrame={40}                // optional deep link: /?frame=40
  focusHotspotId="sea-view"        // optional deep link: /?unit=<slug or hotspot id>
/>

<PanoramaViewer src="/images/panoramas/room.webp" title="Deluxe Sea View, 360°" className="absolute inset-0" />
```

**Only `index.ts` is public.** `.oxlintrc.json` fails `npm run lint` on any import of
`@/components/view-360/<something>` from outside the folder, so the files below can be split,
renamed or rewritten without touching a consumer. Inside the module, files import each other
relatively.

## What's inside

```
components/view-360/
├── index.ts                      public API — the only import path
├── building-spinner/
│   ├── building-spinner.tsx      composes the pieces below; no logic of its own
│   ├── orbit.ts                  pure maths: ring wrap, stops, hotspot tracks, opening frame, load order
│   ├── orbit.test.ts
│   ├── use-frame-sequence.ts     useFrameSequence (nearest-first preload, retry, error) + useCanvasFrame
│   ├── use-orbit.ts              the current frame and every way to turn it: drag, arrow keys, stop animation
│   ├── use-frame-url-sync.ts     keeps ?frame=N in the address bar
│   ├── spinner-marker.tsx        one storey's lens marker
│   ├── spinner-room-card.tsx     the desk card and the phone sheet body for a hotspot
│   ├── spinner-zones-overlay.tsx CMS-drawn zones (GuestSpinnerZone[]) — see below
│   └── turn-controls.tsx         the ink "‹ 360° ›" pill
└── panorama-viewer/
    ├── panorama-viewer.tsx       sphere lifecycle + outline hover/click
    ├── pannellum.ts              the only file that knows Pannellum exists (loader + types)
    ├── sphere-hotspots.ts        builds Pannellum hotspot configs: product-styled markers, outline corners
    ├── track-projected-shapes.ts per-frame read-back of projected corners and the open marker
    ├── sphere-overlay.tsx        outline SVG, loading/error placeholder
    ├── sphere-geometry.ts        pure: point-in-polygon, hit test, translate parsing, click vs drag
    ├── sphere-geometry.test.ts
    └── types.ts                  PanoramaHotSpot, PanoramaOutline, PanoramaApi
```

The rule the split follows: **arithmetic is a pure function with a unit test, a hook owns one
kind of state or side effect, a component only composes.** When you add behaviour, put it on the
same side of that line.

## Dependencies

The module depends only on shared, lower-level code — never on the screens that use it:

- `components/site/` — `Modal`, `useElementSize`, `useMediaQuery`, `useAnchoredCard`/`useMarkerAnchor`,
  `cover-fit.ts` (the `object-fit: cover` maths, shared with the arrival scene's flat photos)
- `components/rooms/room-facts.tsx` — the `RoomFacts` shape and the fact chips
- `lib/domain/schemas.ts` — `BuildingSpinnerData`, `SpinnerHotspot`, `SpinnerFrame` (Zod is the
  contract; the schemas stay there with every other schema)
- `lib/domain/polygon/geometry.ts` — `toPathData`/`centroid`, for drawing a zone's outline
- `lib/application/catalog-service.ts` — the `GuestSpinnerZone` type (`getSpinnerZones`'s resolved
  output; see `docs/decisions/0006-spinner-markup.md`), type-only
- `lib/application/search-params.ts` — `withStayQuery`
- `lib/formatting.ts`, `lib/ui.ts`, `lib/utils.ts`

It never imports `lib/infrastructure` (see ARCHITECTURE.md's rules), `components/hotel/`, or
`components/rooms/room-gallery.tsx`. It never computes a price: the nightly price in a marker is
the catalog offer's own, passed in through `rooms`.

## Rules that keep it working

1. **Frames go to one `<canvas>`**, never an `<img>` per frame — 160 full-size images would stay
   in the DOM after one turn. `useCanvasFrame` resizes the canvas only when the stage changes, so
   a frame still on its way leaves the last one showing instead of flashing empty.
2. **A press is not a drag until it crosses the threshold** (50px mouse, 8px touch). Pointer
   capture is taken only then — capturing on press retargets the click and kills taps on markers
   (docs/TROUBLESHOOTING.md) — and only then does it interrupt a turn the arrows started. A click
   on the stage mid-turn used to stop the animation where it was, leaving the orbit between stops.
3. **The stage is `touch-pan-y`**, not `touch-none`: it fills a phone's screen, and the page must
   still scroll past it.
4. **Failure is quiet.** If the opening frame fails twice, the spinner shows `fallbackPhoto` with
   the markers pinned front-on — no banner. The sphere paints its own loading/failure state
   (`placeholder`), in the product's words.
5. **A hotspot exists only across the frames where it faces the camera** — `keyframes` authored
   in sweep order (they may wrap through frame 0), interpolated by `hotspotPosition`. Positions
   are fractions of the frame, projected through the cover crop.
6. **A zone (`SpinnerZonesOverlay`, `zones` prop) exists only on the exact key-angle frame it was
   drawn on** — no interpolation, unlike a hotspot's marker position. `use-orbit.ts` settles a
   free drag onto the nearest key angle (`nearestKeyAngle`) for exactly this reason: it's the only
   way a guest reliably lands somewhere a zone can show. See
   `docs/decisions/0006-spinner-markup.md`.
7. **Pannellum is vendored** (`public/vendor/pannellum`) and loaded once per page from
   `pannellum.ts` — no CDN, no npm dependency. Its own controls are switched off.
8. **Deep links** — `app/page.tsx` reads `?frame=N` and `?unit=` and passes them in;
   `useFrameUrlSync` writes the frame back with `replaceState`, at most once per animation frame.
9. **Phone vs desk** — below `sm` (`PHONE_QUERY`) a hotspot opens the product's `Modal` sheet;
   from `sm` up, a card beside the marker, placed by `useAnchoredCard`.

## Common changes

**Replace the orbit with the property's own render.** Render and track outlines with the tools in
`scripts/` (scripts/README.md walks through it), commit the WebP frames to
`public/images/hotel/spin/`, then update `Hotel.spinner` in `lib/infrastructure/mock-data.ts` —
`frameCount`, `frameWidth`/`frameHeight` (every frame shares one framing), `frames`, `keyAngles`
(the stops the arrows jump between) and each hotspot's `keyframes` (regenerated into
`lib/infrastructure/spinner-outlines.ts` by `track-outlines.py`). No component change is needed.
Check at 1440px and 390px.

**Add or move a hotspot on the orbit.** An entry in `Hotel.spinner.hotspots`: `id`, `label`,
`description`, `href`, `cta`, optional `roomSlug` (adds the floor and price line, and is hidden
automatically when the CMS hides that room type — `CatalogService.getHotel`), and at least two
`keyframes`.

**Draw or rebind a zone.** No code change — `/admin/content/spinner/markup`, one tab per key-angle
frame. See `docs/decisions/0006-spinner-markup.md` and `components/admin/spinner-markup/`, the
ported polygon editor itself.

**Give a room a 360° view.** In the CMS, `/admin/content/rooms/[id]` → Photos and views → pick an
equirectangular (2:1) file from `public/images/panoramas`; `mediaTypeOf` makes it a `360` item and
`ContentService` refuses anything else. In the seed, `panoramaByRoom` in `mock-data.ts`. Credit
new files in `public/images/CREDITS.md`.

**Markers or traced outlines inside a sphere.** Already supported — `hotSpots`, `outlines`,
`litOutlines`, `onOutlineHover`/`onOutlineClick`, `activeHotSpotId` + `onActiveHotSpotRect` (to
hang a card with `useAnchoredCard`), and `apiRef.rotate()`. Nothing uses them today: the arrival
screen's sphere tour was retired when the spinner arrived. The data they would read is still in
the schema (`Hotspot.yaw`/`pitch`/`sphereOutline`, `HotelArea.panorama`/`panoramaView`).

**Swap the panorama library.** Replace `pannellum.ts`, and the calls `panorama-viewer.tsx` and
`sphere-hotspots.ts` make against its types. Nothing outside `panorama-viewer/` knows the library.

## Testing

- **Unit** (`npm run test`): `orbit.test.ts`, `sphere-geometry.test.ts`, and
  `components/site/cover-fit.test.ts`. Any new rule about frames, stops, hotspots or hit-testing
  belongs in one of those pure files, with a test beside it.
- **E2E** (`npm run test:e2e`, both 1440px and 390px) in `e2e/golden-path.spec.ts`: the arrival
  screen turns the building and a hotspot leads into the catalog; a `?frame=` deep link opens
  there and the turn controls move it; a room page opens its 360° view and returns to the photos.
  `e2e/spinner-markup.spec.ts` (desktop only — see its own note) covers drawing and binding a zone
  in the CMS and the same zone showing up on the guest orbit.
- **By hand, after any change to the spinner**: drag with a mouse and a finger; arrow keys and the
  turn buttons, including several quick presses; a tap on a marker opens its card (desk) or sheet
  (phone) while a drag starting on a marker still turns; the card stays on screen near every edge;
  `/?unit=deluxe-sea`; block `/images/hotel/spin/*` in devtools and reload — the still photo with
  its markers, no error.

## Known limitations

- The availability pill on the spinner's card uses fixed colours rather than theme tokens
  (`components/rooms/status-badge.tsx` is the tokenised equivalent). Kept so this module's
  extraction changed no visuals; aligning the two is a design decision.
- The orbit moves only while dragged or travelling between stops — no inertia after a flick and
  no idle rotation.
- A mounted `PanoramaViewer` given a new `src` rebuilds the sphere but does not show its loading
  state again; the gallery remounts it per tab, so this never shows today.
- Panoramas are stand-in captures of other places until the property is shot in 360 (roadmap
  step 8 in CLAUDE.md).
