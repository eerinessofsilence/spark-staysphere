# Troubleshooting

Traps this codebase has already hit — moved here from AGENTS.md so they're easier to search when
you're stuck, rather than buried in a "definition of done" section. Worth skimming once even
before you hit any of them.

## Local dev

**The full e2e suite clicks “Reset seed data”.** Run it only against an isolated test server and state. Pointing `PLAYWRIGHT_PORT` at a developer's active site can change its bookings and CMS data; the suite's reset helper currently checks the button transition, not whether reset succeeded. A targeted spec that does not reset data can run against the active preview when necessary.

**An isolated second dev server may refuse to start while the main preview is running.** It can report “Another vinext dev server is already running” even from a separate temporary checkout and port. Do not point write-heavy e2e tests at the active preview as a workaround; keep its D1 state intact and run them after the preview can be stopped safely.

**A running Vite dev server keeps its dependency pre-bundle.** After adding or removing an npm
package, the server 500s on the stale entry until restarted. Restart it.

**The Vite overlay can show `fetch failed` from `Miniflare.dispatchFetch` while port 3000 still listens.**
This means the local Cloudflare Worker proxy is unavailable, not that a room-rate or holiday
request failed. Confirm `/admin` returns 500 and the stack points to `miniflare`, then restart
Vite without deleting `.wrangler/state`. A healthy unauthenticated `/admin` redirects to
`/admin/sign-in`, and that page returns 200.

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

**The welcome step throws "A React form was unexpectedly submitted".** Do not call
`form.submit()` from an `onSubmit` handler on a React action form: React replaces its action
with a guarded URL after hydration. Keep the submission on `useActionState`, as on Sign In.
The Continue and Skip forms share the action but keep separate fields, so Skip does not send
the selected interests. Disable both buttons while the action is pending.

**Order-detail hydration differed across time zones.** Do not format timestamps with the host's implicit time zone in an SSR client component. The order page serializes its display labels on the server in the demo property's Europe/Nicosia time zone. Its regression test uses America/New_York in the browser. Order rows and ID links use native document navigation to avoid the vinext superseded-navigation abort path; repeated row clicks are guarded.

**Printing a portalled invoice with `visibility: hidden` leaves the page's layout intact.** The fixed modal, its transforms, and scroll containers can push the invoice down and split it across blank pages. Invoice print CSS removes unrelated elements with `display: none`, flattens ancestors into normal flow, and removes height limits and transforms. Check print media at A4 size as well as the screen preview.

**React-PDF columns can overlap even when their percentage widths add to 100%.** A `gap` is added on top of those widths, and long unbroken email addresses can run into the next column. Use zero-basis flex weights and insert explicit line breaks in long identifiers. Register the local Inter font before rendering: PDF's built-in Helvetica does not cover Cyrillic, and a browser page's font styles do not carry into the generated file. Convert an uploaded WebP logo to PNG data before passing it to `Image`.

**A native select with `appearance-none` loses its browser arrow.** A Tailwind arbitrary
`background-image` URL did not render the replacement chevron in the Orders filters. Use
`NativeSelect` with a visible SVG sibling pinned inside a relative wrapper, so the control keeps
native selection behavior and the arrow has a stable position.

**A server-rendered action can look clickable before its client handler hydrates.** For critical
dialog launchers, keep the button disabled until the mount effect runs. Otherwise an immediate
click after navigation can be lost, even though the page and label are already visible.

**A controlled checkbox or select whose state only settles after a server round trip will thrash
under Playwright's `check()`/`selectOption()` retries.** Assert on the server-rendered effect, not
on the control's own value.

**A docked portal has no backdrop to catch outside clicks.** The admin assistant listens for
`pointerdown` while open and ignores its own panel and launcher. Also leave outside clicks to an
active `aria-modal` child dialog, such as its photo library, so dismissing that dialog does not
close the assistant beneath it.

**`<fieldset>`/`<legend>` renders the legend inside the border** and broke the filter panel. Use
`role="group"` with a heading instead — see DESIGN_SYSTEM.md rule 9.

**A date header inside an `overflow-x-auto` rate grid cannot stick to the page vertically.**
That container becomes the header's scroll ancestor on both axes. `StickyRatesGrid` keeps the
header in a page-sticky sibling above the horizontally scrollable body and mirrors their
`scrollLeft` in both directions. On mobile it sticks below the admin phone header (80px), not
under it. Wait for hydration before asserting scroll synchronization in browser tests.

## Demo data

