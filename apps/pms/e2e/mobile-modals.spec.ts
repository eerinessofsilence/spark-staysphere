import { expect, test, type Page } from '@playwright/test';

async function expectDialogFits(page: Page, label: string) {
  const dialog = page.getByRole('dialog').last();
  await expect(dialog, `${label}: dialog opens`).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  // Wait for the bottom-sheet entrance animation before measuring its edges.
  await expect.poll(async () => {
    const bounds = await dialog.boundingBox();
    return bounds ? bounds.y + bounds.height : Infinity;
  }, { message: `${label}: bottom edge` }).toBeLessThanOrEqual(viewport!.height + 1);
  const bounds = await dialog.boundingBox();
  expect(bounds, `${label}: dialog has bounds`).not.toBeNull();
  expect(bounds!.x, `${label}: left edge`).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width, `${label}: right edge`).toBeLessThanOrEqual(viewport!.width + 1);
  expect(bounds!.y, `${label}: top edge`).toBeGreaterThanOrEqual(-1);
  const horizontalOverflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(horizontalOverflow, `${label}: content is not cut off horizontally`).toBeLessThanOrEqual(2);
}

async function expectBottomActionReachable(page: Page, buttonName: string) {
  const dialog = page.getByRole('dialog').last();
  await dialog.locator('.overflow-y-auto').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const action = dialog.getByRole('button', { name: buttonName });
  await expect(action).toBeVisible();
  const bounds = await action.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}

for (const { width, height } of [{ width: 320, height: 568 }, { width: 390, height: 568 }, { width: 667, height: 375 }, { width: 820, height: 900 }]) {
  test(`admin booking and order forms fit ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
    await page.goto('/admin/front-desk');
    await page.getByRole('button', { name: 'Add booking' }).click();
    await expectDialogFits(page, 'add booking');
    await page.screenshot({ path: testInfo.outputPath(`add-booking-${width}.png`) });
    const bookingDialog = page.getByRole('dialog').last();
    await expectBottomActionReachable(page, 'Cancel');
    await bookingDialog.getByRole('button', { name: 'Close' }).click();

    await page.goto('/admin/orders');
    await page.getByRole('button', { name: 'Create order' }).click();
    await expectDialogFits(page, 'create order');
    await page.screenshot({ path: testInfo.outputPath(`create-order-${width}.png`) });
    await expectBottomActionReachable(page, 'Cancel');
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`mobile admin sheets work in ${theme} mode`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('admin-tour.seen.v1', '1');
      localStorage.setItem('spark.theme', selectedTheme);
    }, theme);
    await page.goto('/admin/front-desk');
    await page.locator('[data-front-desk-interactive="true"]').waitFor();
    await page.getByRole('button', { name: 'Filters' }).click();
    await expectDialogFits(page, 'front desk filters');
    await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: 'Close' }).click();

    const bell = page.locator('button[data-tour="bell"]:visible');
    await bell.click();
    await expectDialogFits(page, 'notifications');
    await page.screenshot({ path: testInfo.outputPath(`notifications-${theme}.png`) });
  });
}
