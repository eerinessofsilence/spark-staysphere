import { expect, test } from '@playwright/test';

// Read-only: a rate review may be empty, but should answer in the chat without
// applying an illustrative price to any night.
test('assistant reviews upcoming rate opportunities on request', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/accounting');
  const panel = page.getByRole('dialog', { name: 'Admin assistant', exact: true });
  await page.getByRole('button', { name: 'Admin assistant', exact: true }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Check rate opportunities' }).click();
  await expect(panel.getByText(/I found these dates worth reviewing|No strong rate signal|Rate data is unavailable/)).toBeVisible();
});

test('assistant dismisses on an outside click and stays open for its own controls', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/accounting');
  const launcher = page.locator('[data-tour="assistant"]');
  const panel = page.getByRole('dialog', { name: 'Admin assistant', exact: true });

  await expect(async () => {
    if (!(await panel.isVisible())) await launcher.click();
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass();
  const input = panel.getByRole('textbox', { name: 'Message the admin assistant' });
  await input.fill('Keep this draft');
  await input.click();
  await expect(panel).toBeVisible();

  await page.locator('#ledger-heading').click();
  await expect(panel).toBeHidden();

  await launcher.click();
  await expect(panel).toBeVisible();
  await expect(input).toHaveValue('Keep this draft');
  await launcher.click();
  await expect(panel).toBeHidden();
});

// No reset, uploads or Apply: safe against a developer's active preview.
test('service wizard selects photos, previews hidden service and can discard without saving', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/content/add-ons');
  const panel = page.getByRole('dialog', { name: 'Admin assistant', exact: true });
  await expect(async () => {
    if (!(await panel.isVisible())) await page.getByRole('button', { name: 'Admin assistant', exact: true }).click();
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await panel.getByRole('button', { name: 'Create a service', exact: true }).click();
  const input = panel.getByRole('textbox', { name: 'Message the admin assistant' });
  async function answer(text: string, nextQuestion: string) {
    await input.fill(text);
    await panel.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(panel.getByText(nextQuestion, { exact: true })).toBeVisible();
  }
  await expect(panel.getByText('What is the service or dish called?', { exact: true })).toBeVisible();
  await answer('Assistant preview tour', 'Describe what is included, who it is for, the duration and any important conditions.');
  await answer('A two-hour walking tour with a local guide.', 'What does it cost?');
  await answer('80', 'Is that per stay, per night or per guest?');
  await panel.getByRole('button', { name: 'per guest', exact: true }).click();
  await expect(panel.getByText('Photos added: 0 of 30', { exact: true })).toBeVisible();
  await expect(input).toBeDisabled();
  await panel.getByRole('button', { name: 'Choose from library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Choose from library', exact: true });
  await expect(library).toBeVisible();
  const photos = library.locator('button[aria-pressed="false"]');
  await expect(photos.first()).toBeVisible();
  await photos.first().click();
  await library.getByRole('button', { name: 'Add selected (1)', exact: true }).click();
  await expect(library).toBeHidden();
  await expect(panel.getByText('Photos added: 1 of 30', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Use these photos', exact: true }).click();
  await panel.getByRole('button', { name: 'Keep hidden', exact: true }).click();
  await expect(panel.getByText('Create Assistant preview tour', { exact: true })).toBeVisible();
  await expect(panel.getByRole('img', { name: 'Cover', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: 'Not that', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0);
});