**Holiday-rate suggestions need a trustworthy country calendar.** The admin assistant reads the official Nager.Holidays API by hotel country and year. Local sandboxes may have no outbound DNS; the demo then uses only the explicitly verified Cyprus dates in `lib/infrastructure/nager-public-holidays.ts` for 2026/2027. Other countries show no holiday suggestion when the provider is unavailable, rather than inventing a date. The base-rate editor changes the fallback price for every night; holiday advice must not silently apply a one-day increase through that editor. A separate dated cell can be edited deliberately.

**A dated rate must reach the booking quote, not just the calendar.** The rate plan keeps per-date overrides beside its base price. Every stay-pricing call with known dates passes `checkIn` to `buildPriceBreakdown`; the checkout date is exclusive. When nightly prices differ, the displayed per-night figure is only an average and the room total is the exact sum. Historical invoices use the booked total if current catalog prices no longer reconcile. Browser tests against an active preview open/cancel the inline editor but never save a demo rate.

**Drag-selecting rate prices must not hijack a single click or mobile horizontal scroll.** The rate row waits for movement across at least two dates before opening its bulk dialog; a single click still edits one night. Touch retains normal sideways scrolling and uses the explicit two-tap period control. The inclusive range is validated and saved as one versioned rate overlay, so a conflict cannot leave half its nights changed. Read-only browser tests cancel the dialog on the active preview; the application-service test covers persistence.

**A closed or restricted rate must not silently fall back to a different plan.** Discovery may select another eligible plan for the same room type, but a quote that explicitly requests a plan must retain that identity and return `available: false` if it is closed, deleted, or outside its stay limits. Otherwise a guest could confirm against a different cancellation policy or price. A room with no eligible plan still appears as unavailable, not as a broken room-detail URL. Check-out is not a sellable night when applying close-outs.

**Rate-advice prompts need an actual demand signal.** The admin assistant checks every national public holiday in the hotel's next seven days and uses the country's CLDR weekend days, not a hard-coded Friday/Saturday. Recommendations use confirmed bookings and configured dated prices, not simulated demo availability. Compare the same weekday from prior weeks when possible, skip closed or hidden inventory, and never turn a holiday date alone into a standing popup. Only a same-day, high-demand increase becomes a one-time action toast; suggested percentage changes remain illustrative, not a forecast or automatic price change. Region-only holidays need a stored hotel region before they can be attributed safely.

**The rates-grid review has a wider scope than the assistant toast.** It checks the currently selected date window, including weekdays, and displays conservative percentage examples based on confirmed occupancy. A low-demand weekday needs a meaningful comparable-weekday baseline before suggesting a discount. The review is rule-based, not trained ML, and its links open the manual dated-rate editor; no recommendation writes a price.

**Converting simulated occupancy into a booking must replace its baseline demand.** The original room type and dates remain in the `front-desk-demo:` idempotency key. Both availability adapters credit that original occupancy before subtracting real booking holds. Otherwise opening a stay consumes inventory twice and a free drag target can become occupied before the move. Keep the original credit after a date move or cancellation so the synthetic stay does not reappear.

**Never use `Math.random()` for server-rendered demo status placement.** It makes the UI change on
reload and can make the server and client disagree during hydration. Derive a stable score from
the immutable item id and date instead; the front-desk allocator uses `demoHash` to scatter
simulated demand and closed-to-sale rooms without changing their nightly totals.

## Access control

**Hotelier navigation needs hotel IDs as well as slugs.** Keep `availableHotels`'s `id` when
building property options: role assignments store hotel IDs, while routes and the selection
cookie use slugs. Resolve the selected property against the member's assigned hotels and send
Hotelier sign-ins to `/admin/maintenance`; the default Dashboard requires booking permission.
Maintenance is also available to Owner for all properties. Keep menu visibility separate from
Hotelier notification subscriptions. Check role, active membership, Hotelier hotel assignment,
and housekeeping permission again in server actions and protected photo handlers.

**Housekeeper hints belong to the tablet screen.** Housekeeper sign-in opens `/housekeeper`,
outside the admin shell. Reuse the guided tour with separate steps, replay event, and a
member-scoped completion key; seeing the admin tour must not suppress staff instructions.
The repair form and Maintenance list/detail have their own first-use tours. Their headers
show operational actions, not replay buttons; replay remains available through a direct link.
Opening a tour screen with `?tour=1` replays its hints even after completion; the parameter is
removed when the tour starts, so closing a repair form does not restart the room tour.
Keep the shell tour hidden on Maintenance to avoid overlapping hints. The repair-form tour
uses a modal popover so the underlying sheet leaves keyboard handling to the hints.
Set `aria-modal` on that popover and cycle Tab between the hint buttons: Base UI's focus guards
alone can leave focus on a guard inside the custom sheet. Handle the popover's Escape close
request explicitly; ignore outside-click close requests so the replay button's click does
not immediately dismiss a newly opened tour.
Repair status is read separately from cleaning status and is scoped to the reporter's currently
assigned rooms. If polling fails, keep the last result with a stale-status message.

