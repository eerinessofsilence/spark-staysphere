import { expect, test } from '@playwright/test';

/** Server-rendered controls can be visible just before their client click handler hydrates. */
async function actUntil(act: () => Promise<void>, effect: () => Promise<void>) {
  await expect(async () => {
    await act();
    await effect();
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] });
}

test('a saved record can be restored during the six-second delete window', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const guestName = `Undo ${suffix}`;
  const email = `undo-${suffix}@example.com`;

  await page.goto('/admin/guests');
  const dialog = page.getByRole('dialog', { name: 'New guest', exact: true });
  await actUntil(
    () => page.getByRole('button', { name: 'New guest', exact: true }).click(),
    () => expect(dialog).toBeVisible(),
  );
  await dialog.getByLabel('First name', { exact: true }).fill('Undo');
  await dialog.getByLabel('Last name', { exact: true }).fill(suffix);
  await dialog.getByLabel('Email', { exact: true }).fill(email);
  await dialog.getByLabel('Phone', { exact: true }).fill('+40123456789');
  await dialog.getByRole('button', { name: 'Create guest', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/guests/${encodeURIComponent(email)}$`));

  await page.goto(`/admin/guests?q=${encodeURIComponent(email)}`);
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Guest actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete guest', exact: true }).click();

  const pending = page.locator('[data-deletion-toast]').filter({ hasText: guestName });
  await expect(pending).toBeVisible();
  await expect(row).toBeHidden();
  await pending.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(pending).toBeHidden();
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Guest actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete guest', exact: true }).click();
  await expect(page.getByText('Guest profile deleted.', { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
});
