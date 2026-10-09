import { expect, test, type Page } from '@playwright/test';

async function chooseTool(page: Page, name: RegExp) {
  const tool = page.getByRole('button', { name });
  await expect(async () => {
    if (await tool.getAttribute('aria-pressed') !== 'true') await tool.click();
    await expect(tool).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

async function drawRectangle(page: Page) {
  await chooseTool(page, /Rectangle/);
  const canvas = page.locator('.pe-canvas svg');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.65, { steps: 5 });
  await page.mouse.up();
}

async function waitForSave(page: Page) {
  await expect(page.locator('.pe-save')).not.toHaveText('Saved');
  await expect(page.locator('.pe-save')).toHaveText('Saved');
}

test('selected zone text remains legible in the dark editor', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('admin-tour.seen.v1', '1');
    localStorage.setItem('spark.theme', 'dark');
  });
  await page.goto('/admin/content/spinner/markup?frame=1');
  const initialCount = await page.locator('.pe-item').count();
  await drawRectangle(page);
  await expect(page.locator('.pe-item')).toHaveCount(initialCount + 1);
  await waitForSave(page);
  try {
    const selected = page.locator('.pe-item[data-selected]');
    await expect(selected).toHaveCount(1);
    const colors = await selected.evaluate((element) => {
      const label = element.querySelector('.pe-item-label');
      const index = element.querySelector('.pe-item-index');
      const count = element.querySelector('.pe-muted');
      return {
        background: getComputedStyle(element).backgroundColor,
        label: getComputedStyle(label!).color,
        index: getComputedStyle(index!).color,
        count: getComputedStyle(count!).color,
      };
    });
    expect(colors.label).toBe(colors.index);
    expect(colors.label).toBe(colors.count);
    const luminance = (rgb: string) => {
      const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    const foreground = luminance(colors.label);
    const background = luminance(colors.background);
    expect(foreground).toBeGreaterThan(0.7);
    expect(background).toBeLessThan(0.1);
    expect((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)).toBeGreaterThanOrEqual(4.5);
  } finally {
    await page.locator('.pe-item[data-selected] .pe-item-delete').click();
    await expect(page.locator('.pe-item')).toHaveCount(initialCount);
    await waitForSave(page);
  }
});

test('closes a polygon by double-clicking its final point', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The drawing editor needs desktop width.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/content/spinner/markup?frame=1');
  await expect(page.locator('[data-pe-root]')).toBeVisible();
  const initialCount = await page.locator('.pe-item').count();
  let created = false;

  try {
    await chooseTool(page, /Polygon/);
    const box = (await page.locator('.pe-canvas svg').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.35);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.35);
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
    await page.mouse.dblclick(box.x + box.width * 0.35, box.y + box.height * 0.55);

    await expect(page.locator('.pe-item')).toHaveCount(initialCount + 1);
    created = true;
    await waitForSave(page);
    await expect(page.locator('.pe-dock button').first()).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.65);
    await expect(page.locator('.hs-draft')).toHaveCount(0);
  } finally {
    if (created) {
      await page.locator('.pe-dock').getByRole('button', { name: /Delete:/ }).click();
      await expect(page.locator('.pe-item')).toHaveCount(initialCount);
      await waitForSave(page);
    }
  }
});

// Preserve the current catalog and existing zones: only remove the zone this test draws.
test('choose a room directly, autosave and reload the zone binding', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name === 'mobile', 'The drawing editor needs desktop width.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/content/spinner/markup?frame=1');
  const editorUrl = page.url();
  await expect(page.locator('[data-pe-root]')).toBeVisible();
  const initialCount = await page.locator('.pe-item').count();
  let created = false;
  try {
    await drawRectangle(page);
    await expect(page.locator('.pe-item')).toHaveCount(initialCount + 1);
    created = true;
    await waitForSave(page);

    const room = page.getByRole('combobox', { name: 'Room', exact: true });
    await expect(room).toHaveValue('');
    await expect(page.getByRole('radiogroup', { name: 'Target kind' })).toHaveCount(0);
    const roomId = await room.locator('option:not([disabled])').first().getAttribute('value');
    await room.selectOption(roomId!);
    await expect(page.getByTestId('zone-room-preview')).toBeVisible();
    await expect(page.getByTestId('zone-room-preview').locator('img')).toBeVisible();
    await waitForSave(page);
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
    await waitForSave(page);
    await room.selectOption(roomId!);
    await waitForSave(page);
    // A selected zone can also be removed from the drawing toolbar, without
    // hunting for its row in the layers list or relying on the Delete key.
    await page.goto(editorUrl);
    await page.locator('.pe-item-main').last().click();
    await page.locator('.pe-dock').getByRole('button', { name: `Delete: ${label}` }).click();
    await expect(page.locator('.pe-item')).toHaveCount(initialCount);
    await waitForSave(page);
    created = false;

  } finally {
    if (created) {
      await page.goto(editorUrl);
      await expect(page.locator('.pe-item')).toHaveCount(initialCount + 1);
      await page.locator('.pe-item-delete').last().click();
      await expect(page.locator('.pe-item')).toHaveCount(initialCount);
      await waitForSave(page);
    }
  }
});
