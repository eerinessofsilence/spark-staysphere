# Contributing

The canonical place to look for "how do I contribute here." AGENTS.md and CLAUDE.md carry their
own short copies of the commit convention below too — they're instruction files an AI agent reads
directly and need to stand on their own — but this page is where a human should start, and where
the full reasoning lives.

## Before you start

Read `docs/ONBOARDING.md` if you haven't — it's a five-minute path through the rest of this
project's documentation, including a guided trace of one booking through the whole stack.

## Commits

Always write [Conventional Commits](https://www.conventionalcommits.org/) — never a bare, generic
message like "update files" or "fix stuff." This applies to every commit in this repository, not
just feature work.

```
type(scope): summary
```

- Imperative mood: `fix(booking-service): recheck price before confirming`, not "fixed" or
  "fixes".
- Common types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`, `style`.
- `scope` is usually the file, module, or feature the change centers on — not required, but
  helpful when the summary alone doesn't say where to look.
- Add a body when the *why* isn't obvious from the diff. Most of this project's own history does
  this — look at `git log` for the tone: explain the reasoning and any trade-off, not just what
  changed.

## Branches

Nothing enforces this, but the project's own branches (`feat/building-spinner`,
`feat/extras-catalog`, `feat/night-scheme-3d-facade-redesign`) follow `type/kebab-case-summary` —
the same `type` vocabulary as the commit convention above. Branch off `main`; a lot of this
project's own history is also short sessions committing straight to `main`, but branching first is
the safer default for a change you're opening a PR for.

## Before you open a PR

CI (`.github/workflows/ci.yml`) runs typecheck, vitest, lint, build, the doc-reference check, and
the e2e suite on every PR — you don't have to run everything locally first, but it's faster to
catch a failure before pushing:

```bash
npm run typecheck
npm run test          # vitest — if you touched lib/domain
npm run lint
npm run build
npm run check:docs    # fails if a doc names a file that no longer exists
npm run test:e2e      # if you touched a guest or admin flow
```

Include loading, empty, error, unavailable, and success states for any new flow. Never claim an
integration is live when it's mocked — every screen with nothing real behind it says so on screen
(see TECH.md's "Back office" table for the current examples).

**If you changed a rule, update the doc that states it.** A rule enshrined in DESIGN_SYSTEM.md, a
number in TECH.md, or a "what is real" claim in README.md that the code no longer matches is
exactly the kind of drift this project's own docs review (this session) went and fixed after the
fact — cheaper to keep current as you go than to audit later. If you're not sure which doc owns a
given fact, `docs/README.md` says which file is for what.

## Working rules that aren't optional

The short version — AGENTS.md has the full list:

- Never read, print, or commit `.env` or `.dev.vars`. Real secrets never leave the local machine.
- Preserve user changes; never reset, delete, or overwrite unrelated work.
- Official PMS/channel-manager/partner APIs only — never scrape a partner site.
- Payment stays demo-only until real provider credentials and production authorization exist.
  Never collect raw card data.
- `lib/application/container.ts` is the only module allowed to import `lib/infrastructure` — see
  `docs/ARCHITECTURE.md`.
