import { expect, test, type Page } from '@playwright/test';

/**
 * `/admin/content` coverage: a hotel team editing the live catalog without a
 * deploy. Demo state is process-local, exactly like golden-path.spec.ts, so
 * these run serially against the same dev server and the first test resets
 * it — see that file's own note on why.
 */

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const checkIn = isoDaysFromNow(70);
const checkOut = isoDaysFromNow(73);
const stayQuery = `checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`;

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
  const button = page.getByRole('button', { name: 'Reset demo state' });
  await actUntil(
    () => button.click(),
    () => expect(button).toBeDisabled({ timeout: 2_000 }),
  );
  await expect(button).toBeEnabled({ timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test('reset before the CMS suite starts', async ({ page }) => {
  await resetDemoState(page);
});

test('renaming a room and changing its rate shows up on /rooms, the room page, and a fresh quote', async ({
  page,
}) => {
  await page.goto(`/book/deluxe-sea?${stayQuery}`);
  const summaryBefore = page.getByRole('complementary', { name: 'Deluxe Sea View' });
  await expect(summaryBefore).toBeVisible();
  const totalBefore = await summaryBefore.locator('.text-display').last().innerText();

  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await page.locator('#room-name').fill('Seaside Deluxe Retreat');
  await actUntil(
    () => page.getByRole('button', { name: 'Save room' }).click(),
    () => expect(page.getByText('Room saved.')).toBeVisible({ timeout: 5_000 }),
  );

  const priceField = page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice');
  await priceField.fill('499');
  await actUntil(
    () => page.getByRole('button', { name: 'Save rate' }).click(),
    () => expect(page.getByText('Rate saved.')).toBeVisible({ timeout: 5_000 }),
  );

  await page.goto(`/rooms?${stayQuery}&hideSoldOut=1`);
  await expect(
    page.getByRole('region', { name: 'Search results' }).getByText('Seaside Deluxe Retreat'),
  ).toBeVisible();

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Seaside Deluxe Retreat' })).toBeVisible();

  await page.goto(`/book/deluxe-sea?${stayQuery}`);
  const summaryAfter = page.getByRole('complementary', { name: 'Seaside Deluxe Retreat' });
  await expect(summaryAfter).toBeVisible();
  const totalAfter = await summaryAfter.locator('.text-display').last().innerText();
  expect(totalAfter).not.toEqual(totalBefore);
});

test('hiding a room removes it from the catalog and 404s its page; showing it restores both', async ({
  page,
}) => {
  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await actUntil(
    () => page.getByRole('button', { name: 'Hide from the site' }).click(),
    () => expect(page.getByText('Room hidden from the site.')).toBeVisible({ timeout: 5_000 }),
  );

  await page.goto(`/rooms?${stayQuery}&hideSoldOut=1`);
  await expect(
    page.getByRole('region', { name: 'Search results' }).locator('a[href*="/rooms/deluxe-sea"]'),
  ).toHaveCount(0);

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByRole('heading', { name: 'We could not find that page' })).toBeVisible();

  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await actUntil(
    () => page.getByRole('button', { name: 'Show on the site' }).click(),
    () => expect(page.getByText('Room is now on the site.')).toBeVisible({ timeout: 5_000 }),
  );

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('creating an add-on offers it in a room\'s picker; withdrawing it removes the offer', async ({ page }) => {
  await page.goto('/admin/content/add-ons/new');
  await page.locator('#addon-name').fill('Sunset Kayak Tour');
  await page.locator('#addon-description').fill('A guided kayak tour at golden hour, back before dinner.');
  await page.locator('#addon-price').fill('55');
  await page.getByRole('button', { name: 'Create service' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/add-ons\/addon_sunset-kayak-tour/, { timeout: 10_000 });

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  const card = page.getByRole('button', { name: /Open .*Sunset Kayak Tour/i });
  await actUntil(
    async () => {
      await card.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await card.click();
    },
    () => expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 }),
  );
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Add to your stay|Save changes/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByRole('complementary', { name: 'Your stay' }).getByText('Sunset Kayak Tour'),
  ).toBeVisible();

  await page.goto('/admin/content/add-ons/addon_sunset-kayak-tour');
  const enabledSwitch = page.getByRole('switch', { name: 'On sale' });
  await actUntil(
    () => enabledSwitch.click(),
    () => expect(enabledSwitch).toHaveAttribute('aria-checked', 'false', { timeout: 3_000 }),
  );
  await actUntil(
    () => page.getByRole('button', { name: 'Save add-on' }).click(),
    () => expect(page.getByText('Add-on saved.')).toBeVisible({ timeout: 5_000 }),
  );

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByText('Sunset Kayak Tour')).toHaveCount(0);
});

