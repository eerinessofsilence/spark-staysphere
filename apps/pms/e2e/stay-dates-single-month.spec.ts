import { expect, test } from '@playwright/test';

test('guest date picker shows one month and selects a stay across months', async ({ page }) => {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 45);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  await page.goto(`/?checkIn=${iso(checkIn)}&checkOut=${iso(checkOut)}&adults=2&children=0`);

  const trigger = page.getByRole('button', { name: /^Check-in/ });
  const panel = page.getByRole('dialog', { name: 'Choose your dates' });
  await expect(async () => {
    await trigger.click();
    await expect(panel).toBeVisible();
  }).toPass();
  await expect(panel.locator('table')).toHaveCount(1);

  const days = panel.locator('table td button:not([disabled])');
  const lastDay = days.last();
  const from = await lastDay.getAttribute('aria-label');
  await lastDay.click();
  await expect(panel.getByText('Pick your check-out date.')).toBeVisible();

  await panel.getByRole('button', { name: 'Go to the Next Month' }).click();
  await expect(panel.locator('table')).toHaveCount(1);
  const firstDay = panel.locator('table td button:not([disabled])').first();
  const to = await firstDay.getAttribute('aria-label');
  await firstDay.click();

  await expect(panel).toBeHidden();
  await expect(trigger).toContainText(from!);
  await expect(page.getByRole('button', { name: /^Check-out/ })).toContainText(to!);
});
