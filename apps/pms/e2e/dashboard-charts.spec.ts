import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectInsideViewport(page: Page, tooltip: Locator) {
  const box = await tooltip.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
});

test('one dashboard period controls all four summary cards', async ({ page, isMobile }) => {
  await page.goto('/admin');

  const period = page.getByRole('region', { name: 'Summary period' });
  await expect(period).toBeVisible();
  async function showOptions() {
    if (!isMobile) return period;
    const dialog = page.getByRole('dialog', { name: 'Summary period' });
    await expect(async () => {
      if (!await dialog.isVisible()) await period.getByRole('button', { name: 'Filters' }).click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    return dialog;
  }
  let options = await showOptions();
  await expect(options.getByRole('link', { name: 'Next 7 days' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Arrivals & departures', { exact: true })).toBeVisible();

  await options.getByRole('link', { name: 'Next 30 days' }).click();
  await expect(page).toHaveURL(/\/admin\?period=next_30$/);
  options = await showOptions();
  await expect(options.getByRole('link', { name: 'Next 30 days' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Confirmed stays, by arrival date', { exact: true })).toBeVisible();

  const calendar = page.getByRole('dialog', { name: 'Custom dates' });
  await expect(async () => {
    if (!await calendar.isVisible()) await options.getByRole('button', { name: 'Custom dates' }).click();
    await expect(calendar).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
});

test('compact dashboard charts expose every bar on hover, touch and keyboard', async ({ page, isMobile }) => {
  await page.goto('/admin');

  const mealsChart = page.getByRole('list', { name: 'Meals, next 7 days' });
  const mealBars = mealsChart.getByRole('button');
  await expect(mealBars).toHaveCount(7);

  const mealBar = mealBars.first();
  const mealTooltip = page.getByRole('status').filter({ hasText: 'Breakfast' });
  await expect(async () => {
    if (!await mealTooltip.isVisible()) {
      if (isMobile) await mealBar.click();
      else {
        await page.mouse.move(0, 0);
        await mealBar.hover();
      }
    }
    await expect(mealTooltip).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expectInsideViewport(page, mealTooltip);

  await mealBar.focus();
  await expect(page.getByRole('status').filter({ hasText: 'Dining add-ons' })).toBeVisible();

  const revenueChart = page.getByRole('list', { name: 'Confirmed stays, by arrival date' });
  const revenueBars = revenueChart.getByRole('button');
  expect(await revenueBars.count()).toBeGreaterThan(0);

  const revenueBar = revenueBars.first();
  if (isMobile) await revenueBar.click();
  else await revenueBar.hover();
  const revenueTooltip = page.getByRole('status');
  await expect(revenueTooltip).toBeVisible();
  await expectInsideViewport(page, revenueTooltip);
});
