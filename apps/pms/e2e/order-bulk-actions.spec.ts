import { expect, test } from '@playwright/test';

test('orders grid selects visible rows and changes their status together', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/orders?view=all');
  const grid = page.getByTestId('orders-grid');
  const rows = grid.locator('tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThan(1);

  await grid.getByRole('checkbox', { name: 'Select all visible orders' }).check();
  await expect(grid.getByRole('toolbar', { name: 'Bulk order actions' })).toContainText(`${count} orders selected`);
  await expect(rows.getByRole('checkbox')).toHaveCount(count);
  await grid.getByRole('button', { name: 'Clear selection' }).click();
  await expect(grid.getByRole('toolbar', { name: 'Bulk order actions' })).toBeHidden();

  const first = rows.first();
  const second = rows.nth(1);
  await first.getByRole('checkbox').check();
  await second.getByRole('checkbox').check();
  const firstId = (await first.locator('td').nth(1).innerText()).replace('#', '');
  const secondId = (await second.locator('td').nth(1).innerText()).replace('#', '');
  const statuses = await Promise.all([first, second].map((row) => row.locator('td').nth(11).innerText()));
  const target = statuses.every((status) => status.trim() === 'Ready') ? 'confirmed' : 'ready';
  const targetLabel = target === 'ready' ? 'Ready' : 'Confirmed';
  await grid.getByLabel('Choose status').selectOption(target);
  await grid.getByRole('button', { name: 'Apply to selected' }).click();
  await expect(grid.getByRole('toolbar', { name: 'Bulk order actions' })).toBeHidden();
  await expect(grid.locator('tbody tr').filter({ hasText: `#${firstId}` }).getByRole('button', { name: `Change order status: ${firstId}` })).toContainText(targetLabel);
  await expect(grid.locator('tbody tr').filter({ hasText: `#${secondId}` }).getByRole('button', { name: `Change order status: ${secondId}` })).toContainText(targetLabel);
});
