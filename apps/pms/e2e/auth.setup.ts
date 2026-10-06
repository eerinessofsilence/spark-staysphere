import { expect, test as setup } from '@playwright/test';

/**
 * Signs in to the back office once, through the real two-step door, and
 * records the browser state for the desktop and mobile projects (see
 * `playwright.config.ts`'s `dependencies`). Every admin route is behind a
 * session now, so nothing else in the suite could reach `/admin/reset`, let
 * alone a booking, without this running first. Uses the demo credentials
 * the sign-in page itself prints — the same ones CI has, since it sets no
 * `ADMIN_PASSWORD`.
 */
export const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json';

setup('sign in to the back office', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill('elena.markou@asteriacove.example');
  await page.getByLabel('Password').fill('staysphere');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/admin\/welcome/);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
