import { expect, test } from '@playwright/test';

test('room type edit action has a visible label and opens its editor', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/front-desk');

  const edit = page.locator('a[href^="/admin/content/rooms/"]', { hasText: 'Edit' }).first();
  await expect(edit).toBeVisible();
  await expect(edit).toHaveAttribute('aria-label', /^Edit .+/);
  await expect(edit.locator('svg')).toHaveCount(1);

  const target = await edit.getAttribute('href');
  await edit.click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
});
