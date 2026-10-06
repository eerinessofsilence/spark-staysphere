import { expect, test } from '@playwright/test';

// Explicit opt-in only: never upload personal attachments during normal CI.
test('attach user-provided example to the selected demo reservation', async ({ page }) => {
  test.skip(!process.env.DOCUMENT_EXAMPLE_FILE, 'Requires an explicitly authorized example attachment');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/documents');
  await expect(page.getByLabel('Name or document number', { exact: true })).toBeEnabled();
  await page.getByLabel('Name or document number', { exact: true }).fill('JXDFFM');
  await page.getByLabel('Name or document number', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const row = page.getByRole('table').locator('tbody tr').filter({ hasText: 'JXDFFM' });
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('tabindex', '0');
  await row.locator('td').nth(1).click();
  const viewer = page.getByRole('dialog', { name: 'Passport', exact: true });
  await viewer.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit', exact: true });
  await editor.getByLabel('Document photo').setInputFiles(process.env.DOCUMENT_EXAMPLE_FILE!);
  await expect(editor.getByRole('img', { name: 'Document photo' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(viewer).toBeHidden();
  await row.locator('td').nth(1).click();
  await expect(viewer.getByRole('img')).toBeVisible();
  await expect.poll(() => viewer.getByRole('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1030);
});
