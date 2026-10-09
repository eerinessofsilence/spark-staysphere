import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/front-desk');
  await expect(page.locator('[data-admin-shell]')).toBeVisible();
});

test('admin appearance control changes and preserves the shared theme preference', async ({ page }, testInfo) => {
  const html = page.locator('html');
  const dialog = page.getByRole('dialog', { name: 'Appearance' });
  async function openAppearance() {
    if (testInfo.project.name === 'mobile') {
      const menu = page.getByRole('dialog', { name: 'Admin menu', exact: true });
      await expect(async () => {
        if (!(await menu.isVisible())) await page.getByRole('button', { name: 'Open admin menu', exact: true }).click();
        await expect(menu).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
    }
    await expect(async () => {
      if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'Appearance' }).click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  }
  await openAppearance();

  await dialog.getByRole('radio', { name: 'Dark' }).click();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await openAppearance();
  await page.getByRole('dialog', { name: 'Appearance' }).getByRole('radio', { name: 'Light' }).click();
  await expect(html).not.toHaveClass(/dark/);
});
