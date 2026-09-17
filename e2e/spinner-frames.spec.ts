import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * `/admin/content/spinner/frames` coverage: uploading a new frame set (the
 * browser re-encodes each file to WebP before it ever reaches the server),
 * picking key angles and a start frame, and applying it — clearing the
 * existing hotspots and zones, since they name frame indices from the old
 * sequence. Desktop only, for the same reason `spinner-markup.spec.ts` is:
 * a file picker and a thumbnail grid need real width.
 */

const FRAMES_DIR = path.join(process.cwd(), 'public/images/hotel/spin');
const SAMPLE_FRAMES = [0, 1, 2, 3, 4, 5].map((n) => path.join(FRAMES_DIR, `frame-${String(n).padStart(3, '0')}.webp`));

async function resetDemoState(page: Page) {
  await page.goto('/admin/reset');
  const button = page.getByRole('button', { name: 'Reset demo state' });
  await expect(async () => {
    await button.click();
    await expect(button).toBeDisabled({ timeout: 2_000 });
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] });
  await expect(button).toBeEnabled({ timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test('uploading a new frame set replaces the orbit and clears its markers and zones', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The frame manager needs desktop width.');

  await resetDemoState(page);
  await page.goto('/admin/content/spinner/frames');

  await expect(page.getByText(/160 frames, 1920×1080/)).toBeVisible();

  const chooseButton = page.getByRole('button', { name: 'Choose frame images…' });
  await expect(async () => {
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), chooseButton.click()]);
    await fileChooser.setFiles(SAMPLE_FRAMES);
  }).toPass({ timeout: 15_000 });

  await expect(page.locator('ul li img')).toHaveCount(6, { timeout: 30_000 });

  const applyButton = page.getByRole('button', { name: 'Apply' });
  await applyButton.click();

  // The seed spinner has hotspots and (after resetDemoState) no zones, so the
  // confirm dialog still appears for the hotspots alone.
  await expect(page.getByRole('dialog', { name: "Replace the spinner's frames?" })).toBeVisible();
  await page.getByRole('button', { name: 'Replace and clear them' }).click();

  await page.waitForURL('**/admin/content/spinner/frames', { timeout: 15_000 });
  await expect(page.getByText(/6 frames, /)).toBeVisible({ timeout: 15_000 });

  // The guest orbit still renders with the new, shorter sequence. Retried:
  // the admin page's own reload a moment ago can still be settling.
  await expect(async () => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: /360° view/ })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000, intervals: [500, 1000, 2000] });
});
