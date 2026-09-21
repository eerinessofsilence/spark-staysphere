import { expect, test } from '@playwright/test';

test('a highlighted currency keeps the standard foreground text', async ({ page }) => {
  await page.goto('/admin/content/hotel');
  await page.getByRole('button', { name: 'Skip' }).click();

  await page.getByRole('combobox', { name: 'Currency' }).click();
  const selectedCurrency = page.getByRole('option', { name: 'Euro (EUR)' });

  await expect(selectedCurrency).toBeVisible();
  await expect(selectedCurrency).toHaveCSS('color', 'rgb(22, 22, 22)');
});