**An issue-save error can arrive after the database committed.** Maintenance saves use a
reporter-and-hotel-scoped idempotency key. Look up that key before deleting uploaded evidence;
keep it if the database outcome cannot be established. An in-memory fallback cannot stand in
for durable issue and notification storage.

**Maintenance demo rows are separate from reports.** Development adds labelled examples through
the process-local mock store. Their status edits reset when the server restarts; their generated,
labelled sample photos use separate public demo URLs, with no real evidence or notifications.
Real reports still use durable issue storage and private
photo storage, and a failed durable read must remain an error rather than a demo fallback.

**Adding maintenance photos must preserve existing evidence.** Use the shared upload dropzone
with private issue storage, not the public CMS media library. Attachment IDs stay stable for
an upload retry, while each attempt uses its own object keys so concurrent retries cannot
overwrite the saved photo. The D1 batch checks capacity before inserting the first attachment;
never exceed five uploaded photos. On an uncertain commit, read back references before cleaning
up objects, and retain them if that read fails. Grid thumbnails are fixed circles; detail
evidence is displayed uncropped in a rectangular frame.

**Replacement approval is separate from fixing an issue.** Persist the request and its Hotelier
notifications in one D1 batch. A request ID guards notice insertion when submissions race;
reading the notification does not approve it. Only an active Hotelier assigned to that hotel,
with housekeeping permission, can approve. Both the service and the D1 status update prevent
marking an issue fixed while replacement approval is pending. Demo examples retain process-local
approval state and never send real notifications.

**An editable administrator role must retain the permission that repairs role grants.** If the
owner can remove `team.permTeamRoles` from itself, the save succeeds and every later role mutation
is denied, including the one needed to undo the mistake. Enforce this as a service invariant when
both reading old overrides and writing new ones; disabling the checkbox in the UI is only the
explanation, not the security boundary.

## Mobile viewport

**The assistant launcher can cover the last row on narrow screens.** Below `lg` the
64px button sits 88px above the bottom safe area. `AdminPage` needs 176px plus that
safe area of bottom padding so the last row can scroll above it; the desktop
112px clearance is insufficient. Keep the padding breakpoint aligned with the launcher.

**An anchored guest popover can open below the visible tablet viewport.** The date and guest
panels portal to `document.body`, so their desktop/tablet `top` must be calculated from the
trigger's viewport rect and the rendered panel height. Prefer below, flip above when it fits,
and otherwise clamp inside the viewport with internal scrolling. Re-measure after the portal
renders, not only when the opening state changes. Mobile audit tests cover short 320/390px
screens and a tablet viewport; measure dialog bounds after the entry animation settles.

**On Android Chrome the layout viewport widens to the document's overflow**, so a page that
overflows by even 17px renders zoomed out. Two causes seen here:
- A horizontally scrolling row whose min-content inflated an `auto` grid column. Fix:
  `grid-cols-[minmax(0,1fr)]` + `min-w-0`, and `contain-inline-size` on the scroll row.
- `sr-only` labels inside a table escaping their `overflow-x-auto` wrapper because it wasn't
  positioned. Fix: make the wrapper `relative`.

Guest E2E measures `innerWidth` at 390px on every route in `../../guest/e2e/golden-path.spec.ts` to keep this from
regressing — if you add a route, it's covered automatically.

## Interactive stages (drag, pointer capture)

**Calling `setPointerCapture` on pointerdown inside an interactive stage retargets pointerup** and
silently kills clicks on child buttons. Capture only once a drag threshold is crossed — see
`components/view-360/building-spinner/use-orbit.ts` for the working pattern.

## D1

**`D1Database.exec()` splits its input on `\n`, not `;`** — a multi-line `CREATE TABLE` silently
breaks into unparsable fragments. Use `batch()` with one prepared statement per line instead — see
`lib/infrastructure/d1-schema.ts`'s own comment on this.

**`CREATE TABLE IF NOT EXISTS` does not add fields to an existing table.** The stay-time flags
need a guarded `PRAGMA table_info` check and `ALTER TABLE` for previews that already created
`booking_stay_times`. Keep that migration in `ensureSchema()` before any booking SELECT reads
the new fields.

**A `db.batch()` call is one implicit transaction, but its statements can't branch on each
other's results in JS.** If a later statement in the batch needs to know whether an earlier one in
the *same* batch actually changed a row (e.g. crediting inventory only if a booking insert wasn't
a replay), gate it in SQL — either `WHERE EXISTS (SELECT 1 FROM … WHERE id = ?)` against something
unique to *this* call, or `changes() > 0` if there's exactly one dependent statement right after
it (chaining more than one after `changes()` breaks, since each statement resets it). See
`saveBooking`/`cancelBooking` in `lib/infrastructure/d1-hotel-repository.ts` for both patterns,
each with a comment on which one and why.

