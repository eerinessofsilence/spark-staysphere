import { expect, test } from '@playwright/test';
import { createAwaitingBooking } from './booking-fixture';

test('new conversation selects a guest and automatically links their booking', async ({ page, request }) => {
  await createAwaitingBooking(request, 'conversation');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/communications');
  const dialog = page.getByRole('dialog', { name: 'New conversation', exact: true });
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'New conversation', exact: true }).click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass();
  const submit = dialog.getByRole('button', { name: 'Open conversation', exact: true });
  await expect(submit).toBeDisabled();
  const guest = dialog.getByRole('combobox', { name: 'Guest', exact: true });
  await guest.fill('example');
  const option = dialog.getByRole('option').first();
  await expect(option).toBeVisible();
  await guest.press('ArrowDown');
  await guest.press('Enter');
  const booking = dialog.getByLabel('Booking', { exact: true });
  await expect(booking).not.toHaveText('');
  await expect(submit).toBeEnabled();
  await guest.fill('unknown guest');
  await expect(booking).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await guest.fill('example');
  await dialog.getByRole('option').first().click();
  await expect(submit).toBeEnabled();
});
