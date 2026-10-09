# Decision records

Short records of *why* something was built the way it was, for decisions where the reasoning
isn't obvious from reading the code alone. Not a full history of every choice made in this
project — only the ones worth someone not re-litigating.

| # | Decision |
|---|---|
| — | [The building spinner: baked frames over a live 3D scene](../../SPINNER_SPEC.md) — kept at the repo root, since TECH.md, DESIGN_SYSTEM.md, and CLAUDE.md already link it there; the fullest decision log of them all. |
| [0001](0001-d1-seed-overlay.md) | D1 for durable state; the catalog stays seed data with a CMS overlay |
| [0002](0002-no-drag-and-drop-cms-lists.md) | CMS reorderable lists use up/down buttons, not drag-and-drop |
| [0003](0003-fetch-not-openai-sdk.md) | Call the OpenAI REST API with `fetch`, not the `openai` npm package |
| [0004](0004-hotel-repository-port-slices.md) | Split `HotelRepository` into four narrower interfaces |
| [0005](0005-view-360-module.md) | The 360° views are one module with a single public entry |
| [0006](0006-spinner-markup.md) | Spinner-markup zones: a CMS tab, stored beside — not inside — `Hotel.spinner` |

## Adding one

A new file, `NNNN-kebab-case-summary.md`, numbered after the last one. Structure: Status, Context,
Decision, Why (and why not the alternatives), Consequences — see any existing one for the length
and tone to aim for. Worth writing when a decision wasn't obvious, cost real back-and-forth to
reach, or is likely to be second-guessed later without the reasoning behind it.
