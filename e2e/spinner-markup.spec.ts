import { expect, test } from '@playwright/test';

test('closes a polygon by double-clicking its final point', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The drawing editor needs desktop width.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/content/spinner/markup?frame=1');
  await expect(page.locator('[data-pe-root]')).toBeVisible();
  const initialCount = await page.locator('.pe-item').count();
  let created = false;

  try {
    await page.getByRole('button', { name: /Polygon/ }).click();
    const box = (await page.locator('.pe-canvas svg').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.35);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.35);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.mouse.dblclick(box.x + box.width * 0.35, box.y + box.height * 0.55);

    await expect(page.locator('.pe-item')).toHaveCount(initialCount + 1);
    created = true;
    await expect(page.locator('.pe-dock button').first()).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.65);
    await expect(page.locator('.hs-draft')).toHaveCount(0);
  } finally {
    if (created) {
      await page.locator('.pe-dock').getByRole('button', { name: /Delete:/ }).click();
      await expect(page.locator('.pe-save')).toHaveText('Saved');
    }
  }
});

// Preserve the current catalog and existing zones: only remove the zone this test draws.
test('choose a room directly, autosave, reload and open it from the guest orbit', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The drawing editor needs desktop width.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/content/spinner/markup?frame=1');
  const editorUrl = page.url();
  const frame = new URL(editorUrl).searchParams.get('frame');
  await expect(page.locator('[data-pe-root]')).toBeVisible();
  const initialCount = await page.locator('.pe-item').count();
  let created = false;
  try {
    const rectangle = page.getByRole('button', { name: /Rectangle/ });
    await expect(async () => {
      await rectangle.click();
      await expect(rectangle).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
    }).toPass();
    const box = (await page.locator('.pe-canvas svg').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.7, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('.pe-item')).toHaveCount(initialCount + 1);
    created = true;

    const room = page.getByRole('combobox', { name: 'Room', exact: true });
    await expect(room).toHaveValue('');
    await expect(page.getByRole('radiogroup', { name: 'Target kind' })).toHaveCount(0);
    const roomId = await room.locator('option:not([disabled])').first().getAttribute('value');
    await room.selectOption(roomId!);
    await expect(page.getByTestId('zone-room-preview')).toBeVisible();
    await expect(page.getByTestId('zone-room-preview').locator('img')).toBeVisible();
    await expect(page.locator('.pe-save')).toHaveText('Saved');
    const label = await page.locator('.pe-item-label').last().textContent();

    await page.reload();
    await page.locator('.pe-item-main').last().click();
    await expect(room).toHaveValue(roomId!);
    await expect(page.locator('.pe-item-label').last()).toHaveText(label!);
    // A shorter/narrower canvas must keep the whole field within its panel.
    await page.setViewportSize({ width: 1100, height: 800 });
    const fits = await room.evaluate((element) => {
      const panel = element.closest('.pe-float-right')!;
      return element.getBoundingClientRect().right <= panel.getBoundingClientRect().right;
    });
    expect(fits).toBe(true);
    await page.screenshot({ path: '/tmp/staysphere-room-picker.png' });

    await page.getByRole('button', { name: 'Remove binding' }).click();
    await expect(room).toHaveValue('');
    await expect(page.locator('.pe-save')).toHaveText('Saved');
    await room.selectOption(roomId!);
    await expect(page.locator('.pe-save')).toHaveText('Saved');
    await page.goto('/?frame=' + frame);
    const guestZone = page.getByTestId('spinner-zone').last();
    await expect(guestZone).toBeAttached();
    await guestZone.focus();
    await guestZone.press('Enter');
    await expect(page).toHaveURL(/\/rooms\/[^?]+/);

    // A selected zone can also be removed from the drawing toolbar, without
    // hunting for its row in the layers list or relying on the Delete key.
    await page.goto(editorUrl);
    await page.locator('.pe-item-main').last().click();
    await page.locator('.pe-dock').getByRole('button', { name: `Delete: ${label}` }).click();
    await expect(page.locator('.pe-save')).toHaveText('Saved');
    await expect(page.locator('.pe-item')).toHaveCount(initialCount);
    created = false;

  } finally {
    if (created) {
      await page.goto(editorUrl);
      await expect(page.locator('.pe-item')).toHaveCount(initialCount + 1);
      await page.locator('.pe-item-delete').last().click();
      await expect(page.locator('.pe-save')).toHaveText('Saved');
      await expect(page.locator('.pe-item')).toHaveCount(initialCount);
    }
  }
});
