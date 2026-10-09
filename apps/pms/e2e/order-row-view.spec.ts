import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'America/New_York' });

test('order rows open details while selection stays independent', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/orders?view=all');
  const row = page.locator('[data-testid="orders-grid"] tbody tr').first();
  await expect(row).toHaveAttribute('data-order-interactive', 'true');
  await row.getByRole('checkbox').check();
  await expect(page).toHaveURL(/orders\?view=all$/);
  await row.getByRole('checkbox').uncheck();
  await row.locator('td').nth(5).click();
  await expect(page).toHaveURL(/\/admin\/orders\/[^/?]+$/);
  await expect(page.locator('main').getByText('Guest', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Change order status/ })).toBeVisible();
  const edit = page.getByRole('button', { name: 'Edit order', exact: true });
  const status = page.getByRole('button', { name: /Change order status/ });
  if ((await status.innerText()).trim() === 'New') {
    await expect(edit).toBeEnabled();
  } else {
    await expect(edit).toBeDisabled();
    await expect(page.getByText('Only orders with New status can be edited.')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('main').getByText('Guest', { exact: true })).toBeVisible();
  await page.goto('/admin/orders?view=all');
  await expect(row).toHaveAttribute('data-order-interactive', 'true');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/orders\/[^/?]+$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors.filter((message) => /hydration|aborted without reason/i.test(message))).toEqual([]);
});

test('only a New order opens the editor', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/orders?view=all');
  const newRow = page.locator('[data-testid="orders-grid"] tbody tr').filter({ has: page.getByRole('button', { name: /Change order status/ }).filter({ hasText: /^New$/ }) }).first();
  await expect(newRow).toHaveAttribute('data-order-interactive', 'true');
  await newRow.locator('td').nth(5).click();
  const edit = page.getByRole('button', { name: 'Edit order', exact: true });
  await expect(edit).toBeEnabled();
  await edit.click();
  const editor = page.getByRole('dialog', { name: 'Edit order', exact: true });
  await expect(editor.getByLabel('Service', { exact: true })).not.toHaveValue('');
  await expect(editor.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).toBeHidden();
});