## Playwright waits

**Guest e2e needs its PMS URL in the Worker binding.** The combined test launcher passes
`PMS_API_URL` to Vite, which must forward it through the Cloudflare plugin's local `vars`.
Without that binding the Worker can fall back to a developer's PMS on port 3001, even when
the test launcher started an isolated PMS elsewhere. Keep proxy ports tied to
`PLAYWRIGHT_PORT`, preserve the incoming Host header for server actions, and let Playwright
terminate the combined launcher with SIGTERM so it can stop its detached child servers.

**Waiting on page content that's already true before an action's server round trip finishes**
(e.g. "No bookings yet" when the suite never creates one) lets `actUntil` return before that round
trip is actually done — a `page.goto` right after can then race or cancel it. Wait on a signal
that only becomes true *once the action itself resolves* (a button's own disabled → enabled round
trip, a `role="status"` message change), not on content the action happens not to touch.

## Something not here?

**Passport OCR assets missing after adding the dependency.** Run
`node scripts/prepare-document-ocr.mjs` (also run automatically by install/dev/build).
The scanner serves its worker, WASM and trained data locally from `public/vendor/document-ocr`;
it does not fall back to a CDN. Recognition failure still opens editable review fields.

**A passport photo produces empty or corrupted fields although OCR ran.** Whole-photo OCR can
misread MRZ filler characters and omit rows among bilingual labels. The scanner retries a
contrast-enhanced MRZ crop with a restricted alphabet, then sparse text. The parser accepts
clipped trailing fillers and checks numeric fields, and prefers printed names over corrupted
repeated-letter tails. An unreadable result is reported above the review fields.

**Tesseract initialization hangs on a missing language file.** Its language-load rejection does
not always reject `createWorker()`. The scanner checks the local trained data before creating
the worker, forwards worker failures, and bounds recognition with a timeout.

**Front-desk e2e cannot open Add booking.** The first-visit admin tour can intercept the click.
Scanner tests mark `admin-tour.seen.v1` in their own browser context before navigation.

**A front-desk drag appears to do nothing just after navigation.** The board is server-rendered before
React attaches its pointer and drag handlers. Native `draggable` must stay disabled until the board
sets `data-front-desk-interactive="true"`; browser tests should wait for that marker before gestures.
When resizing a draggable booking, disable native dragging for the active pointer gesture so it
cannot consume pointer moves intended for the resize preview.

**A D1 booking mutation fails with `malformed JSON`.** Count every SQL placeholder against the
arguments passed to `.bind()`, especially when the same `json_each(?)` input appears twice. A
missing array argument can bind a booking ID as JSON and fail the entire batch. Exercise the real
D1 statement through `lib/infrastructure/libsql-d1.test.ts` before relying on an in-memory mock.

**A sold-out room type becomes a wall of full-window blocks on the front desk.** Availability
overrides still make every affected night unavailable, but `getFrontDesk()` scatters short
out-of-order demo markers across absolute dates and rooms when drawing the board. The other
unavailable nights render as simulated occupancy. Keep this display step separate from the
allocator used by quotes and room moves, so a visual change cannot make a blocked room bookable.

**Passport upload unavailable while CMS uploads work.** Identity documents use the separate
`PRIVATE_DOCUMENTS` R2 binding (or a private Blob store on Vercel). The public MEDIA adapter is
intentionally not a fallback. See `docs/GUEST_DOCUMENTS.md` for host configuration and retries.

**Nested modals must give keyboard handling to the topmost dialog.** The passport review uses
the shared Modal inside Add Booking. Only the last open dialog handles Escape and focus trapping,
so closing the scanner does not also discard the booking underneath it.

Check TESTING.md for e2e-specific issues, or AGENTS.md for working rules that might explain an
unexpected refusal (never touching `.env`, never scraping a partner site, etc). If you hit and fix
something that isn't listed above, add it here — that's the whole point of this page.

**An email appears in Communications but the guest received nothing.** A thread records the
outbound message before carrier delivery. Check the per-message status: `Demo only — not sent`
means the Resend key or verified sender is absent; `Delivery failed` means the provider call
failed; `Accepted by email provider` means only that Resend accepted the request, not that the
guest's mailbox received it. Historical messages have an unknown status. Configure both
`RESEND_API_KEY` and `RESEND_FROM_EMAIL` privately before expecting real mail. Existing demo
messages are not replayed automatically after configuration.
