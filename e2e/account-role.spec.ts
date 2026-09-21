import { expect, test } from '@playwright/test';

test('an administrator can go straight from their account to changing their role', async ({ page }) => {
  await page.goto('/admin/account');

  const changeRole = page.getByRole('link', { name: 'Change role' });
  await expect(changeRole).toBeVisible();
  await changeRole.click();

  await expect(page).toHaveURL(/\/admin\/settings\/team\/elena$/);
  await expect(page.getByLabel('Role')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save role' })).toBeVisible();
});
