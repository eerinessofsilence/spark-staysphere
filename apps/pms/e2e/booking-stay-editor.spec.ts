import { expect, test } from '@playwright/test';

// Read-only: opens a real reservation and checks the editor without changing demo data.
test('the booking card offers date and timing edits with a price review step', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/bookings?status=upcoming');
  const booking = page.locator('a[href^="/admin/bookings/"]').first();
  test.skip(await booking.count() === 0, 'No bookings in this demo');
  await booking.click();
  const edit = page.getByRole('button', { name: 'Edit stay' });
  test.skip(await edit.count() === 0, 'No upcoming confirmed booking in this demo');
  await expect(edit).toBeEnabled();
  await edit.click();
  const dialog = page.getByRole('dialog', { name: 'Edit stay' });
  await expect(dialog.getByLabel('Check-in', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Check-out', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Arrival time', exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Departure time', exact: true })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Late check-in' })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Late check-out' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Review dates and price' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Save times' })).toBeDisabled();
});
