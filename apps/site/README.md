# Spark StaySphere — Product Page

Editorial product page / case study for **Spark StaySphere**, the white-label direct-booking
front end for independent hotels. Built to read as a continuation of the live booking
experience at https://spark-staysphere.spark-staysphere-demo.workers.dev/ (demo property: Asteria Cove).

## Run

This app lives in `apps/site` beside `apps/pms` and `apps/guest`. From the monorepo root, use
`npm run dev:site`, `npm run build:site`, and `npm run lint:site`. The commands below run from this
app's own directory.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 (same React + Tailwind approach as the StaySphere build).

## Design system (extracted from the live StaySphere CSS)

| Token | Value |
| --- | --- |
| Canvas / ink | `#f3f1ec` / `#161616` |
| Stone, border | `#e9e5dd`, `#ddd9d0` |
| Muted text | `#66665f` |
| Accent (clay) | `#b8603a` |
| Tints | clay `#f4e6dd`, sand `#efe7d3`, sage `#e2e9de`, rose `#f1e2e0` |
| Radii | cards 28px, tiles 20px, pills `rounded-full` |
| Shadows | `shadow-soft`, `shadow-soft-lg` (same values as the product) |

Typography, as shipped in the product:

- UI/display stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, …` (Inter woff2 self-hosted as the cross-platform face)
- Headings carry no italic accent word and no numbered eyebrow: one plain statement per section
- Display: `.text-display` — weight 700, letter-spacing −0.028em, line-height 1.05
- Headings h1–h3: weight 700, letter-spacing −0.022em
- Hero headline: Jost 700 (self-hosted woff2), sentence case, line-height 1 — the one H1, fluid between 32 and 64px
- Body: 15–18px, `leading-relaxed`; small labels 12–14px, uppercase eyebrows tracked +0.12–0.14em

All tokens live in `src/index.css` and are exposed to Tailwind through `@theme inline`.

## Hero

The floating nav (`Nav.tsx`) is the page's one header — a fixed frosted pill with the wordmark, one
link per section, a Solutions dropdown, a language picker and the CTA. Below it the hero
(`src/components/Hero.tsx`) sits straight on the page canvas, no card: the pitch centred on top —
headline, lede, "View pricing" and "Request a demo" — and under it a *curved bento* of the product
(`HeroBento.tsx`): five columns of real captures, the outer ones tall and the middle one low, so the
row reads as a shallow bowl, sitting in a pool of warm light. On a mouse the light follows the
pointer across the row and each card leans to face it (a sprung `rotateX`/`rotateY`); on touch the
row simply scrolls sideways under the edge fades where it is wider than the page. Column width and
every card height derive from one `--col` (`clamp` over the bento's own `cqw`), so the composition
keeps its shape at any size. On load the nav drops in, the headline rises word by word, lede and
buttons follow, then the cards settle in from the middle outwards — all offsets, the lean and the
moving light are off under `prefers-reduced-motion`.

## Pricing page

`/pricing/` is a dedicated static entry (`pricing/index.html` → `src/pricing.tsx` → `PricingPage`)
for the plan configurator (`PricingCalculator.tsx`). The plan cards and FAQ remain on the product
page. Pick a plan, set rooms and connected channels (and properties, for
Group), toggle monthly/yearly, and the figure updates live from the model in `lib/plans.ts` — the
flat fee plus per-unit room and channel costs above what each plan includes. Group is an estimate
built on the Boutique rate less a portfolio discount. The order-request dialog is prefilled with
the chosen configuration. The plan buttons on the product page land here with `?plan=` preselected. Section
anchors in the nav and footer go through `sectionHref()`, which points them back at the product
page from the standalone pricing page.

The second step uses the 10 modules and monthly demo prices from the adjacent
`../lib/infrastructure/subscription-catalog.ts`. Independent, Boutique and Group correspond
to the catalog's Starter, Growth and Scale inclusion tiers, respectively; the site's plan prices
remain separate. Optional module costs update the estimate and order request. The former
`/pricing/modules/` URL redirects to `/pricing/`.

The hero, pricing cards and calculator summary offer a **Start free trial** button that opens
`DemoAccessDialog.tsx`. Its primary action opens PMS onboarding to create a hotel and start a
7-day trial; `VITE_PMS_URL` sets the PMS origin (local default: `http://localhost:3001`). The
dialog also keeps links to the separate Asteria Cove demo sign-in and guest booking. The demo
sign-in's **Forgot password?** control fills the sample credentials when demo access is enabled.

## Structure

```
index.html / pricing/index.html   page entries
src/
  main.tsx / pricing.tsx         mounts for each page
  App.tsx                    product page composition
  index.css                  tokens, fonts, utilities, reveal + device styles
  lib/links.ts               external URLs, contact email
  lib/plans.ts               the three plans + the calculator's pricing model
  lib/modules.ts             PMS subscription module catalog snapshot
  lib/nav.ts                 section anchors for the nav, `sectionHref()` for cross-page anchors
  lib/menu.ts                mobile menu, navHidden and request-demo dialog context
  lib/useReveal.ts           IntersectionObserver scroll reveal
  components/
    ui.tsx                   Reveal, Button, Shot, Chip, icons
    MenuProvider.tsx         mobile menu, navHidden and request-demo dialog state
    RequestDemoDialog.tsx    the one "Request a demo" / "Talk to us" form
    Nav.tsx                  the fixed floating nav
    Hero.tsx                 hero card: pitch, tablet + phone
    SolutionsMenu.tsx  LanguageSwitcher.tsx  header dropdowns
    ProjectIntro.tsx  BookingFlow.tsx
    RoomDetails.tsx  ServicesSection.tsx  EndToEnd.tsx
    ProductPrinciples.tsx  Pricing.tsx  FinalCTA.tsx  Footer.tsx
    PricingCalculator.tsx     property, module and billing configurator
public/
  ui/       real UI captures from the live demo (desktop 1440 @2x, mobile 390 @3x)
  photos/   property photography from the demo
  fonts/    Inter (woff2, as served by the product) + Jost (hero headline)
  brand/    Spark logo SVGs
```

## Screenshots

Every product visual is a capture of the live demo, taken with Playwright over the real
booking flow (search → rooms → room → extras → guest → payment → review → confirmation).
No UI was mocked. Guest data in the captures is placeholder demo data.
