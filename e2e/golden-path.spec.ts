import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The golden path: arrival → search → detail → booking → confirmation, plus the
 * admin controls that feed it. Demo state is process-local, so these run
 * serially against one dev server.
 */

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const checkIn = isoDaysFromNow(45);
const checkOut = isoDaysFromNow(48);
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
 * Runs first on purpose. Demo state is process-local and accumulates across runs
 * — bookings hold inventory and overrides persist — so the suite starts by
 * clearing it, which also covers the admin reset control itself.
 */
test('resetting demo state clears bookings and availability overrides', async ({ page }) => {
  await page.goto('/admin');

  await actUntil(
    () => page.getByRole('button', { name: 'Reset demo state' }).click(),
    () => expect(page.getByText('No bookings yet')).toBeVisible({ timeout: 5_000 }),
  );

  await expect(
    page.getByRole('row').filter({ hasText: 'Coastal Twin' }).getByRole('combobox'),
  ).toHaveValue('auto');
});

test('no route overflows the phone viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Only meaningful at the phone width');
  for (const path of ['/', `/rooms?${stayQuery}`, `/rooms/deluxe-sea?${stayQuery}`, `/book/deluxe-sea?${stayQuery}`, '/admin']) {
    await page.goto(path);
    // Android Chrome widens the layout viewport to any overflow, which shows up here.
    expect(await page.evaluate(() => window.innerWidth), path).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(390);
  }
});

test('the arrival screen presents the hotel area by area with hotspots', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Asteria Cove' })).toBeVisible();
  const scene = page.getByRole('group', { name: /Explore the hotel area by area/ });
  await expect(scene).toBeVisible();

  // Switch to the pool area, then open its hotspot. The tablist sits inside the
  // stage on desktop and below it on mobile; only one is in the tree at a time.
  const poolTab = page.getByRole('tab', { name: 'Pool' });
  await actUntil(
    () => poolTab.click(),
    () => expect(poolTab).toHaveAttribute('aria-selected', 'true', { timeout: 3_000 }),
  );

  const cta = page.getByRole('link', { name: 'See pool-access rooms' });
  await actUntil(
    async () => {
      if (!(await cta.isVisible())) await page.getByRole('button', { name: 'Infinity edge' }).click();
    },
    () => expect(cta).toBeVisible({ timeout: 3_000 }),
  );

  await cta.click();
  await expect(page).toHaveURL(/\/rooms\?.*view=pool/);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your room' })).toBeVisible();
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
  await expect(panel.getByText('Pick your check-out date.')).toBeVisible();

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
  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(3);

  await withFilters(page, () =>
    toggle(page.getByRole('button', { name: 'Sea view', exact: true }), 'true'),
  );
  await expect(page).toHaveURL(/view=sea/);
  await expect(cards).toHaveCount(4);

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

  await toggle(page.getByRole('checkbox', { name: /Spa ritual/ }).first(), 'true');
  await expect(page).toHaveURL(/addOn=addon_spa/);
  await expect(summary.getByText('Spa ritual')).toBeVisible();

  const totalAfter = await summary.locator('.text-display').last().innerText();
  expect(totalAfter).not.toEqual(totalBefore);

  // The gallery tabs swap the photograph without leaving the page.
  await page.getByRole('tab', { name: 'Bathroom' }).click();
  await expect(page.getByRole('tab', { name: 'Bathroom' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('img', { name: /Bathroom/ })).toBeVisible();
});

test('a guest can complete a demo booking through to confirmation', async ({ page }) => {
  await page.goto(`/rooms?${stayQuery}&hideSoldOut=1`);

  const firstCard = page.getByRole('region', { name: 'Search results' }).locator('article').first();
  const roomName = (await firstCard.getByRole('heading').innerText()).trim();
  await firstCard.getByRole('link', { name: 'Book now' }).click();

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
  await toggle(page.getByRole('checkbox', { name: /Airport transfer/ }), 'true');
  await expect(summary.getByText('Airport transfer')).toBeVisible();
  const totalAfter = await summary.locator('.text-display').last().innerText();
  expect(totalAfter).not.toEqual(totalBefore);
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. Guest details — empty submission is rejected inline.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter a first name.')).toBeVisible();

  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lindqvist');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Phone').fill('+385 91 555 0117');
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Payment — the terms box gates the step and no card fields exist.
  await expect(page.getByText('Demo payment.')).toBeVisible();
  await expect(page.locator('input[autocomplete*="cc-"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();

  await toggle(page.getByRole('checkbox', { name: /I understand this is a demo booking/ }), 'true');
  await page.getByRole('button', { name: 'Continue' }).click();

  // 6. Review and confirm
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await expect(page.getByText('ada@example.com').first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirm demo booking' }).click();

  await expect(page).toHaveURL(/\/booking\/AC-/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'You are booked in' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Services added' }).getByText('Airport transfer'),
  ).toBeVisible();

  const reference = (await page.getByText(/^AC-[A-Z0-9]{6}$/).first().innerText()).trim();
  expect(reference).toMatch(/^AC-[A-Z0-9]{6}$/);

  // The booking reaches the operations view.
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: reference })).toBeVisible();
  await expect(page.getByText('ada@example.com').first()).toBeVisible();
});

test('an admin sell-out immediately blocks that room for guests', async ({ page }) => {
  await page.goto('/admin');

  const row = page.getByRole('row').filter({ hasText: 'Coastal Twin' });
  // Assert on the re-rendered status, not the select value: a pre-hydration
  // selectOption changes the DOM without ever reaching the server action.
  await actUntil(
    async () => void (await row.getByRole('combobox').selectOption('sold_out')),
    () => expect(row.locator('td').nth(3)).toContainText('Sold out', { timeout: 3_000 }),
  );

  await page.goto(`/rooms/coastal-twin?${stayQuery}`);
  await expect(page.getByText(/is sold out for/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book this room' })).toHaveCount(0);

  await page.goto(`/rooms?${stayQuery}&hideSoldOut=1`);
  await expect(
    page.getByRole('region', { name: 'Search results' }).getByText('Coastal Twin'),
  ).toHaveCount(0);

  // Restore, so the suite leaves the demo as it found it.
  await page.goto('/admin');
  const restored = page.getByRole('row').filter({ hasText: 'Coastal Twin' });
  await actUntil(
    async () => void (await restored.getByRole('combobox').selectOption('auto')),
    () => expect(restored.locator('td').nth(3)).not.toContainText('Sold out', { timeout: 3_000 }),
  );
});

test('withdrawing an add-on removes it from the guest flow', async ({ page }) => {
  await page.goto('/admin');

  const card = page.locator('div').filter({ hasText: /^Late check-out/ }).last();
  await actUntil(
    async () => {
      if ((await card.getByRole('switch').getAttribute('aria-checked')) !== 'false') {
        await card.getByRole('switch').click();
      }
    },
    () => expect(card.getByText('Withdrawn')).toBeVisible({ timeout: 3_000 }),
  );

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByText('Late check-out')).toHaveCount(0);

  await page.goto('/admin');
  const restore = page.locator('div').filter({ hasText: /^Late check-out/ }).last();
  await actUntil(
    async () => {
      if ((await restore.getByRole('switch').getAttribute('aria-checked')) !== 'true') {
        await restore.getByRole('switch').click();
      }
    },
    () => expect(restore.getByText('On sale')).toBeVisible({ timeout: 3_000 }),
  );
});
