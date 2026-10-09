import { expect, test } from '@playwright/test';

test('dragging over free nights shows the add-booking action', async ({ page }, testInfo) => {
  testInfo.skip(testInfo.project.name !== 'desktop', 'Creating a booking by dragging uses a mouse.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  await page.goto('/admin/front-desk?days=14');
  await expect(page.locator('[data-front-desk-interactive="true"]')).toBeVisible();

  const target = await page.locator('[role="group"][aria-label^="Room "]').evaluateAll((rows) => {
    for (const row of rows) {
      const free = new Set([...row.querySelectorAll<HTMLElement>('[data-night-index][title]')]
        .map((cell) => Number(cell.dataset.nightIndex)));
      for (const start of free) {
        if (free.has(start + 1) && free.has(start + 2)) {
          return { room: row.getAttribute('aria-label'), start, end: start + 2 };
        }
      }
    }
    return null;
  });
  expect(target, 'A room should have three consecutive free nights').not.toBeNull();
  const row = page.getByRole('group', { name: target!.room!, exact: true });
  const first = row.locator(`[data-night-index="${target!.start}"]`);
  const last = row.locator(`[data-night-index="${target!.end}"]`);
  await first.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  const firstBox = (await first.boundingBox())!;
  const lastBox = (await last.boundingBox())!;
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, { steps: 8 });
  await expect(row.locator('[data-booking-drag-preview]')).toContainText('Add booking');
  await page.mouse.up();
  const dialog = page.getByRole('dialog', { name: 'New booking' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
});
