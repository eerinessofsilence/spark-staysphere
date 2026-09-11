# SPARK StaySphere 360 — Design System

This file is the contract. It exists because the first pass of this product shipped uppercase
eyebrows, grids of labelled stat boxes, icon-in-a-circle feature cards, procedural illustrations,
and a neon accent — and every one of those read as generic. The rules below are what replaced
them. When a new screen is built, it is checked against **Rules** first and against the tokens
second.

## Direction

Photography-led, warm, and quiet by day; near-black with one electric lime by night — the
whole product runs on the night scheme now, `.dark` set once on `<html>`, the same tokens
under different values. Ink does the work by day, lime by night; large geometric display
type; pill-shaped controls; frosted panels over photographs. The references are premium hotel
and residential sites, not SaaS dashboards.

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
   image host at runtime. The one exception is the building model (`HotelModel`): a turnable
   3D model of the property is the product's own promise, and it is built from the property's
   real massing (`Hotel.model`) or its own GLB — never a decorative render. It sits in its own
   section below the arrival photograph, never in place of it, and its floors link into the
   catalog; the model's colours are the page's tokens, and the accent lights the picked floor.
5. **Two icon sets, split by job.** *Interface* marks — calendar, guests, search, chevrons,
   close, check, plus/minus, fullscreen, spinner — are **Heroicons outline**
   (`@heroicons/react/24/outline`), stroked and legible down to 14px, where a filled glyph
   collapses into a blob. *Subject* marks — a bathtub, a towel, a lotus, a bed, a ruler, a wine
   glass, the hotspots on a photograph — are **Phosphor filled**
   (`@phosphor-icons/react/dist/ssr`, `weight="fill"`), because Heroicons is a UI set and simply
   has no glyph for them. The line is what the mark denotes, not where it sits: never reach for
   Phosphor to draw a chevron, or Heroicons to draw a bathtub. `lucide-react` is lint-banned
   outside `components/ui/` (the generated shadcn primitives), see `.oxlintrc.json`.
6. **The accent is clay by day and lime by night, and it belongs to a few jobs.** On the light
   scheme the accent is clay (`#B8603A`) and the primary action is an ink pill with warm-white
   text. On the night scheme — `.dark` on `<html>`, the site's own scheme, not one screen's —
   the accent is electric lime (`#D4FF3A`) and the primary pill is lime with the canvas as its
   text. On both, the accent marks the section-label dot, focus rings, savings, active states,
   the primary action, and one italic phrase per screen; prices and body copy stay in the
   foreground colour. Never blue, never purple, and no second neon beside the lime. Components
   read `bg-primary` / `text-primary-foreground`, never `bg-ink` with a literal, so one pill
   is correct on both schemes.
7. **Actions are pills; facts are chips; containers are 28px.** Use `pill()`, `tag()`, and
   `iconButton()` from `lib/ui.ts` rather than composing new button classes.
8. **One italic phrase per screen at most**, set in the accent serif. Never body copy, never a
   label, never a button.
9. **Form groups are `role="group"` with a heading**, never `<fieldset>`/`<legend>` — the legend
   renders inside the border and breaks every layout it touches.
10. **Status is never colour alone.** A badge carries a filled icon and words, including the
    count: "Only 3 left", "Last room", "Fully booked" — a hotel's word, never "Sold out".

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
| Danger | `#C4473A` | `text-danger` | Fully booked, failed payment |
| Primary hover | `#2B2B2B` | `hover:bg-primary-hover` | The primary pill's hover; lime `#C2EC2E` by night |
| Raised surface | `#FFFFFF` | `.surface-raised` | The phone stay search — the one panel that stays light (`#F4F2EC`) by night, with `--surface-raised-foreground` for its text |
| Warm white on ink | `#F7F5F0` | `text-primary-foreground` | Text on ink pills; `#141414` on the night's lime pill |
| Glass tint | `#F7F5F0` | `--glass-tint` | The fill of every frosted panel |
| Glass edge | `white 70%` | `--glass-edge` | The lit hairline that makes it read as glass |

The night scheme redefines the same names under `.dark` in `app/globals.css`: canvas `#141414`,
surface `#1E1E1E`, stone `#262626`, accent `#D4FF3A`, primary `#D4FF3A` on `#141414`, border
`white 10%`. `.dark` sits on `<html>` in the root layout, so it is the whole document, not one
page's subtree — `Modal`, the dates panel and the guest stepper all portal to `document.body`,
which is a descendant of `<html>` either way, so a sheet just reads the scheme, nothing carries
it across. The one deliberate exception is `.surface-raised` (the phone search card): it
re-points `--foreground`, `--border` and a few neighbours back to their day values inside its
own subtree, the way the reference lifts its search out of a dark screen, and any dialog
opened from a control that happens to sit on it still portals past that subtree to the body
and reads the site's own night tokens, not the card's.

