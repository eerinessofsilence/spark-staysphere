# CLAUDE.md

**Read [AGENTS.md](AGENTS.md) first — it is the canonical guide** (stack, architecture,
conventions, gotchas, working agreement). Visual work additionally requires
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). This file only adds what is specific to running in
Claude Code. Keep the substance in AGENTS.md so the two don't drift.

## Quick facts

Editorial product page for **Spark StaySphere**, a white-label direct-booking front end for
independent hotels. Vite 8 · React 19 · TS · Tailwind v4 (CSS-configured, **no `tailwind.config.js`**)
· `motion/react` · Lenis · **oxlint** (not ESLint).

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

## Running the app

Start the dev server with the **preview tools**, not Bash: `preview_start` with the
`spark-product` config from [`.claude/launch.json`](.claude/launch.json) (port 5173).

After any visual change, actually verify it: reload, check `read_console_messages` and
`preview_logs` for errors, `read_page` for structure, and screenshot the affected section.
Several sections change layout strategy at `lg` (1024px) — use `resize_window` to check both.
A passing `tsc` is not evidence that a UI change looks right.

## Hard rules worth repeating

- **Type sizes come from the fixed scale only**: 12, 14, 16, 18, 24, 28, 32, 48, 56, 64 px.
  Never an arbitrary `text-[15px]`; never `text-xl`. `text-3xl/4xl/6xl/7xl` are deliberately
  overridden in `src/index.css` to 28/32/56/64 — don't restore Tailwind's defaults.
- **No `tailwind.config.js`.** Tokens live in `:root` + `@theme inline` in `src/index.css`.
- **Every animation needs a `prefers-reduced-motion` path.**
- Screenshots in `public/ui/` are real captures of the live demo — never substitute mocked markup.

## No version control

This directory is **not a git repository**. There is no undo and no diff to fall back on:

- Make surgical edits; don't rewrite whole files when a targeted change will do.
- Never run destructive shell commands (`rm -rf`, bulk overwrites, `sed -i` across the tree
  without first printing the exact matches you intend to change).
- If a change is large or exploratory, say so before making it.