test('a negative price and a duplicate slug are both rejected, and nothing is saved', async ({ page }) => {
  await page.goto('/admin/content/rooms/new');
  await page.locator('#room-name').fill('Test Duplicate Room');
  await page.locator('#room-slug').fill('deluxe-sea');
  await page.locator('#room-description').fill('A room used only to test slug uniqueness.');
  await page.locator('#room-areaM2').fill('30');
  await page.locator('#room-floor').fill('2');
  await page.locator('#room-capacity').fill('2');
  await page.getByRole('button', { name: 'Create room type' }).click();
  await expect(page.getByText('That slug is already in use.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/content\/rooms\/new/);

  await page.goto('/admin/content/rooms/room_deluxe-sea');
  const priceField = page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice');
  await priceField.fill('-10');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('Enter a price of 0 or higher.')).toBeVisible();

  // Reload and check the server-rendered value, not the field the failed submit left behind.
  await page.reload();
  await expect(page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice')).toHaveValue('499');
});

test("a row's menu deletes a CMS add-on after confirming, and won't delete a seed one", async ({ page }) => {
  await page.goto('/admin/content/add-ons');

  const kayak = page.getByRole('button', { name: 'Actions for Sunset Kayak Tour' });
  const deleteItem = page.getByRole('menuitem', { name: /^Delete/ });
  await actUntil(
    () => kayak.click(),
    () => expect(deleteItem).toBeVisible({ timeout: 3_000 }),
  );
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
    'href',
    '/admin/content/add-ons/addon_sunset-kayak-tour',
  );
  await deleteItem.click();
  const dialog = page.getByRole('dialog', { name: 'Remove Sunset Kayak Tour' });
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(kayak).toHaveCount(0);

  await actUntil(
    () => page.getByRole('button', { name: 'Actions for Late check-out' }).click(),
    () => expect(deleteItem).toBeVisible({ timeout: 3_000 }),
  );
  await expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
});

test('a room is added under its room type, shows on the Property Desk, and can be removed', async ({ page }) => {
  await page.goto('/admin/content/units/new?type=room_deluxe-sea');
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

  await page.goto('/admin/chessboard?type=room_deluxe-sea');
  await expect(page.getByRole('group', { name: 'Room 499' })).toBeVisible();

  await page.goto('/admin/content/units/unit_499');
  page.on('dialog', (dialog) => dialog.accept());
  await actUntil(
    () => page.getByRole('button', { name: 'Remove Room 499' }).click(),
    () => expect(page).toHaveURL(/\/admin\/content\/units(#|$)/, { timeout: 5_000 }),
  );
  await expect(page.locator('#type-room_deluxe-sea').getByRole('link', { name: 'Room 499' })).toHaveCount(0);
});

test('a facility added under Hotel Settings shows on the arrival page', async ({ page }) => {
  await page.goto('/admin/content/hotel');
  const tab = page.getByRole('tab', { name: 'Facilities' });
  await actUntil(
    () => tab.click(),
    () => expect(page.getByRole('tabpanel', { name: 'Facilities' })).toBeVisible({ timeout: 2_000 }),
  );

  // Picking an icon suggests the name; typing over it keeps the icon.
  await page.getByRole('button', { name: /^New facility icon/ }).click();
  await page.getByRole('option', { name: 'Cinema' }).click();
  const draft = page.getByRole('textbox', { name: 'Add a facility' });
  await expect(draft).toHaveValue('Cinema');
  await draft.fill('Open-air cinema');
  await page.getByRole('button', { name: 'Add facility' }).click();
  await expect(page.getByRole('button', { name: /^Icon for Open-air cinema/ })).toBeVisible();

  await actUntil(
    () => page.getByRole('button', { name: 'Save hotel details' }).click(),
    () => expect(page.getByText('Hotel details saved.')).toBeVisible({ timeout: 5_000 }),
  );

  await page.goto('/');
  const facilities = page.getByRole('list', { name: 'Facilities' });
  await expect(facilities.getByText('Open-air cinema')).toBeVisible();
  // The seed's own facilities are still there, ahead of the new one.
  await expect(facilities.getByText('25-metre infinity pool')).toBeVisible();
});

test('resetting content restores the seed catalog', async ({ page }) => {
  await resetDemoState(page);

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Deluxe Sea View' })).toBeVisible();

  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await expect(page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice')).toHaveValue('348');

  await page.goto('/admin/content/add-ons');
  await expect(page.getByText('Sunset Kayak Tour')).toHaveCount(0);
});
