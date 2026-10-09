import { expect, test } from '@playwright/test';

test('subscription expiry stays visible, offers an update, and fits the viewport', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.clock.install();
  await page.goto('/admin/account/subscription');
  await expect(page.getByRole('heading', { name: 'Subscription', exact: true })).toBeVisible();
  // Move only this browser's clock: no database changes or demo payments are needed.
  await page.clock.setSystemTime(new Date(Date.now() + 40 * 86_400_000));
  await page.clock.runFor(30_001);
  const notice = page.locator('[data-subscription-notice]');
  const toast = page.locator('[data-subscription-expiry-toast]');
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute('role', 'alert');
  await expect(toast.getByText('Your subscription has ended')).toBeVisible();
  await expect(toast.getByRole('link', { name: 'Update subscription' })).toHaveAttribute('href', '/admin/account/subscription');
  await page.clock.runFor(15_000);
  await expect(toast).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('subscription-expired.png') });
  await toast.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(toast).toBeHidden();
  await expect(notice.getByRole('link', { name: 'Update subscription' })).toBeVisible();
  await page.locator('[role="group"][aria-labelledby="plan-heading"]').getByRole('button', { name: 'Update subscription' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm payment' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Demo payment only. No money is charged.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm demo payment' })).toBeVisible();
});
