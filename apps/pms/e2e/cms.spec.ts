import { expect, test, type Page } from '@playwright/test';

/**
 * `/admin/content` coverage: a hotel team editing the live catalog without a
 * deploy. Demo state is process-local, exactly like golden-path.spec.ts, so
 * these run serially against the same dev server and the first test resets
 * it — see that file's own note on why.
 */

/** A click on a server-rendered island is lost until React attaches its listeners. */
async function actUntil(act: () => Promise<void>, effect: () => Promise<void>) {
  await expect(async () => {
    await act();
    await effect();
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] });
}

/**
 * `ResetDemoButton` shows no success text — the only content it is certain
 * to change ("No bookings yet") is already true throughout this whole file,
 * since these tests never create a booking. Waiting on that would let
 * `actUntil` return as soon as the click event fires, before the button's
 * own `await resetDemoState()` — which clears the CMS overlay too — has
 * actually resolved, and the very next `page.goto` below can then race or
 * cancel that still-in-flight request. Waiting for the button's own
 * disabled → enabled round trip instead ties this to the promise actually
 * settling: `actUntil` first confirms *this* click was the one that flipped
 * it disabled (ruling out a click lost to a not-yet-hydrated island), then a
 * second wait confirms the pending state has cleared again.
 */
async function resetDemoState(page: Page) {
  await page.goto('/admin/reset');
  const button = page.getByRole('button', { name: 'Reset seed data' });
  await actUntil(
    () => button.click(),
    () => expect(button).toBeDisabled({ timeout: 2_000 }),
  );
  await expect(button).toBeEnabled({ timeout: 15_000 });
}

/** A form's Save button stays disabled until React has attached the form — the moment typing is safe. */
async function formReady(page: Page, saveLabel: string) {
  await expect(page.getByRole('button', { name: saveLabel })).toBeEnabled({ timeout: 20_000 });
}

/** A form with unsaved edits asks before a reload; these tests throw those edits away on purpose. */
function acceptLeaving(page: Page) {
  page.on('dialog', (dialog) => dialog.accept());
}

test.describe.configure({ mode: 'serial' });

test('reset before the CMS suite starts', async ({ page }) => {
  await resetDemoState(page);
});

test('a failed save keeps what was typed and says so beside the button', async ({ page }) => {
  acceptLeaving(page);
  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await formReady(page, 'Save room');
  const description = page.locator('#room-description');
  await description.fill('Typed just before a save that fails.');
  await page.locator('#room-areaM2').fill('');

  await actUntil(
    () => page.getByRole('button', { name: 'Save room' }).click(),
    () => expect(page.getByText('Not saved — 1 field needs attention.')).toBeVisible({ timeout: 5_000 }),
  );
  await expect(page.getByText('Enter the room size in m².')).toBeInViewport();
  await expect(page.locator('#room-areaM2')).toBeFocused();
  // Nothing typed was thrown away, and the empty field was not refilled under its own error.
  await expect(description).toHaveValue('Typed just before a save that fails.');
  await expect(page.locator('#room-areaM2')).toHaveValue('');

  await page.reload();
  await expect(page.locator('#room-description')).not.toHaveValue('Typed just before a save that fails.');
});

test('leaving a form with unsaved changes asks first', async ({ page }) => {
  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await formReady(page, 'Save room');
  const description = page.locator('#room-description');
  await description.fill('A change nobody saved.');
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link');
  const dialog = page.getByRole('dialog', { name: 'Leave without saving?' });
  await breadcrumb.click();
  await dialog.getByRole('button', { name: 'Stay on this page' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/rooms\/room_deluxe-sea$/);
  await expect(description).toHaveValue('A change nobody saved.');

  await breadcrumb.click();
  await dialog.getByRole('button', { name: 'Leave without saving' }).click();
  await expect(page).toHaveURL(/\/admin\/content$/);
});

test('a negative price and a duplicate page address are both rejected, and nothing is saved', async ({ page }) => {
  acceptLeaving(page);
  await page.goto('/admin/content/rooms/new');
  await formReady(page, 'Create room type');
  await page.locator('#room-name').fill('Test Duplicate Room');
  await page.locator('#room-slug').fill('deluxe-sea');
  await page.locator('#room-description').fill('A room used only to test address uniqueness.');
  await page.locator('#room-areaM2').fill('30');
  await page.locator('#room-floor').fill('2');
  await page.locator('#room-capacity').fill('2');
  await page.getByRole('button', { name: 'Create room type' }).click();
  await expect(page.getByText('That page address is already in use.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/content\/rooms\/new/);
  // The failed create kept every field as it was typed.
  await expect(page.locator('#room-description')).toHaveValue('A room used only to test address uniqueness.');

  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await formReady(page, 'Save rate');
  const priceField = page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice');
  const originalPrice = await priceField.inputValue();
  await priceField.fill('-10');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('Enter a price greater than 0.')).toBeVisible();

  // Reload and check the server-rendered value, not the field the failed submit left behind.
  await page.reload();
  await expect(page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice')).toHaveValue(originalPrice);
});

test("a row's menu deletes a CMS add-on after confirming, and won't delete a seed one", async ({ page }) => {
  // A CMS-created add-on of its own — the "creating an add-on" test above
  // already removes Sunset Kayak Tour as its own last step, so this test
  // can't reuse it and needs a fixture nothing else touches.
  await page.goto('/admin/content/add-ons/new');
  await formReady(page, 'Create service');
  await page.locator('#addon-name').fill('Stargazing Deck Night');
  await page.locator('#addon-description').fill('A guided night on the roof deck with a telescope.');
  await page.locator('#addon-price').fill('40');
  await page.getByRole('button', { name: 'Create service' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/add-ons\/addon_stargazing-deck-night\?created=1/, {
    timeout: 10_000,
  });

  await page.goto('/admin/content/add-ons');
  const stargazing = page.getByRole('button', { name: 'Actions for Stargazing Deck Night' });
  const deleteItem = page.getByRole('menuitem', { name: /^Delete/ });
  await actUntil(
    () => stargazing.click(),
    () => expect(deleteItem).toBeVisible({ timeout: 3_000 }),
  );
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
    'href',
    '/admin/content/add-ons/addon_stargazing-deck-night',
  );
  await deleteItem.click();
  const dialog = page.getByRole('dialog', { name: 'Remove Stargazing Deck Night' });
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(stargazing).toHaveCount(0);

  await actUntil(
    () => page.getByRole('button', { name: 'Actions for Late check-out' }).click(),
    () => expect(deleteItem).toBeVisible({ timeout: 3_000 }),
  );
  await expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
});

test('a room is added under its room type, shows on the front desk, and can be removed', async ({ page }) => {
  await page.goto('/admin/content/units/new?type=room_deluxe-sea');
  await formReady(page, 'Create room');
  const number = page.locator('#unit-number');
  await expect(number).not.toHaveValue('');

  await number.fill('401');
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByText('Room 401 already exists.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/content\/units\/new/);

  await number.fill('499');
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/units(#|$)/, { timeout: 10_000 });
  await expect(page.locator('#type-room_deluxe-sea').getByRole('link', { name: 'Room 499' })).toBeVisible();

  await page.goto('/admin/front-desk?type=room_deluxe-sea');
  await expect(page.getByRole('group', { name: 'Room 499' })).toBeVisible();

  await page.goto('/admin/content/units/unit_499');
  await formReady(page, 'Save room');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove Room 499' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/units(#|$)/, { timeout: 20_000 });
  await expect(page.locator('#type-room_deluxe-sea').getByRole('link', { name: 'Room 499' })).toHaveCount(0);
});
