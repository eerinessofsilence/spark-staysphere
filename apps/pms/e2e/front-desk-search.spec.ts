import { expect, test } from '@playwright/test';

// Read-only UI coverage: safe against a running preview, no seed reset or bookings created.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/front-desk');
  await expect(page.locator('[data-front-desk-interactive="true"]')).toBeVisible();
});

test('room search expands matches, folds other types and restores manual folds when cleared', async ({ page }) => {
  const calendar = page.locator('#front-desk-calendar');
  const rooms = calendar.getByRole('group', { name: /^Room \w+$/ });
  const total = await rooms.count();
  expect(total).toBeGreaterThan(1);
  const roomLabel = (await rooms.first().getAttribute('aria-label'))!;
  const number = roomLabel.replace(/^Room /, '');
  const groupName = (await rooms.first().locator('..').getAttribute('aria-label'))!;
  const group = calendar.getByRole('group', { name: groupName, exact: true });
  const toggle = group.locator(':scope > [role="button"]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const manuallyVisible = await rooms.count();

  const search = page.getByRole('combobox', { name: 'Search by booking or room number' });
  await search.fill(` ${number.toLowerCase()} `);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const typeGroups = calendar.getByRole('group').filter({ has: page.locator(':scope > [role="button"][aria-expanded]') });
  await expect(typeGroups.first()).toHaveAttribute('aria-label', groupName);
  await expect(calendar.getByRole('group', { name: roomLabel, exact: true })).toBeVisible();
  await expect.poll(async () => (await rooms.all()).length).toBeLessThan(total);
  for (const room of await rooms.all()) {
    expect((await room.getAttribute('aria-label'))!.toLowerCase()).toContain(number.toLowerCase());
  }
  // Types without matching rooms are genuinely folded, including their availability row.
  const collapsedGroups = calendar.locator('[role="group"]').filter({ has: page.locator(':scope > [aria-expanded="false"]') });
  expect(await collapsedGroups.count()).toBeGreaterThan(0);
  await expect(collapsedGroups.getByText('Available', { exact: true })).toHaveCount(0);

  await search.locator('../..').getByRole('button', { name: 'Clear search', exact: true }).last().click();
  await expect(search).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(rooms).toHaveCount(manuallyVisible);

  await search.fill('no-such-booking-or-room');
  await expect(page.getByRole('status').filter({ hasText: 'No matching bookings or rooms' })).toBeVisible();
  await expect(rooms).toHaveCount(0);
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(rooms).toHaveCount(manuallyVisible);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('booking reference search is live and case-insensitive and still opens the booking', async ({ page }) => {
  const calendar = page.locator('#front-desk-calendar');
  const bookings = calendar.getByRole('button', { name: /^Booking [A-Z0-9]+,/ });
  // A preview can have no real bookings in its current window; room coverage above still runs.
  test.skip(await bookings.count() === 0, 'No existing booking in the selected dates');
  const label = (await bookings.first().getAttribute('aria-label'))!;
  const reference = /^Booking ([A-Z0-9]+),/.exec(label)![1]!;
  const search = page.getByRole('combobox', { name: 'Search by booking or room number' });
  await search.fill(reference.slice(0, -1).toLowerCase());
  await expect(calendar.getByRole('button', { name: label, exact: true })).toBeVisible();
  await search.fill(` ${reference.toLowerCase()} `);
  const rooms = calendar.getByRole('group', { name: /^Room \w+$/ });
  for (const room of await rooms.all()) {
    await expect(room.getByRole('button', { name: new RegExp(`^Booking ${reference},`) })).not.toHaveCount(0);
  }
  await calendar.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Open reservation', exact: true })).toHaveAttribute('href', `/admin/bookings/${reference}`);
});
