import { expect, test } from '@playwright/test';

test('front desk filters narrow the rack by reservation, source, lock and floor', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/front-desk');
  await expect(page.locator('[data-front-desk-interactive="true"]')).toBeVisible();
  const rooms = page.locator('#front-desk-calendar [role="group"][aria-label^="Room"]');
  const allRooms = await rooms.count();

  const filters = page.getByRole('button', { name: /^Filters/ });
  await filters.click();
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  await expect(dialog.getByText('Reservation status', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Source', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Room lock', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Floor', { exact: true })).toBeVisible();

  const source = dialog.locator('#front-desk-filter-source-select');
  await source.click();
  await page.getByRole('option', { name: 'Direct — hotel website', exact: true }).click();
  await expect(filters).toHaveAccessibleName('Filters, 1 applied');
  await expect(rooms).toHaveCount(4);
  expect(allRooms).toBeGreaterThan(4);

  const reservation = dialog.locator('#front-desk-filter-reservation-select');
  await reservation.click();
  await page.getByRole('option', { name: 'Confirmed', exact: true }).click();
  await expect(filters).toHaveAccessibleName('Filters, 2 applied');
  await expect(page.locator('#front-desk-calendar')).toBeVisible();

  await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(filters).toHaveAccessibleName('Filters');
});
