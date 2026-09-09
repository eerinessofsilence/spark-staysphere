# Building spinner — implementation spec (handoff)

Status: **decided**. Scope and architecture were settled via a structured interview with the
product owner (2026-09-06) — see the Decision log at the bottom. Two steps remain before an
implementing agent (e.g. Codex) can write the component itself: picking a specific 3D asset and
provisioning Blender locally. See "Next steps." Update `TECH.md`'s Photography and media section
once this ships — it currently states "There is no 3D scene" and that's true until this lands.

## Why this document exists

We compared SPARK StaySphere 360's arrival page against a reference product (a real-estate
presale SaaS, domain pattern `*.in.qubehub.ai/spinner/view/:id?frame=N&unit=M`) that shows guests
a draggable exterior "spin" view of the building with hotspots pinned to specific floors/units,
each carrying a live price. We don't have that; our arrival page is a flat cross-faded photo.

**Caveat on the reference**: qubehub.ai's pages are a client-rendered SPA — fetching them returns
an empty shell, so the exact internals (frame count, whether it's a baked image sequence or a
live WebGL orbit) could not be inspected directly. Everything about the reference's mechanics is
inferred from the URL parameters (`frame=0..100` as a discrete step index, `unit=11` as a deep
link to one hotspot) and from screenshots the product owner captured on a phone. The decisions
below don't depend on confirming those details — they were made against this project's own
constraints (budget, staffing, prior history), not against a verified copy of the reference.

## Important prior art — read before writing any 3D code

`TECH.md`'s Photography and media section says:

> There is no 3D scene. The earlier procedural React Three Fiber massing and SVG interiors were
> removed as schematic; a real GLB or 360 tile set, if it ever exists, slots into the same
> `HotelArea`/`media` records without a UI rewrite.

Confirmed from git history: that scene (`components/hotel/resort-canvas.tsx`) was added in commit
`8344643` and removed in the very next commit, `2e8ed56`, one day later — explicitly because it
read as "schematic": it was 100% procedural primitive geometry (boxes, cylinders, cones), never a
real modeled asset. No `.glb`/`.gltf`/`.fbx`/`.obj` has ever existed in this repository, and no
3D/WebGL dependency exists in `package.json` today. There is nothing to reuse — this is a clean
start, and the mandatory review gate below exists specifically so this doesn't repeat that
one-day round trip.

## Current state

