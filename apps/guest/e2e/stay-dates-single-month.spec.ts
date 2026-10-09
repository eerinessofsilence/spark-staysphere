import { expect, test } from '@playwright/test';

test('guest date picker selects a stay across months', async ({ page }, testInfo) => {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 45);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  await page.goto(`/?checkIn=${iso(checkIn)}&checkOut=${iso(checkOut)}&adults=2&children=0`);

  const trigger = page.getByRole('button', { name: /^Check-in/ });
  const panel = page.getByRole('dialog', { name: 'Choose your dates' });
  await expect(async () => {
    if (!(await panel.isVisible())) await trigger.click();
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  const monthCount = testInfo.project.name === 'mobile' ? 1 : 2;
  await expect(panel.locator('table')).toHaveCount(monthCount);

  const days = panel.locator('table').first().locator('td button:not([disabled])');
  const lastDay = days.last();
  const from = await lastDay.getAttribute('aria-label');
  await lastDay.click();
  await expect(panel.locator('div[role="status"]')).toBeHidden();

  if (monthCount === 1) await panel.getByRole('button', { name: 'Go to the Next Month' }).click();
  await expect(panel.locator('table')).toHaveCount(monthCount);
  const firstDay = panel.locator('table').last().locator('td button:not([disabled])').first();
  const to = await firstDay.getAttribute('aria-label');
  await firstDay.click();

  await expect(panel).toBeHidden();
  await expect(trigger).toContainText(from!);
  await expect(page.getByRole('button', { name: /^Check-out/ })).toContainText(to!);
});
