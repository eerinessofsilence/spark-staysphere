import { expect, test } from '@playwright/test';

test('room rates overview shows each plan price under every date', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/rates?days=7');

  const rows = page.locator('[data-rate-plan]');
  await expect(rows.first()).toBeVisible();

  const first = rows.first();
  const prices = first.locator('[data-rate-price] > span[aria-hidden="true"]');
  await expect(prices).toHaveCount(7);
  const values = await prices.allTextContents();
  expect(values[0]?.trim()).toMatch(/^\d+(?:\.\d+)?$/);
  expect(values.map((value) => value.trim())).toEqual(Array(7).fill(values[0]?.trim()));

  const detail = first.getByRole('link');
  await expect(detail).toHaveAttribute('href', /\/admin\/rates\/[^?]+\?from=/);
  await detail.click();
  await expect(page).toHaveURL(/\/admin\/rates\/[^?]+\?from=/);
});
