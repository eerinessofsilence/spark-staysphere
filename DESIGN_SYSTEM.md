# SPARK StaySphere 360 — Design System

This file is the contract. It exists because the first pass of this product shipped uppercase
eyebrows, grids of labelled stat boxes, icon-in-a-circle feature cards, procedural illustrations,
and a neon accent — and every one of those read as generic. The rules below are what replaced
them. When a new screen is built, it is checked against **Rules** first and against the tokens
second.

## Direction

Photography-led, warm, and quiet. Ink does the work; one muted clay accent; large geometric
display type; pill-shaped controls; frosted panels over photographs. The references are
premium hotel and residential sites, not SaaS dashboards.

## Rules

These are enforced in review and, where possible, by lint.

1. **No uppercase, letter-spaced microcopy.** No "eyebrows". A lead-in above a heading is
   `SectionLabel` — sentence case, muted, with an accent dot — or nothing.
2. **No grids of small labelled boxes for facts.** "Available now / 7 of 8" tiles are banned.
   Facts read as a sentence (`7 of 8 room types are available for 16–19 Oct, from €244 a night`)
   or as one large figure with a plain descriptor beside it, separated by hairlines.
3. **No icon-in-a-tinted-circle feature cards.** Value propositions are photographs with a
   numbered list over or beside them (`01 / 02 / 03`), or plain rows. Never three cards with an
   icon, a heading, and two lines of copy.
4. **No schematic or procedural illustration.** Rooms and the property are shown with
   photography only. Stock stands in for the property's own until launch; every file is local
   (`public/images`) and credited in `public/images/CREDITS.md`. Nothing loads from an external
   image host at runtime.
5. **Icons are Phosphor, filled.** Import from `@phosphor-icons/react/dist/ssr` (works in server
   and client components) and pass `weight="fill"`. Arrows, carets, checks, and crosses may use
   `weight="bold"` because their fill variants are illegible at 16px. `lucide-react` is
   lint-banned outside `components/ui/` (the generated shadcn primitives), see `.oxlintrc.json`.
6. **The accent is clay, and it is not the primary action.** Primary actions are ink pills with
   warm-white text. The accent marks the section-label dot, focus rings, savings, active states,
   and one italic phrase per screen. Never neon, never blue, never purple.
7. **Actions are pills; facts are chips; containers are 28px.** Use `pill()`, `tag()`, and
   `iconButton()` from `lib/ui.ts` rather than composing new button classes.
8. **One italic phrase per screen at most**, set in the accent serif. Never body copy, never a
   label, never a button.
9. **Form groups are `role="group"` with a heading**, never `<fieldset>`/`<legend>` — the legend
   renders inside the border and breaks every layout it touches.
10. **Status is never colour alone.** A badge carries a filled icon and words, including the
    count: "Only 3 left", "Last room", "Sold out".

## Tokens

CSS variables live in `app/globals.css`; components consume tokens, never near-duplicates.

| Role | Value | Tailwind | Usage |
|---|---|---|---|
| Ink | `#161616` | `bg-ink`, `text-foreground` | Primary actions, dark bands, display text |
| Canvas | `#F3F1EC` | `bg-canvas` | Page background |
| Surface | `#FFFFFF` | `bg-card` | Cards, panels, inputs |
| Stone | `#E9E5DD` | `bg-stone` | Chips, secondary surfaces, hover fills |
| Accent | `#B8603A` | `bg-accent`, `text-accent` | Section-label dot, focus ring, active marks |
| Accent strong | `#9A4E2C` | `text-accent-strong` | Accent text on light surfaces, savings, italic phrase |
| Accent soft | `#F4E6DD` | `bg-accent-soft` | Accent-tinted notice backgrounds |
| Muted text | `#6B6B66` | `text-muted-foreground` | Secondary copy, labels |
| Border | `#DDD9D0` | `border-border` | Hairlines and control borders |
| Success | `#2E7D5B` | `text-success` | Available, confirmed |
| Warning | `#B4711C` | `text-warning` | Limited inventory, price change |
| Danger | `#C4473A` | `text-danger` | Sold out, failed payment |
| Warm white on ink | `#F7F5F0` | — | Text on ink pills and bands |

## Typography

Three faces, self-hosted at build time through `next/font/google`. Do not add a fourth.

- **Display — Bricolage Grotesque**, weights 400–600. Every `h1`–`h3`, prices, counters, and
  large figures. The `.text-display` utility sets weight 500, `-0.025em` tracking, 1.02 leading.
  Hero names run to `clamp(3.25rem, 10vw, 8rem)`.
- **Body — Onest**, weights 400–600. Everything else, 14–15px, 1.5+ leading. Medium (500) for
  emphasis; there is no bold in the UI.
- **Accent — Instrument Serif italic** through `.text-accent-italic`, for the one emphasised
  phrase a screen is allowed.

## Shape and space

- Spacing unit 4px; preferred steps 8, 12, 16, 24, 32, 48, 64, 96.
- Controls are 44px minimum touch targets.
- Pills for every action and chip (`rounded-full`). Inputs `rounded-2xl`. Cards, panels, and
  photographs `rounded-[28px]`. Nothing between 8px and 16px except inputs.
- Elevation is `.shadow-soft` or `.shadow-soft-lg`, nothing stronger. Reach for a hairline first.
- Frosted panels over photography use `.glass` (light) or `.glass-dark`.

## Photography

- Hero areas are `HotelArea` records with a photo, a caption, and hotspots stored as fractions
  of the photo. Hotspots are mapped through the same `object-fit: cover` maths the browser uses
  so a marker stays on the balcony it points at.
- Hotspots are pills: ink circle with a filled icon, then the label. Labels collapse to the icon
  below `sm`. Tapping opens a frosted card with the description and one CTA.
- Room galleries show one photograph at a time with pill tabs (thumbnail + label), paging
  arrows, a `01 / 04` counter, and fullscreen.
- Photographs always carry `width`/`height` to avoid layout shift, and `loading="lazy"` unless
  they are the arrival hero.

## Components

- **Header**: frosted pill bar — mark and wordmark, text links, ink "Book a room".
- **Search bar**: one pill on desktop with hairline dividers between fields and an ink search
  button; stacked 28px card on mobile. It overlaps the bottom edge of the arrival scene.
- **Room card**: photograph on the left with a frosted status pill; name in display type;
  facts as filled-icon chips; inclusions with filled checks; price in display type; "Details"
  secondary pill and "Book now" ink pill.
- **Filters**: sticky card on desktop, bottom sheet on mobile. Toggle chips for categorical
  filters (`aria-pressed`), a slider for budget, native selects for area and floor, a switch for
  sold-out. Group headings are plain sentence-case text.
- **Sticky summary**: dates, guests, quoted line items, total in display type, ink CTA, and the
  demo disclaimer in small muted text.
- **Booking stepper**: pills, the current one ink with an accent number, done ones with a check.

## Motion

- 150–250ms transitions; respect `prefers-reduced-motion` (a global block collapses durations).
- Photo switches crossfade over 500ms; nothing else animates.

## Accessibility

- WCAG AA contrast for text and controls. The accent is used for text only as `accent-strong`.
- Visible accent focus ring with a 2px offset on every interactive element.
- Semantic headings and landmarks, labels on every control, live regions for repricing and
  hotspot panels, and no keyboard traps in galleries (arrow keys page, tabs switch).
