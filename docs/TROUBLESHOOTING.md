# Troubleshooting

Traps this codebase has already hit — moved here from AGENTS.md so they're easier to search when
you're stuck, rather than buried in a "definition of done" section. Worth skimming once even
before you hit any of them.

## Local dev

**A running `vinext dev` keeps Vite's dependency pre-bundle.** After adding or removing an npm
package, the server 500s on the stale entry until restarted. Restart it.

**e2e can't connect (`ERR_CONNECTION_REFUSED`).** The dev server from an earlier run is probably
still bound to port 3100 in a bad state. `lsof -ti:3100 | xargs kill`, then re-run — Playwright
starts a fresh one. See TESTING.md for more on the e2e suite's shared state.

**`inventory.spec.ts` fails with an unexpected 409.** Local D1 state accumulates across runs
(`.wrangler/state` persists). Run the spec by itself first before assuming it's a real regression
— see TESTING.md.

## Server Components and the client boundary

**A Server Component can't pass a plain function to a Client Component** — only a `'use server'`
action, or data. `<OrderedStringList iconFor={someHelper}>` throws "Functions cannot be passed
directly to Client Components" the moment the parent rendering it is a Server Component. Fix:
either have the client component import the helper itself, or only ever pass the function from
another *client* component (a function prop crossing the RSC boundary client-to-client is fine).

**Every export of a `'use client'` file is a client reference — a plain helper function included,
not just its components.** A Server Component that imports one and *calls* it directly (not as
JSX) throws "Unexpectedly client reference export '…' is called on server" at render time. Neither
`tsc` nor `oxlint` catches this — only an actual page render does (this project's own docs
cleanup this session shipped it broken for exactly that reason, caught by the e2e suite). Fix: put
the plain function in a module with no `'use client'` at the top. It needs one only if it actually
uses hooks or a browser API — see `components/admin/content/label-options.tsx` for the pattern
(pulled out of `fields.tsx`, which is `'use client'`, for exactly this reason).

**`env` bindings from `cloudflare:workers` are only reliable once a request is in flight.**
Resolve them (`getDemoDatabase()`, `getOpenAiKey()`, both in `lib/infrastructure/cloudflare-env.ts`)
inside the function that needs them — never cache the result at module scope, or you'll cache
`null` from before the binding was ready.

## Forms and controls

**A controlled checkbox or select whose state only settles after a server round trip will thrash
under Playwright's `check()`/`selectOption()` retries.** Assert on the server-rendered effect, not
on the control's own value.

**`<fieldset>`/`<legend>` renders the legend inside the border** and broke the filter panel. Use
`role="group"` with a heading instead — see DESIGN_SYSTEM.md rule 9.

## Mobile viewport

**On Android Chrome the layout viewport widens to the document's overflow**, so a page that
overflows by even 17px renders zoomed out. Two causes seen here:
- A horizontally scrolling row whose min-content inflated an `auto` grid column. Fix:
  `grid-cols-[minmax(0,1fr)]` + `min-w-0`, and `contain-inline-size` on the scroll row.
- `sr-only` labels inside a table escaping their `overflow-x-auto` wrapper because it wasn't
  positioned. Fix: make the wrapper `relative`.

`e2e` measures `innerWidth` at 390px on every route in `golden-path.spec.ts` to keep this from
regressing — if you add a route, it's covered automatically.

## Interactive stages (drag, pointer capture)

**Calling `setPointerCapture` on pointerdown inside an interactive stage retargets pointerup** and
silently kills clicks on child buttons. Capture only once a drag threshold is crossed — see
`components/hotel/building-spinner.tsx` for the working pattern.

## D1

**`D1Database.exec()` splits its input on `\n`, not `;`** — a multi-line `CREATE TABLE` silently
breaks into unparsable fragments. Use `batch()` with one prepared statement per line instead — see
`lib/infrastructure/d1-schema.ts`'s own comment on this.

**A `db.batch()` call is one implicit transaction, but its statements can't branch on each
other's results in JS.** If a later statement in the batch needs to know whether an earlier one in
the *same* batch actually changed a row (e.g. crediting inventory only if a booking insert wasn't
a replay), gate it in SQL — either `WHERE EXISTS (SELECT 1 FROM … WHERE id = ?)` against something
unique to *this* call, or `changes() > 0` if there's exactly one dependent statement right after
it (chaining more than one after `changes()` breaks, since each statement resets it). See
`saveBooking`/`cancelBooking` in `lib/infrastructure/d1-hotel-repository.ts` for both patterns,
each with a comment on which one and why.

## Playwright waits

**Waiting on page content that's already true before an action's server round trip finishes**
(e.g. "No bookings yet" when the suite never creates one) lets `actUntil` return before that round
trip is actually done — a `page.goto` right after can then race or cancel it. Wait on a signal
that only becomes true *once the action itself resolves* (a button's own disabled → enabled round
trip, a `role="status"` message change), not on content the action happens not to touch.

## Something not here?

Check TESTING.md for e2e-specific issues, or AGENTS.md for working rules that might explain an
unexpected refusal (never touching `.env`, never scraping a partner site, etc). If you hit and fix
something that isn't listed above, add it here — that's the whole point of this page.
