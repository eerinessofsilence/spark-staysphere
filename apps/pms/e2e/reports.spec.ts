import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
});

test('live reports use category tabs, periods and room data', async ({ page }) => {
  await page.goto('/admin/accounting/reports');
  await expect(page.locator('#report-result-heading')).toHaveText('Housekeeping & Meals');
  await expect(page.getByRole('table', { name: 'Housekeeping & Meals' }).locator('tbody tr').first()).toBeVisible();

  await page.getByRole('link', { name: 'Last week' }).click();
  await expect(page).toHaveURL(/period=last_week/);
  await page.getByRole('link', { name: 'Manager analytics' }).click();
  await expect(page.locator('#report-result-heading')).toHaveText('Manager analytics');
  await expect(page.getByRole('columnheader', { name: 'Occupied nights' })).toBeVisible();

  await page.getByRole('link', { name: 'Daily list' }).click();
  await expect(page.getByRole('link', { name: 'Arrivals' })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeVisible();
});

test('reports table scrolls inside its card on a phone', async ({ page, isMobile }) => {
  if (!isMobile) return;
  await page.goto('/admin/accounting/reports');
  await expect(page.locator('#report-result-heading')).toHaveText('Housekeeping & Meals');
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document).toBe(widths.viewport);
});
