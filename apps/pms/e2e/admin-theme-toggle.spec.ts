import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/front-desk');
  await expect(page.locator('[data-admin-shell]')).toBeVisible();
});

test('admin appearance control changes and preserves the shared theme preference', async ({ page }, testInfo) => {
  const html = page.locator('html');
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('button', { name: 'Appearance' })).toBeHidden();
    await page.getByRole('button', { name: 'Open admin menu', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Appearance' }).click();
  const dialog = page.getByRole('dialog', { name: 'Appearance' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('radio', { name: 'Dark' }).click();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open admin menu', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('dialog', { name: 'Appearance' }).getByRole('radio', { name: 'Light' }).click();
  await expect(html).not.toHaveClass(/dark/);
});
