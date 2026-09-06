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
2. **No grids of small labelled boxes for numbers.** "Available now / 7 of 8" tiles are banned.
   Counts and figures read as a sentence (`7 of 8 room types are available for 16–19 Oct, from
   €244 a night`) or as one large figure with a plain descriptor beside it, separated by
   hairlines. A grid of cards is allowed where each card is one *thing the room has* rather than
   a statistic about it — the amenities on a room page are a mark and a name, nothing else. The
   moment a card grows a heading over two lines of copy it has become the banned pattern.
3. **No icon-in-a-tinted-circle feature cards.** Value propositions are photographs with a
   numbered list over or beside them (`01 / 02 / 03`), or plain rows. Never three cards with an
   icon, a heading, and two lines of copy.
4. **No schematic or procedural illustration.** Rooms and the property are shown with
   photography only. Stock stands in for the property's own until launch; every file is local
   (`public/images`) and credited in `public/images/CREDITS.md`. Nothing loads from an external
   image host at runtime.
5. **Two icon sets, split by job.** *Interface* marks — calendar, guests, search, chevrons,
   close, check, plus/minus, fullscreen, spinner — are **Heroicons outline**
   (`@heroicons/react/24/outline`), stroked and legible down to 14px, where a filled glyph
   collapses into a blob. *Subject* marks — a bathtub, a towel, a lotus, a bed, a ruler, a wine
   glass, the hotspots on a photograph — are **Phosphor filled**
   (`@phosphor-icons/react/dist/ssr`, `weight="fill"`), because Heroicons is a UI set and simply
   has no glyph for them. The line is what the mark denotes, not where it sits: never reach for
   Phosphor to draw a chevron, or Heroicons to draw a bathtub. `lucide-react` is lint-banned
   outside `components/ui/` (the generated shadcn primitives), see `.oxlintrc.json`.
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

### Flat tints

Five muted surfaces for the amenity cards on a room page, each paired with a darker ink of the
same hue for the mark on it. Warm throughout, with one sage — no blue, no purple, no neon, so
rule 6 still holds. They are **surfaces only**: never text colour, never a button, never the
accent's job. The tone is chosen from what the amenity is (`amenityTone`), so a wall of cards
groups itself; anything unclassified stays stone, the page's own neutral.

| Tone | Surface | Mark | Used for |
|---|---|---|---|
| Clay | `#F4E6DD` | `#9A4E2C` | The kitchen: dining, coffee, minibar |
| Stone | `#E9E5DD` | `#5F5E58` | Water, and anything unclassified |
| Sage | `#E2E9DE` | `#4C6A4E` | Outdoors: terraces, balconies, the view |
| Sand | `#EFE7D3` | `#7F6A35` | Comfort and kit: Wi-Fi, climate, blinds, desk |
| Rose | `#F1E2E0` | `#93565A` | Sleeping and lounging |

## Typography

One interface face for everything, plus an italic serif for a single emphasised phrase.
Titles and body differ by size and weight, not by typeface — the way the platform does it.

- **Interface — San Francisco, with Inter behind it.** The stack is
  `-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, system-ui, …`. SF is never shipped:
  Apple's licence covers designing for their platforms, not serving the file, so the first two
  entries hand back the device's own face on macOS and iOS. Inter (self-hosted through
  `next/font/google`, weights 400–700) catches Windows and Android so they keep the same
  character instead of dropping to Segoe or Roboto.
- **Titles** use `.text-display` — the same face at weight 700, `-0.028em` tracking, 1.05
  leading. Every `h1`–`h3`, prices, counters, and large figures. Hero names run to
  `clamp(3.25rem, 10vw, 8rem)`.
- **Body** is 14–15px at 1.5+ leading, weight 400, medium (500) for emphasis.
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
- **Dates**: never `input[type=date]` — the browser's own control looks different on every
  platform and cannot show the range. Check-in and check-out are two triggers onto one
  `StayDatesField` panel: two months on desktop, one in a bottom sheet on a phone, ink circles
  at both ends of a stone band, a preview band under the cursor, sold-out days struck through,
  and the nights read back as a sentence.
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
