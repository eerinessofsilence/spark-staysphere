import { expect, test, type Locator, type Page } from '@playwright/test';
import { parseFilters } from '../lib/application/search-params';

/**
 * The golden path: arrival → search → detail → booking → confirmation.
 * PMS owns hotel data and booking state; Guest exercises those flows through
 * its public API boundary.
 */

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const stayOffset = 45 + (Math.floor(Date.now() / 1000) % 3000);
const checkIn = isoDaysFromNow(stayOffset);
const checkOut = isoDaysFromNow(stayOffset + 3);
const stayQuery = `checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`;

/**
 * Filters are an inline sidebar on desktop and a bottom sheet on mobile. While
 * the sheet is open the results behind it are inert, so it is closed again
 * before anything about the result list is asserted.
 */
async function withFilters(page: Page, body: () => Promise<void>) {
  const trigger = page.getByRole('button', { name: /^Filters/ });
  const asSheet = await trigger.isVisible();
  const sheet = page.getByRole('dialog');

  if (asSheet) {
    await actUntil(
      () => trigger.click(),
      () => expect(sheet).toBeVisible({ timeout: 3_000 }),
    );
  }

  await body();

  if (asSheet) {
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  }
}

/**
 * A click on a server-rendered island is lost until React attaches its
 * listeners, so retry the interaction until its effect actually lands.
 */
async function actUntil(act: () => Promise<void>, effect: () => Promise<void>) {
  await expect(async () => {
    await act();
    await effect();
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] });
}

/**
 * Filter chips and add-on checkboxes settle only after the server re-renders,
 * so a blind retry would toggle them straight back. Guard on the current state.
 */
async function toggle(box: Locator, expected: 'true' | 'false') {
  const attribute = (await box.getAttribute('role')) === 'checkbox' ? 'aria-checked' : 'aria-pressed';
  await actUntil(
    async () => {
      if ((await box.getAttribute(attribute)) !== expected) {
        // Centre the control first: on phones a fixed booking bar rides the
        // bottom edge and would otherwise intercept a click at the viewport edge.
        await box.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await box.click();
      }
    },
    () => expect(box).toHaveAttribute(attribute, expected, { timeout: 3_000 }),
  );
}

/**
 * The shortest path to a real reference, for tests about what happens *after*
 * a booking. The golden-path test above walks the flow properly and asserts on
 * each step; this only needs the booking to exist. The first card of a
 * sold-out-hidden catalog is used because demo inventory is finite — a
 * hard-coded room runs out as the suite is re-run against one server.
 */
