# AGENTS.md

Guide for AI coding agents working in this repo. Human-facing overview lives in
[README.md](README.md); design tokens and UI rules live in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

---

## What this is

An editorial **product page / case study** for **Spark StaySphere** — a white-label direct-booking
front end for independent hotels. It is a single scrolling marketing page, not the booking product
itself. The live product it documents:
`https://spark-staysphere.spark-staysphere-demo.workers.dev/` (demo property: Asteria Cove).

The page is deliberately built to read as a continuation of that product: same tokens, same type
treatment, same radii and shadows. If a choice here contradicts the live product's visual language,
the product wins.

Every product visual in `public/ui/` is a **real Playwright capture of the live demo**, not a
mockup. Never replace one with a hand-built HTML approximation, and never redraw UI in markup that
a screenshot already shows.

---

## Stack

| | |
| --- | --- |
| Build | Vite 8 (`@vitejs/plugin-react`, `@tailwindcss/vite`) |
| UI | React 19.2, TypeScript ~6.0 (strict bundler mode) |
| Styling | Tailwind CSS v4 — **CSS-configured, no `tailwind.config.js`** |
| Animation | `motion` v13 (imported from `motion/react`) + hand-rolled CSS/IntersectionObserver |
| Scroll | `lenis` 1.3 for inertial smooth scrolling |
| Lint | **oxlint**, not ESLint |

```bash
npm run dev      # vite dev server, http://localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run lint     # oxlint
npm run preview  # serve dist/
```

`npm run build` type-checks first — a type error fails the build. Run it before declaring work done.

---

## Architecture

```
index.html        the product page entry → src/main.tsx
pricing/index.html  the pricing page entry (/pricing/) → src/pricing.tsx
pricing/modules/index.html  module reference (/pricing/modules/) → src/modules.tsx; all entries registered in vite.config.ts
src/
  main.tsx        mounts App (the product page)
  pricing.tsx     mounts PricingPage (/pricing/)
  modules.tsx     mounts ModulesPage (/pricing/modules/)
  App.tsx         product page composition — section order lives here, nothing else
  index.css       tokens (@theme inline), base layer, utilities, hero, reveal, device frames
  lib/
    links.ts            external URLs (StaySphere demo, deep-linked booking, contact email)
    plans.ts            the three plans + the calculator's pricing model (`quote()`), shared by both pages
    modules.ts          sourced CORE module names for the separate reference page
    nav.ts              NAV_LINKS — section anchors for the nav
    menu.ts             MenuContext: mobile menu `open`, `navHidden`, and the request-demo dialog state
    useReveal.ts        one IntersectionObserver for every `.reveal` on the page
    useSmoothScroll.ts  Lenis setup + anchor interception
    useActiveSection.ts which section sits under the 40% reading line
  components/
    ui.tsx          Reveal, Button, Shot, Chip, ArrowRight, ArrowUpRight, Globe (section-specific icons live in their section)
    motion.tsx      `ease` constant, FadeIn, Panel, Parallax
    AnimatedHeading.tsx  word-by-word heading reveal (the standard section heading)
    MenuProvider.tsx  chrome state provider
    RequestDemoDialog.tsx  the one "Request a demo" / "Talk to us" form, opened via `useMenu().openDemoRequest()`
    ModulesPage.tsx  standalone module selector and request summary
    Nav.tsx  NavLinks.tsx  SolutionsMenu.tsx  LanguageSwitcher.tsx  Hero.tsx
    …one component per page section
public/
  ui/      real UI captures (d- = desktop 1440@2x, m- = mobile 390@3x, t- = tablet)
  photos/  property photography
  fonts/   inter.woff2, jost.woff2 (self-hosted, preloaded)
  brand/   Spark logo SVGs
```

### One fixed header

`Nav` is the page's only header: a fixed frosted pill above the hero card and every section after
it. `.hero-shell` reserves its height (`--hero-top`) so the card starts below it. A full-screen
section can hide the nav by setting `navHidden` through `useMenu()` — the `EndToEnd` flow stage does
exactly this because it renders its own top row. If you add a full-bleed section with its own
chrome, follow that pattern and **reset `navHidden` in a cleanup effect**.

### Two animation systems, on purpose

