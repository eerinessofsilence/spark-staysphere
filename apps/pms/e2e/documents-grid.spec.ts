import { expect, test } from '@playwright/test';

test('documents use compact rows and open details without page overflow', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/documents');
  const table = page.getByRole('table', { name: 'Documents', exact: true });
  if (!(await table.isVisible())) {
    await expect(async () => {
      if (!(await table.isVisible())) await page.getByRole('button', { name: 'Add sample documents', exact: true }).click();
      await expect(table).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Guest', exact: true })).toBeVisible();
  expect(await table.locator('tbody tr').count()).toBeLessThanOrEqual(10);
  const firstRow = table.locator('tbody tr').first();
  await expect(firstRow).toHaveAttribute('tabindex', '0');
  await firstRow.locator('td').nth(1).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Document number', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const activeRow = table.locator('tbody tr').filter({ has: page.getByText('Active', { exact: true }) }).first();
  if (await activeRow.count()) {
    await activeRow.locator('td').nth(1).click();
    const photo = dialog.getByRole('img');
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await firstRow.getByRole('button', { name: 'Document actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Edit', exact: true }).getByLabel('Document photo')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Status', { exact: true }).selectOption('active');
  await expect(table.locator('tbody')).not.toContainText('Deleted');
  await page.getByLabel('Documents', { exact: true }).selectOption('id');
  await expect(table.locator('tbody')).not.toContainText('Passport');
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByLabel('Name or document number', { exact: true }).fill('not-a-real-document-xyz');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(table.getByText('Try a different search or clear the filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
});