- `/` renders `HotelScene` (`components/hotel/hotel-scene.tsx`): a flat cross-faded photo stack
  across four zones — facade/roof/cove, pool, spa, reception/arrivals
  (`lib/infrastructure/mock-data.ts`'s `hotelAreas`). Hotspots are positioned by `{x, y}` fraction
  and projected through the same `object-fit: cover` math the browser applies
  (`hotel-scene.tsx`'s `projectOnto()`/`positionFor()`). No drag, no rotation, no camera.
- Hotspots that reference a room (`roomSlug` set) already show a real price line via
  `roomLine()`, sourced from a `RoomFacts` prop keyed by slug (nightly rate + floor) — **reuse
  this price path**, don't build a second one.
- `components/hotel/panorama-viewer.tsx` is a real drag-to-look-around 360° sphere (Pannellum),
  but it's inside-out — the guest stands inside a room and looks around. It's mounted only in
  `components/rooms/room-gallery.tsx` for room interiors. This is the opposite camera model from
  an outside-in building orbit; don't try to reuse the Pannellum sphere for this feature. Its
  load-failure fallback pattern (a `Warning` icon state) is the one thing worth copying — see
  Fallback behavior below.
- `lib/domain/pricing.ts`'s `buildPriceBreakdown` is the only function allowed to produce a total
  anywhere in the product. The spinner's hotspot price is the existing base-rate display, not a
  new pricing computation.

## Target mechanic

New component: `components/hotel/building-spinner.tsx` (client component), replacing the
**facade/roof/cove zone only** within `HotelScene` — pool, spa, and reception/arrivals keep their
existing flat-photo treatment untouched. This is the smallest correct scope: those three zones are
different physical locations, not "the building exterior," so there's nothing to orbit around.

- **Rotation**: full 360°, continuous. Pointer drag (mouse + touch) advances/retreats a
  `frameIndex` in `[0, frameCount - 1]`, wrapping at both ends. On-screen `←`/`→` buttons and
  left/right arrow keys do the same, matching the reference's on-screen controls and the keyboard
  support `panorama-viewer.tsx` already has for its own drag interaction.
- **Frames**: 48–72 stills (exact count set when the render is tuned against the ~5–8 MB total
  weight budget — see Asset path), each mapped to `/images/hotel/spin/frame-{index}.webp`.
- **Hotspots**: every hotspot that lives in the facade zone today carries into the spinner —
  `sea-view`, `roof`, and `cove` — with no filtering by whether it has a `roomSlug`. `sea-view` and
  `roof` keep showing a live price line via the existing `roomLine()`/`RoomFacts` path; `cove`
  keeps its plain label, exactly as today. Each hotspot is visible only across the sub-range of
  frames where it actually faces the camera — there is no keyframe data for the frames where a
  hotspot is on the far side of the building.
- **Deep link**: `/?frame=N&unit=<roomSlug>` opens the spinner already turned to a frame where
  that hotspot is visible, read via URL search params in `app/page.tsx` the same way `/rooms`
  already reads its filters from the URL.
- **Hotspot click** still routes to `/rooms/[slug]`, same as today's `HotelScene` hotspots.

## Fallback behavior (required, not optional)

If the frame sequence fails to load, or performance is unacceptable on a given device/connection,
silently fall back to the current flat photo for the facade zone — the same graceful-degradation
pattern `panorama-viewer.tsx` already uses for its own failure case. No error banner, no broken
state: a guest who never sees the spinner work should just see the photo StaySphere already shows
today.

## Data model additions

Add to `lib/domain/schemas.ts` (Zod, matching existing style):

```ts
const spinnerFrameSchema = z.object({
  index: z.number().int().nonnegative(),
  imageUrl: z.string(),
});

const spinnerHotspotKeyframeSchema = z.object({
  frameIndex: z.number().int().nonnegative(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const spinnerHotspotSchema = z.object({
  id: z.string(),
  roomSlug: z.string().nullable(),
  label: z.string(),
  // Only the frames where this hotspot actually faces the camera — not the full frame range.
  keyframes: z.array(spinnerHotspotKeyframeSchema).min(2),
});

const buildingSpinnerSchema = z.object({
  frameCount: z.number().int().positive(),
  frames: z.array(spinnerFrameSchema),
  hotspots: z.array(spinnerHotspotSchema),
});
```

Add `spinner: buildingSpinnerSchema.optional()` to the `Hotel` schema (optional so this ships
without touching every existing `Hotel` fixture at once). Seed it in
`lib/infrastructure/mock-data.ts` next to `hotelAreas`. This is catalog/presentation data — it
stays static seed data in every backend, same rule as rooms/rates/add-ons; it must never be
written through `HotelRepository`'s durable path.

## Asset path — decided: A (baked frame sequence)

Path B (real-time Three.js + GLB orbit) was considered and rejected: under the no-budget/no-3D-
artist constraint this project settled on, it doesn't reduce agent effort over A — it trades a
render pipeline for a new runtime dependency, a WebGL failure surface, and mobile performance risk
that would need its own testing. Path A wins under these specific constraints.

**Asset sourcing was revised after the initial free-stock plan failed a reality check.** The
product owner's actual quality bar — reference images at `/Users/eeri/Downloads/references`, a
curved-facade coastal resort at commissioned-archviz quality (V-Ray/Corona-level render, full
landscaping, a matching wireframe/line-art sheet) — sits far above anything the free-stock
marketplaces turned up (Sketchfab/CGTrader/Poly Pizza candidates were generic, blocky, or
game-asset-styled; see chat history for the specific listings checked). A real archviz commission
was ruled out on budget. The accepted middle path is **AI image-to-3D generation**, not a stock
download.

Pipeline:

1. **Generate 2–3 candidate models via an AI image-to-3D tool** (Meshy, Tripo3D, Luma Genie, or
   Rodin — pick whichever has a usable free/trial tier; this needs an account, and likely credits,
   on whichever tool is chosen) using the reference images at `/Users/eeri/Downloads/references`
   as style/shape input. **This is a pre-implementation checkpoint with the product owner, not
   something Codex decides on its own** — see "Next steps," step 1. Known, accepted risk: AI-
   generated architectural geometry is unreliable (uneven wall heights, messy topology, blurred
   facade detail) — this was a deliberate quality/cost tradeoff, not an oversight, and it's exactly
   what the mandatory review gate below exists to catch.
2. **Import into Blender and batch-render headless**: `blender --background --python
   scripts/render-spinner.py`. The script sets up a camera orbiting the building at a fixed
   height/distance and renders 48–72 frames (tune the count against the ~5–8 MB total weight
   budget; go with fewer, larger frames only if the resulting drag feels choppy — don't
   over-render by default).
3. **Export as WebP** into `public/images/hotel/spin/`, committed as static assets like every
   other photograph in this project. This runs once (or again only if the source asset changes) —
   it is not part of `npm run dev`/`npm run build`.
4. **Hand-place hotspot keyframes** (`{x, y}` per visible frame range) for `sea-view`, `roof`, and
   `cove` by inspecting the rendered frames.

Blender must be installed locally to run step 2 — confirmed not present in this environment
(`which blender` returns nothing, no Homebrew formula/cask installed). Install via
`brew install --cask blender`. It is a one-time authoring dependency: nothing in `package.json` or
the deployed bundle needs Blender at runtime.

## Mandatory visual review gate

Before this ships — after rendering, before merge, in addition to the asset-selection checkpoint
in "Next steps" — a human must look at the actual rendered 360° result. If it reads as a generic
or game-asset-looking building rather than a premium resort, **the correct outcome is to abandon
the feature and keep the current flat photo for the facade zone**, not to ship it and iterate
later. This project already spent one full development cycle on exactly this failure mode (the
procedural React Three Fiber scene, added and removed one day apart) — the gate exists so that
doesn't happen twice.

## Non-goals

- No procedural/generated geometry — see "Important prior art" above.
- No changes to the pool, spa, or reception/arrivals zones of `HotelScene` — they keep their
  current flat-photo treatment.
- No date-aware live quote on spinner hotspots — same base-rate display `HotelScene` already has
  today. Wiring a real quote into the spinner hotspot is a separate follow-up ticket.
- No changes to `/rooms`, `/book/[slug]`, `/booking/[reference]`, `/admin`, or anything in
  `lib/application`/`lib/domain/pricing.ts`.
- No OTA/urgency badges added to this component — those already exist elsewhere (`room-card.tsx`,
  `booking-flow.tsx`) and are out of scope here.

## Design system conformance

Follow `DESIGN_SYSTEM.md › Rules`. Hotspot pills reuse the existing ink-pill/clay-accent treatment
already established for `HotelScene`'s markers and `lib/ui.ts`'s `pill`/`tag` shapes — don't invent
a new visual language for this component's markers or controls.

## Acceptance criteria

- Works at 1440px and 390px.
- Full 360° drag (mouse + touch) and left/right arrow keys and on-screen buttons all change
  frames; rotation wraps at both ends.
- Hotspot click still lands on `/rooms/[slug]`.
- `/?frame=N&unit=<slug>` opens pre-turned to that hotspot.
- Frame-load or performance failure falls back silently to the current flat photo — no broken
  state, no error banner.
- Passed the mandatory human visual-review gate before merge.
- No component imports `lib/infrastructure` directly — data still flows through
  `CatalogService`/`Hotel` as today.
- `npm run typecheck && npm run lint && npm run build` pass; extend the Playwright golden path to
  cover spin + hotspot click at both viewports.

## Next steps (in order)

1. **Asset generation** — before any rendering work starts, generate 2–3 candidate 3D models via
   an AI image-to-3D tool using the reference images at `/Users/eeri/Downloads/references` as
   input, and present them (with quality-of-all-sides and format notes) for the product owner to
   pick from. Do not proceed to step 2 without an explicit pick.
2. **Provision Blender** — `brew install --cask blender` locally.
3. **Build and run the render pipeline** per "Asset path" above.
4. **Visual review gate** — human review of the actual rendered sequence before merge.
5. **Implement the component** (`components/hotel/building-spinner.tsx`) and wire it into
   `app/page.tsx`, per "Target mechanic" and "Data model additions."
6. **Extend Playwright** golden-path coverage for spin + hotspot click at 1440px/390px.
7. **Update `TECH.md`**'s Photography and media section to reflect the new spinner (it currently
   says "There is no 3D scene").

## Decision log

All settled 2026-09-06 via a structured interview — recorded here so a later reader doesn't have
to reconstruct the reasoning from chat history.

| Decision | Resolution | Why |
|---|---|---|
| Budget | None for a commissioned archviz build; AI image-to-3D generation instead of a stock download | The product owner's reference images (`/Users/eeri/Downloads/references`) are commissioned-archviz quality, far above any free-stock candidate found; a real commission was ruled out on budget, so AI generation is the accepted middle path |
| Who builds it | Agent only, asset used as-is, no manual retexturing | Matches the project's current all-agent workflow |
| Geometry quality risk | Accepted — AI-generated architectural geometry may be imperfect (uneven walls/floors, soft detail) | Chosen deliberately over paying for a real commission; the mandatory visual review gate exists specifically to catch a failure here before merge |
| Scope on `/` | Replaces only the facade/roof/cove zone of `HotelScene` | Pool/spa/reception are different photographs, not "the building exterior" |
| Hotspots shown | All facade-zone hotspots, including non-room `cove` | `cove` already lives in the same zone; excluding it would be an arbitrary filter |
| Implementation path | A — baked frame sequence via headless Blender | Under a no-budget/no-artist constraint, path B doesn't reduce effort and adds runtime risk |
| Rotation range | Full 360°, 48–72 frames, ~5–8 MB total | Accepted the payload cost for full coverage rather than a partial arc |
| Blender provisioning | Install locally now via Homebrew cask | One-time authoring dependency, not shipped to production |
| Quality gate | Mandatory human visual review before merge; abandon and revert to flat photo if it looks fake | The project already burned one cycle on exactly this failure mode |
| Fallback behavior | Silent fallback to today's flat photo on load/perf failure | Reuses the pattern `panorama-viewer.tsx` already established |
| Asset selection process | Agent generates 2–3 AI image-to-3D candidates from the reference images; product owner picks before rendering starts | Cheaper to catch "wrong architecture style" (or unusable geometry) before spending render-pipeline effort |
