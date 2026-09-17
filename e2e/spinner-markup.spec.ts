import { expect, test, type Page } from '@playwright/test';

/**
 * `/admin/content/spinner` coverage: drawing a zone on a key-angle frame,
 * binding it to a room type, watching it autosave, and confirming it
 * persists and reaches the guest-facing orbit. Runs serially against the
 * same dev server as the rest of the CMS suite — see `cms.spec.ts`'s own
 * note on why the demo state is process-local.
 *
 * Desktop only: the ported editor's three-column layout (shortcuts, canvas,
 * zone list) is a professional drawing tool, the same shape as the
 * reference `svg-editor-kit` it was ported from, and needs real width to
 * work — at 390px its fixed-width side panels alone exceed the viewport,
 * leaving no canvas to draw on. Making it usable one-handed is future work,
 * not something this pass claims.
 */

const KEY_ANGLE = 25; // one of the seed spinner's `keyAngles` (mock-data.ts)

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

test('drawing a zone, binding it to a room type, autosaves and reaches the guest orbit', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The markup editor needs desktop width.');
  await resetDemoState(page);

  await page.goto(`/admin/content/spinner/markup?frame=${KEY_ANGLE}`);

  const canvas = page.locator('[data-pe-root]');
  await expect(canvas).toBeVisible();

  // Draw a rectangle: select the tool, then drag across the canvas. The
  // click is retried — a click on a server-rendered island is lost until
  // React has attached its listeners (see cms.spec.ts's own note on this).
  const rectButton = page.getByRole('button', { name: /Rectangle/ });
  await expect(async () => {
    await rectButton.click();
    await expect(rectButton).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  // Scoped to `.pe-canvas` specifically: the toolbar's own tool icons are
  // also `<svg>` elements and sit earlier in the DOM.
  const box = (await page.locator('.pe-canvas svg').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 5 });
  await page.mouse.up();

  // The new zone shows up unbound, selected.
  await expect(page.locator('.pe-item-label')).toHaveText('Unbound zone');

  // Bind it to a room type.
  await page.getByRole('radio', { name: 'Room type' }).click();
  const roomTypeSelect = page.locator('select').last();
  await roomTypeSelect.selectOption({ index: 0 });
  const roomName = await roomTypeSelect.locator('option:checked').textContent();

  // Autosave settles. `.pe-save` specifically, not a loose text match: "Saved"
  // is a substring of "Unsaved changes…" too.
  await expect(page.locator('.pe-save')).toHaveText('Saved', { timeout: 10_000 });

  // Reload: the zone and its binding persisted.
  await page.goto(`/admin/content/spinner/markup?frame=${KEY_ANGLE}`);
  await expect(page.locator('.pe-item')).toHaveCount(1);
  await expect(page.locator('.pe-item-label')).toContainText(roomName?.trim() ?? '');

  // The guest-facing arrival scene draws the same zone on the same frame.
  await page.goto(`/?frame=${KEY_ANGLE}`);
  await expect(page.getByRole('group', { name: /360° view/ })).toBeVisible();
  await expect(page.locator('[data-testid="spinner-zone"]')).toHaveCount(1);
});

test('a frame outside the key angles redirects to the first key angle', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The markup editor needs desktop width.');
  await page.goto('/admin/content/spinner/markup?frame=1');
  await expect(page).toHaveURL(new RegExp(`frame=${KEY_ANGLE}(&|$)`));
});
