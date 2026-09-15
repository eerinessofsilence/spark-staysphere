# Testing

Two suites, for two different jobs. Neither replaces the other.

## Unit tests (vitest) — `npm run test`

```
lib/domain/**/*.test.ts
```

For pure logic: a function of its inputs, no server, no browser, no D1, usually no mocks at all.
`lib/domain/pricing.test.ts` is the model to copy — small fixture-builder functions
(`ratePlan(overrides)`, `addOn(overrides)`), and assertions on exact numbers, not "it changed" or
"it didn't throw."

Config is `vitest.config.ts`, deliberately **not** the same file as `vite.config.ts` (the app's own
build config). That one is async, loads the Cloudflare Workers plugin, and reads
`.openai/hosting.json` — none of which a plain Node unit test needs or should depend on.
`vitest.config.ts` is a bare Node environment with the same `@/` path alias.

**What belongs here:** anything in `lib/domain/` — pricing math, date math, room allocation,
catalog merging, slug rules. If you're about to test a `lib/application/` service, check whether
the rule you actually care about can be pulled into a pure `lib/domain/` function first; it's
easier to test and easier to reuse.

**What doesn't (yet):** `lib/application/` services need a fake `HotelRepository` (or one of its
narrower slices — see ARCHITECTURE.md) to test in isolation. None exist yet; if you write one,
this is where the pattern should start. `Clock` (see HOWTO.md's "Add a domain rule" section) is
what makes a service's date-dependent behavior — cancellation eligibility, "upcoming" filters —
testable without real wall-clock time.

## End-to-end tests (Playwright) — `npm run test:e2e`

```
e2e/assistant.spec.ts    — the AI room finder
e2e/cabinet.spec.ts      — floor plan, tape chart, the bookings desk (serial)
e2e/cms.spec.ts          — /admin/content (serial)
e2e/golden-path.spec.ts  — the guest journey end to end, 1440px and 390px
e2e/inventory.spec.ts    — booking an exact room over the API
```

Runs against a real dev server (`playwright.config.ts` starts `vinext dev` on port 3100) and real
local D1 — not a mock. Two things follow from that, both worth knowing before your first debugging
session against a red test:

**State is shared and accumulates.** All five specs run in one worker (`workers: 1`,
`fullyParallel: false`) against the *same* dev server and the *same* D1 database. `cabinet.spec.ts`
and `cms.spec.ts` mark themselves `test.describe.configure({ mode: 'serial' })` and reset demo
state as their first test; `golden-path.spec.ts` resets in its first test too, with a comment
explaining why it has to run first. If you add a new spec file, decide up front whether it depends
on a clean slate, and reset explicitly if so — don't assume one.

**A stray D1 file from an earlier run can make an unrelated spec flaky.** `.wrangler/state` (the
local D1 database) persists across `npm run dev` and `npm run test:e2e` runs alike. If
`inventory.spec.ts` fails with a 409 that looks like exhausted availability, run it by itself first
(`npx playwright test e2e/inventory.spec.ts`) before assuming it's a real regression — this exact
thing happened during this project's own recent refactor and turned out to be accumulated state
from repeated manual runs in the same session, not a bug.

**Reset D1 between runs** with the "Reset demo state" button on `/admin`, or by deleting
`.wrangler/state` (it's gitignored and gets rebuilt automatically).

**The dev server can go stale.** If e2e suddenly can't connect (`ERR_CONNECTION_REFUSED`) after it
was working moments ago, the dev server process from an earlier run is probably still bound to
port 3100 in a bad state — kill whatever's listening on it (`lsof -ti:3100 | xargs kill`) and
re-run; Playwright starts a fresh one.

**`actUntil`** (defined once per spec file — yes, copied four times, a known duplication) waits for
a click's server-round-trip effect rather than a fixed delay: a server-rendered island's click
handler isn't attached until React hydrates it, so a bare `.click()` can be lost. Reuse the pattern
in whichever spec you're extending, and see AGENTS.md/TROUBLESHOOTING.md for the related trap about
waiting on the *wrong* signal (content that was already true before the action, not something only
the action itself changes).

**First run:** `npx playwright install chromium` once.

## Which one do I write?

- Changing a pricing/date/allocation rule → a vitest unit test in `lib/domain`.
- Changing what a page shows, or a multi-step flow (booking, a CMS save) → extend the relevant e2e
  spec.
- Both, if the change is a domain rule with real user-facing consequences: the unit test pins the
  exact numbers, the e2e test proves the page actually shows them.