### Flat tints

Five muted surfaces, each paired with a darker ink of the same hue for the mark on it. Warm
throughout, with one sage — no blue, no purple, no neon, so rule 6 still holds. The surfaces
paint chips: the room's facts and what the rate includes. The amenity cards on a room page are
white on `shadow-soft` and carry only the **mark** in the tone's ink, so a wall of them still
groups itself by what each thing is without the whole card being coloured. They are never text
colour, never a button, never the accent's job. The tone is chosen from what the thing is
(`amenityTone`, `factTone`); anything unclassified stays stone, the page's own neutral.

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
- **Room card**: a small tile, six to a row at `xl` and two on a phone. Photograph with a
  frosted status pill, the name, one muted line of "sleeps · view", the nightly price in display
  type, and the direct saving. Nothing else: the description, the fact chips and what the rate
  includes turned every row of the catalog into a wall of text while the guest was still
  scanning, and all of it is one click away on the room page. No button — the whole tile is the
  link — and it never opens the booking flow, only the room.
- **Filters**: sticky card on desktop, bottom sheet on mobile. Toggle chips for categorical
  filters (`aria-pressed`), a slider for budget, native selects for area and floor, a switch for
  sold-out. Group headings are plain sentence-case text.
- **Sticky summary**: dates, guests, quoted line items, total in display type, ink CTA, and the
  demo disclaimer in small muted text.
- **Booking stepper**: a rail, not a row of chips — a numbered mark per step with an arrow
  between each pair, and "Step 3 of 6" above it. Done steps are a tick on the clay tint and go
  back on click; the current one is an ink disc; ones ahead are an outlined number and inert.
  On a phone only the current step keeps its label and the rail scrolls it into view.
- **Overlays**: one shape. On a phone every dialog is a sheet rising from the bottom edge,
  inset 12px, 28px radius, the height of what is on it, capped at 85% of the viewport and
  scrolling inside past that — the shared `Modal`, the dates panel and the guest stepper all sit
  at the same inset. A full-height sheet leaves an empty gap between short content and the button
  pinned to the floor, so it is never the default. From `sm` the `Modal` becomes a centred card
  and the two field panels anchor under the field they belong to. Enter and leave both play, over
  200ms, through `useOverlayTransition`.
- **Glass**: one class, `.glass`, and it is the only place the product blurs. It carries its own
  fill, lit edge and blur, so a call site adds shape and nothing else — never a hand-rolled
  `border-white/60`. Use it only over photography: over the canvas it is a grey box that costs a
  compositor layer. The fill is the warm white of the ink pills, not plain white, which over a
  blue sea would read as grey. The dark counterpart is the same class under `.dark`, so a panel
  can never be frosted white on a dark page.

## Motion

- 150–250ms transitions; respect `prefers-reduced-motion` (a global block collapses durations).
- Photo switches crossfade over 500ms.
- Every dialog (the shared `Modal`) fades and settles open over 200ms, and plays the same in
  reverse on close rather than vanishing — a phone's sheet slides up off the edge it is pinned to,
  a desk's centred card fades in a touch smaller. Named properties only (`opacity`, `transform`),
  never `transition-all`: a panel's own class can change its width or radius at a breakpoint, and
  that has no business animating just because the dialog opened.
- Nothing else animates. In particular: no reveal-on-scroll for headings or sections. That is the
  same genre of template motion rule 3 already bans in cards — a staggered fade-up is exactly what
  the first, generic pass of this product did, and the read is identical whether the cliché is a
  visual one or a motion one.
- **The one scoped exception**: the AI room finder's orbs (`components/assistant/thinking-orbs.tsx`)
  animate continuously while listening, transcribing, or thinking. This is not decoration — it is
  the product's only channel for a machine state that has no other visible signal, and every state
  it represents also carries its own text in a `role="status"` region, so the animation is never
  the only thing saying what is happening. It stays inside the assistant panel, uses only
  `transform`/`opacity` through one shared `requestAnimationFrame` loop that is cancelled the moment
  the panel closes or hides, and holds still (cross-fading only) under `prefers-reduced-motion`.
  Nothing else in the product gets this exception; a template-motion request elsewhere should still
  be refused on rule 3's terms.

## Accessibility

- WCAG AA contrast for text and controls. The accent is used for text only as `accent-strong`.
- Visible accent focus ring with a 2px offset on every interactive element.
- Semantic headings and landmarks, labels on every control, live regions for repricing and
  hotspot panels, and no keyboard traps in galleries (arrow keys page, tabs switch).
