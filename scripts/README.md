# Scripts

Two independent pipelines: the building spinner's orbit frames (Blender + OpenCV, run by hand,
occasionally), and the media manifest (Node, run every time a photo changes). Neither runs as part
of `npm run dev` or `npm run build`.

## The building spinner's orbit frames

The arrival page's draggable building spinner (`components/hotel/building-spinner.tsx`,
`Hotel.spinner`) is a baked sequence of frame images plus hand-traced hotspot outlines — see
SPINNER_SPEC.md for the full reasoning and `docs/decisions/` for the shorter version. Regenerating
it, in order:

1. **`fetch-polyhaven.py`** — downloads the CC0 textures, HDRIs, and prop models a dressed Blender
   scene links to.
   ```
   python3 scripts/fetch-polyhaven.py            # into scripts/blender-assets/ (gitignored)
   python3 scripts/fetch-polyhaven.py --dest DIR
   ```
   Idempotent (skips files already on disk); writes `DIR/manifest.json` mapping each asset slug to
   its downloaded paths. No Python dependencies beyond the standard library.

   **Known gap:** this downloads the assets a scene *links to*, not the scene itself. The scene
   file, `scripts/asteria-cove.blend`, is not committed to this repository — `.gitignore` excludes
   `scripts/blender-assets/` but the `.blend` isn't there either, and there's no other copy of it
   in the repo's history. Regenerating the spinner from scratch currently requires rebuilding that
   scene by hand (or locating wherever it was last saved outside this repo) before step 2 below can
   run. `public/models/boulder_01.glb` and `outdoor_table_chair_set_01.glb` are two Poly Haven
   models committed from the same original session — likely leftovers from the abandoned three.js
   attempt (see CLAUDE.md's roadmap and `docs/decisions/`), and worth confirming still needed
   before anyone spends time chasing what uses them.

2. **`render-spinner.py`** — run *inside* Blender, headless, against either a generated model file
   or an already-dressed `.blend`:
   ```
   blender --background --python scripts/render-spinner.py -- \
       --model /path/to/building.glb --out public/images/hotel/spin

   blender --background /path/to/candidate.blend --python scripts/render-spinner.py -- \
       --collection HERO_hotel --out public/images/hotel/spin
   ```
   Key options: `--frames` (defaults to 48; the shipped set is 160 — pass it explicitly),
   `--width`/`--height`, `--elevation`, `--start-angle`, `--engine CYCLES|BLENDER_EEVEE`,
   `--samples`, `--format PNG|WEBP` (WebP output skips a separate conversion pass), `--quality`.
   Frame 0 is front-on; the orbit steps clockwise from above, matching a rightward drag in
   `BuildingSpinner`. Requires Blender installed locally (`brew install --cask blender` on macOS)
   — a one-time authoring dependency, not something the deployed app needs.

3. **Commit the frames** to `public/images/hotel/spin/` as WebP, the same as every other
   photograph in this project (see `public/images/CREDITS.md` for crediting anything not
   originally rendered from the property's own model).

4. **`track-outlines.py`** — propagates a hand-traced hotspot outline across every orbit frame, so
   you don't have to hand-trace all 160:
   ```
   python3 scripts/track-outlines.py --frames ~/Downloads/asteria-full --config scripts/outline-anchors.json
   ```
   Requires `opencv-python` and `numpy` (not in `package.json` — this is a standalone Python tool,
   `pip install opencv-python numpy`). Reads hand-traced anchor frames from
   `scripts/outline-anchors.json`, tracks forward and backward between them with feature matching
   plus RANSAC homography fitting (the same idea a compositor's planar tracker uses), and writes a
   JSON array of `{frameIndex, x, y, outline}` — paste that straight into the relevant hotspot's
   `keyframes` in `lib/infrastructure/mock-data.ts`. `scripts/outline-tracked.json` is a checkpoint
   of a previous run's output, kept for reference.

## The media manifest

```
npm run generate:media-manifest
```

Runs `scripts/generate-media-manifest.mjs` — plain Node, no dependencies. Walks
`public/images/**` (skipping the spinner's own orbit frames), reads each WebP's width/height
straight out of its header bytes (no image library), and rewrites
`lib/infrastructure/media-manifest.generated.json`, which is committed so the CMS's media picker
never touches the filesystem at request time. Run this every time you add or remove a photo — see
`docs/HOWTO.md`'s "Add a photo" recipe.