- **CSS + IntersectionObserver** (`.reveal`, `.split-heading`) for the cheap, page-wide stuff.
- **`motion/react`** for anything scroll-linked, spring-driven, or gesture-driven.

Don't migrate one into the other wholesale. Pick by cost: if it's a one-shot fade, use `.reveal`.

---

## Conventions

### Code

- **Named exports** for every component (`export function Nav()`); `App` is the only default export.
- Components are function components with inline prop types (`type Props = {...}` or inline).
- No CSS modules, no styled-components, no `style` props except for CSS custom properties
  (`--reveal-delay`, `--word-delay`) — those are cast `as CSSProperties`.
- `tsconfig` runs `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`. Type-only imports must use `import type`.
- Comments explain **why** — a layout constant, an optical correction, a browser quirk. The hero's
  `0.1025em` lift is a good example. Don't narrate what the code obviously does.
- Data that drives a section (cards, stages, pricing rows) lives in a `const` array at the top of
  that component's file, typed, not inlined in JSX.

### Styling

- Read [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) before touching anything visual.
- Use token utilities (`bg-canvas`, `text-muted-foreground`, `rounded-card`, `shadow-soft`) over
  raw values. New tokens go in `:root` **and** `@theme inline` in `src/index.css`.
- **Type sizes come from the fixed scale only**: 12, 14, 16, 18, 24, 28, 32, 48, 56, 64.
  Never `text-[15px]`. Never `text-xl`.
- Section shell is always:
  `<section id="…" className="container-site pt-32 sm:pt-40 lg:pt-52" aria-labelledby="…-heading">`
  with an `<AnimatedHeading id="…-heading" className="text-display text-4xl sm:text-5xl lg:text-6xl" />`.
- Top padding only (`pt-*`), never `py-*`, so inter-section space has one owner.
- Long-form CSS (hero geometry, device frames, reveal keyframes) belongs in `index.css`, not in
  arbitrary Tailwind values.

### Accessibility — treat as a build requirement

Section `aria-labelledby`, `.sr-only` full text behind animated headings, 44px minimum targets,
`inert` on hidden chrome, `aria-expanded`/`aria-controls` on toggles, `focus-visible` rings,
`Escape` closes overlays. **Every animation must have a `prefers-reduced-motion` path.** The full
contract is in DESIGN_SYSTEM.md §7.

---

## Gotchas

- **No `tailwind.config.js`.** Looking for one and then creating one is wrong — it would fight the
  `@theme inline` block. All configuration is CSS.
- **The type scale is overridden.** `text-3xl/4xl/6xl/7xl` are *not* Tailwind defaults here
  (28/32/56/64, not 30/36/60/72). Don't "fix" them back.
- **oxlint, not ESLint.** Don't add `.eslintrc`.
- **Lenis hijacks scrolling.** `scrollIntoView` and `scroll-behavior: smooth` fight it; anchor
  clicks are already intercepted in `useSmoothScroll`. It is skipped entirely under reduced motion.
- **The hero is container-query based.** `.hero-shell` is an inline-size container (the H1 scales in
  its `cqw`); `.hero-bento` is a nested one, and its column width `--col` (and every card height,
  derived from it) is a `clamp` over the *bento's* `cqw`. Editing it in viewport units will break the
  curve. The bento bleeds to the viewport edge by design (negative `--hero-pad` margins) so its edge
  fades have the full width to land on; where the row is wider than the page it scrolls sideways.
  The pointer lean lives in `HeroBento.tsx` as motion springs on `rotateX`/`rotateY` — keep the
  entrance on `y`/`scale`/`opacity` so the two never write the same property.
- Dev server is started via `.claude/launch.json` (port 5173), not a raw shell command.

---

## Working agreement

1. Read the relevant component fully before editing — sections are self-contained and dense.
2. Prefer editing an existing section over adding a new one; the page's argument is already tight.
3. After any visual change, **run the dev server and look at it** in the browser preview — check
   the console, and screenshot the affected section. Type-checking is not verification for UI.
4. Check both `sm` and `lg` behaviour for layout changes; several components change strategy
   entirely at `lg` (the flow rail becomes pinned, the hero re-lays out).
5. Test with reduced motion when you touch animation.
6. Run `npm run build` and `npm run lint` before calling it done.
7. This repo is **not** under git. There is no undo — don't run destructive commands, and make
   edits surgically rather than rewriting files wholesale.
