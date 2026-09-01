# SPARK StaySphere 360 — Base Design System

## Direction

Premium architectural CGI with a restrained booking interface: black and warm white foundations, bright cyan interaction color, editorial display type, generous spacing, and clear operational statuses.

## Tokens

| Role | Value | Usage |
|---|---|---|
| Ink | `#0A0D0E` | Primary text, dark surfaces |
| Canvas | `#F2F1EC` | Main page background |
| Surface | `#FFFFFF` | Cards, forms, booking panels |
| Cyan | `#05E6EC` | Primary CTA, focus, 3D hotspots |
| Cyan dark | `#087F83` | Text on light backgrounds |
| Muted text | `#626A6C` | Secondary copy |
| Border | `#D8D8D2` | Dividers and control borders |
| Success | `#137A5A` | Available, confirmed |
| Warning | `#B96B16` | Limited inventory, price change |
| Danger | `#D9493F` | Sold out, failed payment |

CSS variables belong in `app/globals.css`; components must consume tokens rather than introduce
near-duplicate colors. Tailwind exposes them as `bg-ink`, `bg-canvas`, `text-cyan-dark`,
`text-muted-foreground`, `border-border`, `text-success`, `text-warning`, `text-danger`, and
`bg-card` for the white surface.

Three utilities in `app/globals.css` carry the type and elevation rules so components do not
re-declare them:

- `.text-display` — editorial serif, weight 400, `-0.02em` tracking, 1.04 line-height.
- `.eyebrow` — 11px, 600, `0.16em` tracking, uppercase.
- `.shadow-soft` / `.shadow-soft-lg` — the only two elevations; reach for a border first.

`:focus-visible` gets a 2px `--cyan-dark` outline with a 2px offset globally, and a global
`prefers-reduced-motion` block collapses animation and transition durations.

## Typography

- Display: editorial serif (Georgia fallback), weight 400, tight tracking.
- UI/body: neutral sans-serif (Arial/system fallback), weights 400–700.
- Eyebrows and metadata: 10–12px, uppercase, `0.12–0.18em` tracking.
- Body: 15–18px with at least 1.5 line-height.

## Spacing and shape

- Base spacing unit: 4px. Preferred steps: 8, 12, 16, 24, 32, 48, 64, 96.
- Controls: minimum 44px touch target.
- Inputs/buttons: 12–16px radius; cards: 20–24px; pill badges: 999px.
- Shadows remain soft and low contrast; use borders before adding stronger shadows.

## Components

- Primary CTA: cyan fill, dark text, explicit verb.
- Secondary CTA: transparent or white surface with visible border.
- Room card: visual preview, 3D/360 badge, availability, core specs, direct price, total, details and booking actions.
- Search/filter controls: persistent selected values, reset action, keyboard labels, mobile bottom-sheet pattern when needed.
- Sticky booking summary: dates, guests, room, add-ons, taxes/fees, total, and primary CTA.
- Status badges: never rely on color alone. Each carries an icon (check, alert, cross) *and*
  explicit wording, including the count — "Only 3 left", "Last room", "Sold out".
- Room artwork and the resort massing are procedural SVG generated from domain data. No external
  image hosts; no stock photography standing in for a specific room.

## Motion and 3D

- UI transitions: 150–250ms; respect `prefers-reduced-motion`.
- The arrival scene ships as an SVG poster with drag/keyboard parallax. Three.js loads only when a
  visitor presses **3D**, and a WebGL failure returns them to the poster rather than an error page.
- Orbit is clamped to a narrow polar arc; panning is disabled so the camera cannot end up under the
  model or behind the sea plane.
- Hotspots are labelled pills from `sm` up and bare 44px markers below it, where labels would
  collide. Status chips over the scene are `pointer-events-none` so they never eat a hotspot tap.
- A press inside a draggable stage only becomes a drag after 6px of travel, so buttons layered on
  the scene keep their clicks.

## Accessibility

- Meet WCAG AA contrast for text and controls.
- Use visible cyan focus rings with offset.
- Preserve semantic headings, landmarks, labels, error text, and live regions.
- Ensure every viewer control has a text or accessible name; do not trap keyboard focus in 3D/360 canvases.