async function bookAStay(
  page: Page,
  injectedFailure?: { arm: () => Promise<void>; assertFailure: () => Promise<void>; retry?: boolean },
  chooseExactRoom = false,
): Promise<string> {
  await page.goto(`/rooms?${stayQuery}&hideSoldOut=1`);
  const card = page.getByRole('region', { name: 'Search results' }).locator('article').first();
  const roomName = (await card.getByRole('heading').innerText()).trim();
  await card.getByRole('link', { name: roomName }).click();
  await page
    .getByRole('complementary', { name: 'Your stay' })
    .getByRole('link', { name: 'Book this room' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Complete your stay' })).toBeVisible();
  if (chooseExactRoom) {
    const response = await page.request.post(`http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 1}/api/public/catalog`, { data: {
      operation: 'floor-plan', hotelSlug: 'asteria-cove',
      criteria: { checkIn, checkOut, adults: 2, children: 0 }, filters: parseFilters({}),
    } });
    expect(response.ok()).toBeTruthy();
    const { plan } = await response.json();
    const slug = new URL(page.url()).pathname.split('/').at(-1);
    const unit = plan.units.find((candidate: { roomSlug: string; status: string }) =>
      candidate.roomSlug === slug && candidate.status === 'available');
    expect(unit, 'a physical room is available for the cancellation scenario').toBeTruthy();
    const url = new URL(page.url());
    url.searchParams.set('room', unit.number);
    await page.goto(url.href);
  }

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lindqvist');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Phone').fill('91 555 0117');
  await page.getByRole('button', { name: 'Continue' }).click();

  await toggle(page.getByRole('checkbox', { name: /I understand this is a booking at a fictional property/ }), 'true');
  await page.getByRole('button', { name: 'Continue' }).click();
  if (injectedFailure) await injectedFailure.arm();
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  if (injectedFailure) {
    await injectedFailure.assertFailure();
    if (injectedFailure.retry === false) return '';
    await page.getByRole('button', { name: 'Confirm booking' }).click();
  }
  await expect(page).toHaveURL(/\/booking\/[A-Z0-9]{6}$/, { timeout: 20_000 });

  return (await page.getByText(/^[A-Z0-9]{6}$/).first().innerText()).trim();
}

test('a lost PMS response can be retried once with the same idempotency key', async ({ page, request }) => {
  await bookAStay(page, {
    arm: async () => {
      await request.post(`http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 101}/fault`, { data: { mode: 'lose-response' } });
    },
    assertFailure: async () => {
      await expect(page.getByRole('alert')).toContainText('Please try again.');
      await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeEnabled();
    },
  });
  const stats = await (await request.get(`http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 101}/stats`)).json();
  expect(stats.bookingKeys).toHaveLength(2);
  expect(stats.bookingKeys[0]).toBeTruthy();
  expect(stats.bookingKeys[1]).toBe(stats.bookingKeys[0]);
});

test('a changed price is shown before the guest confirms the new amount', async ({ page, request }) => {
  const changedTotal = 999;
  await bookAStay(page, {
    arm: async () => {
      await request.post(`http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 101}/fault`, { data: {
        mode: 'status', status: 409, body: { error: 'price_changed', message: 'The price changed.', currentTotal: changedTotal },
      } });
    },
    assertFailure: async () => {
      await expect(page.getByRole('alert')).toContainText(/price.*changed/i);
      await expect(page.getByRole('alert')).toContainText('€999');
      await expect(page.getByRole('complementary').locator('.text-display').last()).toContainText('999');
      await expect(page.getByRole('button', { name: 'Confirm booking' })).toBeEnabled();
    },
    retry: false,
  });
  const stats = await (await request.get(`http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 101}/stats`)).json();
  expect(stats.bookingKeys).toHaveLength(1);
});

/** The header menu is a hydrated island: a click before React attaches is lost. */
async function openMenu(page: Page) {
  await actUntil(
    () => page.getByRole('button', { name: 'Menu', exact: true }).click(),
    () => expect(page.getByRole('radio', { name: 'Light' })).toBeVisible({ timeout: 3_000 }),
  );
}

/**
 * Extras are bought through their own panel now: the card opens it, the extras
 * are ticked inside, and one button commits the lot. `extras` names the ones to
 * add along with the thing itself.
 */
async function addExtra(page: Page, name: RegExp, extras: RegExp[] = []) {
  await actUntil(
    async () => {
      const card = page.getByRole('button', { name: new RegExp(`Open .*${name.source}`, 'i') }).first();
      await card.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await card.click();
    },
    () => expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 }),
  );

  const panel = page.getByRole('dialog');
  for (const extra of extras) {
    await toggle(panel.getByRole('checkbox', { name: extra }), 'true');
  }
  await panel.getByRole('button', { name: /Add to your stay|Save changes/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('no route overflows the phone viewport', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Only meaningful at the phone width');

  // A booking's own page is one of the widest public screens. Demo inventory
  // is finite, so take the first room type that still has a room.
  let reference = '';
  for (const roomSlug of ['deluxe-sea', 'coastal-twin', 'sea-view-room', 'city-view-room', 'garden-studio']) {
    const stay = { roomSlug, checkIn, checkOut, adults: 2, children: 0, addOnIds: [] };
    const quoted = await (await request.post('/api/quotes', { data: stay })).json();
    const booked = await request.post('/api/bookings', {
      headers: { 'Idempotency-Key': `overflow-${roomSlug}-${Date.now()}` },
      data: {
        ...stay,
        guest: { firstName: 'Ada', lastName: 'Lindqvist', email: 'ada@example.com', phone: '91 555 0117' },
        expectedTotal: (quoted.quote ?? quoted).price.total,
      },
    });
    if (booked.status() === 409) continue;
    expect(booked.status(), await booked.text()).toBe(201);
    reference = (await booked.json()).booking.reference;
    break;
  }
  expect(reference, 'No room type had a room free for the test stay').not.toBe('');

  for (const path of [
    '/',
    `/rooms?${stayQuery}`,
    `/rooms?layout=plan&${stayQuery}`,
    `/rooms/deluxe-sea?${stayQuery}`,
    `/book/deluxe-sea?${stayQuery}`,
    `/booking/${reference}`,
    '/trips',
    '/services/menu',
  ]) {
    await page.goto(path);
    // Android Chrome widens the layout viewport to any overflow, which shows up here.
    expect(await page.evaluate(() => window.innerWidth), path).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(390);
  }
});

test('the arrival screen turns the building and its hotspots lead into the catalog', async ({
  page,
}) => {
  await page.goto(`/?${stayQuery}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Asteria Cove' })).toBeVisible();
  const scene = page.getByRole('group', { name: /drag or use the arrow keys to spin/ });
  await expect(scene).toBeVisible();

  // A hotspot only exists across the frames where the thing it names faces the
  // camera, so the marker is the proof the orbit is on a frame that shows it.
  const seaViewHotspot = scene.getByRole('button', { name: /Sea-view rooms/ });
  await expect(seaViewHotspot).toBeVisible();

  // The whole card is the link — pressing the marker opens it, and its call to
  // action is inside it.
  const card = page.getByRole('link', { name: /See sea-view rooms/ });
  await actUntil(
    async () => {
      if (!(await card.isVisible())) await seaViewHotspot.click();
    },
    () => expect(card).toBeVisible({ timeout: 3_000 }),
  );

  await card.click();
  // The dates the guest arrived with come along, the same as every other link
  // out of the arrival screen.
  await expect(page).toHaveURL(new RegExp(`/rooms\\?.*view=sea.*checkIn=${checkIn}`));
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your room' })).toBeVisible();
});

test('the building opens on a deep-linked frame and turns to its next stop from the controls', async ({ page }) => {
  await page.goto(`/?${stayQuery}&frame=40`);
  await expect(page.getByRole('group', { name: /drag or use the arrow keys to spin/ })).toBeVisible();
  // The frame in the address is where the orbit opens, and the address keeps it.
  await expect(page).toHaveURL(/[?&]frame=40(&|$)/);

  const frame = () => new URL(page.url()).searchParams.get('frame');
  await actUntil(
    () => page.getByRole('button', { name: 'Turn right' }).click(),
    () => expect.poll(frame, { timeout: 3_000 }).not.toBe('40'),
  );
  // The dates the guest arrived with are still in the address after the turn.
  expect(new URL(page.url()).searchParams.get('checkIn')).toBe(checkIn);
});

test('the arrival page offers the rest of the rooms on the way out', async ({ page }) => {
  await page.goto(`/?${stayQuery}`);

  const strip = page.getByRole('region', { name: 'The other rooms' });
  await expect(strip).toBeVisible();

  // The recommendation block above shows three; the strip carries the remainder.
  const tiles = strip.getByRole('listitem');
  expect(await tiles.count()).toBeGreaterThan(0);

  const first = tiles.first().getByRole('link');
  const name = (await first.getByRole('heading').innerText()).trim();
  await first.click();

  await expect(page).toHaveURL(new RegExp(`/rooms/[^?]+\\?.*checkIn=${checkIn}`));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
});

test('the date picker sets the stay as one range', async ({ page }) => {
  await page.goto(`/?${stayQuery}`);

  const openCheckIn = page.getByRole('button', { name: /^Check-in/ });
  const panel = page.getByRole('dialog', { name: 'Choose your dates' });
  await actUntil(
    () => openCheckIn.click(),
    () => expect(panel).toBeVisible({ timeout: 3_000 }),
  );

  // Two months are shown on desktop and one on a phone, so both ends are taken
  // from the month that is on screen either way.
  const days = panel.locator('table').first().locator('td button:not([disabled])');
  const count = await days.count();
  const from = days.nth(count - 6);
  const to = days.nth(count - 2);
  const fromLabel = (await from.getAttribute('aria-label'))!;
  const toLabel = (await to.getAttribute('aria-label'))!;

  // The first click arms check-in; the panel then asks for the other end.
  await from.click();
  await expect(panel.locator('div[role="status"]')).toBeHidden();

  // A later day closes the range, which commits it and dismisses the panel.
  await to.click();
  await expect(panel).toBeHidden();
  await expect(openCheckIn).toContainText(fromLabel);
  await expect(page.getByRole('button', { name: /^Check-out/ })).toContainText(toLabel);

  await page.getByRole('button', { name: 'Search rooms' }).click();
  await expect(page).toHaveURL(/checkIn=\d{4}-\d{2}-\d{2}&checkOut=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByText(`${fromLabel} → ${toLabel}`).first()).toBeVisible();
});

test('the catalog filters, sorts, and recovers from an empty result', async ({ page }) => {
  await page.goto(`/rooms?${stayQuery}`);

  const results = page.getByRole('region', { name: 'Search results' });
  const cards = results.locator('article');
  // `count()` doesn't wait: on a cold server it would count the loading screen.
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(3);

  await withFilters(page, () =>
    toggle(page.getByRole('button', { name: 'Sea view', exact: true }), 'true'),
  );
  await expect(page).toHaveURL(/view=sea/);
  // Fewer cards, and every one of them a sea view — not a fixed number, so
  // the catalog can grow without this test needing to know how many.
  await expect.poll(() => cards.count()).toBeLessThan(initialCount);
  // A grid tile carries the price and the size; the row is the layout that
  // spells the view out, so "every result is a sea view" is read there.
  await page.goto(`/rooms?${stayQuery}&view=sea&layout=list`);
  for (const text of await cards.allInnerTexts()) expect(text).toContain('Sea view');
  await page.goBack();
  await expect(page).toHaveURL(/view=sea/);

  await withFilters(page, () =>
    toggle(page.getByRole('button', { name: 'Sea view', exact: true }), 'false'),
  );
  await expect(cards).toHaveCount(initialCount);

  // A filter combination with no matches must offer a way back.
  await page.goto(`/rooms?${stayQuery}&view=garden&minArea=100`);
  await expect(page.getByRole('heading', { name: 'No rooms match those filters' })).toBeVisible();

  await page.getByRole('link', { name: 'Reset filters' }).click();
  await expect(cards.first()).toBeVisible();

  // Sorting is server-side and reorders the cards.
  await page.goto(`/rooms?${stayQuery}&sort=price_asc&hideSoldOut=1`);
  const prices = await results.locator('article .text-display').allInnerTexts();
  const numbers = prices.map((text) => Number(text.replace(/[^\d.]/g, ''))).filter(Boolean);
  expect(numbers.length).toBeGreaterThan(1);
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
});

test('a room detail page reprices when a service is added', async ({ page }) => {
  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Deluxe Sea View' })).toBeVisible();

  const summary = page.getByRole('complementary', { name: 'Your stay' });
  const totalBefore = await summary.locator('.text-display').last().innerText();

  // The ritual, and the longer version of it picked inside its own panel.
  await addExtra(page, /Spa ritual/, [/Extend to 90 minutes/]);
  await expect(page).toHaveURL(/addOn=addon_spa/);
  await expect(page).toHaveURL(/addOn=addon_spa_longer/);
  await expect(summary.getByText('Spa ritual')).toBeVisible();
  await expect(summary.getByText('Extend to 90 minutes')).toBeVisible();

  const totalAfter = await summary.locator('.text-display').last().innerText();
  expect(totalAfter).not.toEqual(totalBefore);

  // The gallery tabs swap the photograph without leaving the page.
  await page.getByRole('tab', { name: 'Bathroom' }).click();
  await expect(page.getByRole('tab', { name: 'Bathroom' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('img', { name: /Bathroom/ })).toBeVisible();
});

test('a click on the stage mid-turn still lets the building finish on its stop', async ({ page }) => {
  await page.goto(`/?${stayQuery}&frame=95`);
  await expect(page.getByRole('group', { name: /drag or use the arrow keys to spin/ })).toBeVisible();

  const frame = () => new URL(page.url()).searchParams.get('frame');
  await actUntil(
    () => page.getByRole('button', { name: 'Turn right' }).click(),
    () => expect.poll(frame, { timeout: 3_000 }).not.toBe('95'),
  );
  // A near miss on the turn controls lands on the stage — it is a click, not a drag.
  await page.getByText('360°', { exact: true }).click({ force: true });
  await expect.poll(frame, { timeout: 5_000 }).toBe('140');
});

test('a room page opens its 360° view from the photograph and goes back to the photos', async ({ page }) => {
  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);

  const open360 = page.getByRole('button', { name: '360° view', exact: true });
  const backToPhotos = page.getByRole('button', { name: 'Photos', exact: true });
  await actUntil(
    () => open360.click(),
    () => expect(backToPhotos).toBeVisible({ timeout: 3_000 }),
  );
  await expect(page.getByRole('tab', { name: '360° view' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/Drag to look around/)).toBeVisible();
  // The sphere names itself for assistive tech as soon as the viewer is built.
  await expect(page.getByLabel('Deluxe Sea View, 360°', { exact: true })).toBeAttached();

  await backToPhotos.click();
  await expect(open360).toBeVisible();
  await expect(page.getByText(/Drag to look around/)).toHaveCount(0);
});

test('adding a service leaves the guest where they were on the page', async ({ page }) => {
  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await page.getByRole('heading', { name: 'Add services', level: 2 }).scrollIntoViewIfNeeded();

  // Survives only if the document is never reloaded.
  await page.evaluate(() => {
    (window as unknown as { __sameDocument?: true }).__sameDocument = true;
  });
  const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));
  expect(scrollBefore).toBeGreaterThan(0);

  // The selection is repriced by a server action, not by re-routing to the
  // same page with another query: a route change puts the whole page behind
  // `loading.tsx`, which is what threw the guest back to the top.
  // Only this page re-rendering counts: prefetching the booking step the
  // "Book this room" link now points at is a different route, and wanted.
  const rerenders: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.searchParams.has('_rsc') && url.pathname.startsWith('/rooms/')) rerenders.push(url.href);
  });

  // A click before hydration is lost, and a second click would take the service
  // off again, so retry only while the button still offers to add it.
  const add = page.getByRole('button', { name: 'Add Airport transfer to your stay' });
  await actUntil(
    async () => {
      if (await add.isVisible()) await add.click();
    },
    () => expect(page).toHaveURL(/addOn=addon_transfer/, { timeout: 3_000 }),
  );
  await expect(
    page.getByRole('complementary', { name: 'Your stay' }).getByText('Airport transfer'),
  ).toBeVisible();

  expect(rerenders).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { __sameDocument?: true }).__sameDocument === true),
  ).toBe(true);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(scrollBefore);
});

test('on a phone the book bar opens the bill, editable in place', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The book bar only shows below lg');
  // A room that is free on these dates: a sold-out one swaps the bar's line
  // for "Fully booked", which is right, but not what this test is about.
  await page.goto(`/rooms?${stayQuery}&hideSoldOut=1`);
  const firstCard = page.getByRole('region', { name: 'Search results' }).locator('article').first();
  const roomName = (await firstCard.getByRole('heading').innerText()).trim();
  const cardLink = firstCard.getByRole('link', { name: roomName });
  // The sticky header intercepts a click on a card scrolled right under it —
  // same trap the `toggle` helper above already dodges for the bottom bar.
  await cardLink.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await cardLink.click();
  await expect(page.getByRole('heading', { level: 1, name: roomName })).toBeVisible();

  const bar = page.getByRole('button', { name: /Show what is in your stay/ });
  // A click before hydration is lost (see actUntil above); the bar reflecting
  // the add is this click's own effect, not just a delay to wait out.
  await actUntil(
    () => page.getByRole('button', { name: 'Add Airport transfer to your stay' }).click(),
    // The bar says a service is in, not only that the number moved.
    () => expect(bar).toContainText('1 service', { timeout: 3_000 }),
  );

  await bar.click();
  const sheet = page.getByRole('dialog', { name: 'Your stay' });
  await expect(sheet.getByText('Airport transfer')).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Book this room' })).toHaveAttribute('href', /addOn=addon_transfer/);

  // Taking it out from the sheet reprices the same quote the page shows.
  await sheet.getByRole('button', { name: 'Remove Airport transfer' }).click();
  await expect(sheet.getByText('Airport transfer')).toHaveCount(0);
  await expect(bar).toContainText('taxes included');
});

test('a guest can complete a demo booking through to confirmation', async ({ page }) => {
  await page.goto(`/rooms?${stayQuery}&hideSoldOut=1`);

  const firstCard = page.getByRole('region', { name: 'Search results' }).locator('article').first();
  const roomName = (await firstCard.getByRole('heading').innerText()).trim();

  // The catalog only ever opens the room's own page — booking starts there,
  // once the guest has actually seen the room, never as a shortcut from the
  // search results. The card carries no button: the whole tile is that link.
  await firstCard.getByRole('link', { name: roomName }).click();
  await expect(page).toHaveURL(/\/rooms\//);
  await expect(page.getByRole('heading', { level: 1, name: roomName })).toBeVisible();

  await page
    .getByRole('complementary', { name: 'Your stay' })
    .getByRole('link', { name: 'Book this room' })
    .click();

  await expect(page).toHaveURL(/\/book\//);
  await expect(page.getByRole('heading', { level: 1, name: 'Complete your stay' })).toBeVisible();

  const summary = page.getByRole('complementary', { name: roomName });
  await expect(summary).toBeVisible();

  // 1. Stay
  await page.getByRole('button', { name: 'Continue' }).click();
  // 2. Room and rate
  await expect(page.getByRole('heading', { name: 'Room & rate' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 3. Services — adding one must change the running total.
  const totalBefore = await summary.locator('.text-display').last().innerText();
  await addExtra(page, /Airport transfer/, [/Return leg on departure/]);
  await expect(summary.getByText('Airport transfer')).toBeVisible();
  await expect(summary.getByText('Return leg on departure')).toBeVisible();
  const totalAfter = await summary.locator('.text-display').last().innerText();
  expect(totalAfter).not.toEqual(totalBefore);
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. Guest details — empty submission is rejected inline.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter a first name.')).toBeVisible();

  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lindqvist');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Phone').fill('91 555 0117');
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Payment — the terms box gates the step and no card fields exist.
  await expect(page.getByText('Simulated payment.')).toBeVisible();
  await expect(page.locator('input[autocomplete*="cc-"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();

  await toggle(page.getByRole('checkbox', { name: /I understand this is a booking at a fictional property/ }), 'true');
  await page.getByRole('button', { name: 'Continue' }).click();

  // 6. Review and confirm
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await expect(page.getByText('ada@example.com').first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(page).toHaveURL(/\/booking\/[A-Z0-9]{6}$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'You are booked in' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Services added' }).getByText('Airport transfer'),
  ).toBeVisible();

  const reference = (await page.getByText(/^[A-Z0-9]{6}$/).first().innerText()).trim();
  expect(reference).toMatch(/^[A-Z0-9]{6}$/);

  // The stay is now one of this browser's trips, without an account.
  await page.goto('/trips');
  await expect(page.getByRole('tab', { name: /Upcoming/ })).toBeVisible();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();

});

test('a trip is claimed by reference and the email it was booked with', async ({ page }) => {
  const reference = await bookAStay(page);

  await page.goto('/trips');
  // A fresh browser always carries the showcase stays, so "no trips" isn't a
  // real state to assert on any more — assert on this reference specifically.
  // The reference alone must not be a lookup key.
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0);

  await page.getByLabel('Booking number').fill(reference);
  await page.getByLabel('Email').fill('someone.else@example.com');
  await page.getByRole('button', { name: 'Find booking' }).click();
  await expect(page.getByText(/No booking matches that reference and email/)).toBeVisible();
  // Nothing was added: a right reference with the wrong email lists no stay.
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0);

  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'Find booking' }).click();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();

  // And it is remembered, so the trip survives a reload.
  await page.reload();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
});

test('the appearance choice survives a reload, with no flash of the other theme', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  // Day is what the server renders and what a first-time visitor gets.
  await expect(html).not.toHaveClass(/dark/);

  await openMenu(page);
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(html).toHaveClass(/dark/);

  // The class is set by a script in <head>, so the reloaded document is
  // already dark before React runs — not corrected afterwards.
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.className)).toContain('dark');

  await openMenu(page);
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test('a guest cancels a stay, rebooks the same room, and a repeated cancel keeps it occupied', async ({ page, request }, testInfo) => {
  const reference = await bookAStay(page, undefined, true);
  const originalResponse = await request.get(`/api/bookings/${reference}?email=${encodeURIComponent('ada@example.com')}`);
  expect(originalResponse.ok()).toBeTruthy();
  const originalBooking = (await originalResponse.json()).booking;
  expect(originalBooking.unitNumber).toBeTruthy();
  const roomSlug = String(originalBooking.roomTypeId).replace(/^room_/, '');
  const exactAvailability = async () => request.post(`http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 1}/api/public/catalog`, { data: {
    operation: 'unit-availability', hotelSlug: 'asteria-cove', roomTypeId: originalBooking.roomTypeId,
    unitNumber: originalBooking.unitNumber, checkIn: originalBooking.checkIn, checkOut: originalBooking.checkOut,
  } });

  await page.goto('/trips');
  await expect(page.getByRole('tab', { name: /Upcoming/ })).toBeVisible();
  await expect(page.getByText(reference, { exact: true })).toBeVisible();

  // The reference this browser holds is not on its own permission to cancel.
  await page.getByRole('button', { name: 'Cancel booking' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Cancel booking' });
  await dialog.getByLabel('Email the booking was made with').fill('someone.else@example.com');
  await dialog.getByRole('button', { name: 'Cancel booking' }).click();
  await expect(dialog.getByText(/do not match a booking/)).toBeVisible();

  await dialog.getByLabel('Email the booking was made with').fill('ada@example.com');
  await dialog.getByRole('button', { name: 'Cancel booking' }).click();

  // It moves out of Upcoming and into Cancelled, where it can no longer be cancelled again.
  await expect(page.getByRole('tab', { name: /Cancelled/, selected: true })).toBeVisible();
  await expect(page.getByText('Cancelled').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);
  // The showcase stays keep Upcoming non-empty, so check this reference left
  // it specifically, not that the tab's count hit zero.
  await page.getByRole('tab', { name: /Upcoming/ }).click();
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0);
  const cancelledRead = await request.get(`/api/bookings/${reference}?email=${encodeURIComponent('ada@example.com')}`);
  expect((await cancelledRead.json()).booking.status).toBe('cancelled');
  expect((await (await exactAvailability()).json()).available).toBe(true);

  const quoteResponse = await request.post('/api/quotes', { data: {
    roomSlug, checkIn: originalBooking.checkIn, checkOut: originalBooking.checkOut, adults: originalBooking.adults,
    children: originalBooking.children, addOnIds: originalBooking.addOnIds,
  } });
  expect(quoteResponse.ok()).toBeTruthy();
  const quote = (await quoteResponse.json()).quote;
  const rebookKey = `cancel-rebook-${testInfo.project.name}-${Date.now()}`;
  const rebook = await request.post('/api/bookings', { headers: { 'Idempotency-Key': rebookKey }, data: {
    roomSlug, checkIn: originalBooking.checkIn, checkOut: originalBooking.checkOut, adults: originalBooking.adults,
    children: originalBooking.children, addOnIds: originalBooking.addOnIds, unitNumber: originalBooking.unitNumber,
    guest: { firstName: 'Ada', lastName: 'Lindqvist', email: 'ada@example.com', phone: '91 555 0117' },
    expectedTotal: quote.price.total,
  } });
  expect(rebook.status(), await rebook.text()).toBe(201);
  const repeatCancel = await request.post(`http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 3000) + 1}/api/public/trips`, { data: { operation: 'cancel', reference, email: 'ada@example.com' } });
  expect(repeatCancel.ok()).toBeTruthy();
  expect((await (await exactAvailability()).json()).available).toBe(false);
});
