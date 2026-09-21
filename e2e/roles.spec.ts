import { expect, test } from '@playwright/test';

test('a built-in role row opens its populated editor', async ({ page }) => {
  await page.goto('/admin/settings/team/roles');

  await page.getByRole('link', { name: 'Edit role: Owner' }).click();

  await expect(page).toHaveURL(/\/admin\/settings\/team\/roles\/Owner$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Owner' })).toBeVisible();
  await expect(page.getByLabel('Role name')).toHaveValue('Owner');
  await expect(page.getByRole('checkbox')).toHaveCount(9);
  await expect(page.getByRole('button', { name: 'Save role' })).toBeVisible();
});
