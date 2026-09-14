import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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
  await page.goto('/admin');
  const button = page.getByRole('button', { name: 'Reset demo state' });
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

/** Books a named Deluxe Sea View room far ahead, the way a guest picking it on the floor plan would. */
async function bookPickedDeluxeRoom(request: APIRequestContext, project: string): Promise<string> {
  for (const offset of [300, 307, 314, 321]) {
    const stay = { checkIn: isoDaysFromNow(offset), checkOut: isoDaysFromNow(offset + 2), adults: 2, children: 0 };
    const quote = await request.post('/api/quotes', { data: { roomSlug: 'deluxe-sea', ...stay, addOnIds: [] } });
    const quoted = await quote.json();
    for (const room of ['401', '402', '403', '404', '405', '406', '407', '408']) {
      const response = await request.post('/api/bookings', {
        headers: { 'Idempotency-Key': `cms-pick-${project}-${Date.now()}-${room}` },
        data: {
          roomSlug: 'deluxe-sea',
          ...stay,
          addOnIds: [],
          guest: { firstName: 'Ines', lastName: 'Varga', email: 'ines@example.com', phone: '91 555 0190' },
          expectedTotal: (quoted.quote ?? quoted).price.total,
          unitNumber: room,
        },
      });
      if (response.status() === 409) continue;
      expect(response.status(), await response.text()).toBe(201);
      return room;
    }
  }
  throw new Error('No Deluxe Sea View room was free for the test stays.');
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
  await formReady(page, 'Save room');
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

test('hiding a room removes it from the catalog and 404s its page; showing it restores both', async ({
  page,
}) => {
  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await actUntil(
    () => page.getByRole('button', { name: 'Hide from the site' }).click(),
    () => expect(page.getByText('Room hidden from the site.')).toBeVisible({ timeout: 5_000 }),
  );

  // The hide just moved the room's version on; saving the form next must not be read as someone else's edit.
  await page.getByRole('button', { name: 'Save room' }).click();
  await expect(page.getByText('Room saved.')).toBeVisible();
  await expect(page.getByText(/Someone else saved/)).toHaveCount(0);

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

test('creating an add-on offers it in a room\'s picker; withdrawing it removes the offer; removing it returns to the list', async ({
  page,
}) => {
  await page.goto('/admin/content/add-ons/new');
  await formReady(page, 'Create add-on');
  await page.locator('#addon-name').fill('Sunset Kayak Tour');
  await page.locator('#addon-description').fill('A guided kayak tour at golden hour, back before dinner.');
  await page.locator('#addon-price').fill('55');
  await page.getByRole('button', { name: 'Create add-on' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/add-ons\/addon_sunset-kayak-tour\?created=1/, { timeout: 10_000 });
  await expect(page.getByText('Add-on created.')).toBeVisible();

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

  // On sale is a switch that acts at once, the same on the add-on's page as in the list.
  await page.goto('/admin/content/add-ons/addon_sunset-kayak-tour');
  const onSale = page.getByRole('switch', { name: 'On sale' });
  await actUntil(
    async () => {
      if ((await onSale.getAttribute('aria-checked')) !== 'false') await onSale.click();
    },
    () => expect(page.getByText('Withdrawn from sale.')).toBeVisible({ timeout: 5_000 }),
  );

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByText('Sunset Kayak Tour')).toHaveCount(0);

  // A demo add-on offers no delete at all; one made in the CMS is removed from its dialog.
  await page.goto('/admin/content/add-ons/addon_late');
  await expect(page.getByRole('button', { name: 'Remove Late check-out' })).toHaveCount(0);
  await expect(page.getByText(/Came with the demo catalog/)).toBeVisible();

  await page.goto('/admin/content/add-ons/addon_sunset-kayak-tour');
  const removeDialog = page.getByRole('dialog', { name: 'Remove Sunset Kayak Tour?' });
  await actUntil(
    () => page.getByRole('button', { name: 'Remove Sunset Kayak Tour' }).click(),
    () => expect(removeDialog).toBeVisible({ timeout: 3_000 }),
  );
  await removeDialog.getByRole('button', { name: 'Remove add-on' }).click();
  await expect(page).toHaveURL(/\/admin\/content\?removed=/);
  await expect(page.getByText('“Sunset Kayak Tour” was removed.')).toBeVisible();
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
  await priceField.fill('-10');
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('Enter a price greater than 0.')).toBeVisible();

  // Reload and check the server-rendered value, not the field the failed submit left behind.
  await page.reload();
  await expect(page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice')).toHaveValue('499');
});

test('a room a guest picked keeps its number: the floor cannot move under it', async ({ page, request }, testInfo) => {
  acceptLeaving(page);
  const room = await bookPickedDeluxeRoom(request, testInfo.project.name);

  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await expect(page.getByText(new RegExp(`Guests picked .*${room}`))).toBeVisible();
  await formReady(page, 'Save room');
  await page.locator('#room-floor').fill('5');
  await actUntil(
    () => page.getByRole('button', { name: 'Save room' }).click(),
    () => expect(page.getByText(/would renumber/).first()).toBeVisible({ timeout: 5_000 }),
  );

  await page.reload();
  await expect(page.locator('#room-floor')).toHaveValue('4');
});

test('the content list finds rooms and add-ons by name and status', async ({ page }) => {
  await page.goto('/admin/content?q=suite&show=rooms');
  const rows = page.getByRole('table', { name: /Room types/ }).locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  for (const text of await rows.allInnerTexts()) expect(text.toLowerCase()).toContain('suite');
  await expect(page.getByRole('heading', { name: 'Add-ons' })).toHaveCount(0);

  await page.goto('/admin/content?show=addons&status=off&q=no-such-thing');
  await expect(page.getByRole('heading', { name: 'Nothing matches' })).toBeVisible();
});

test('resetting content restores the seed catalog', async ({ page }) => {
  await resetDemoState(page);

  await page.goto(`/rooms/deluxe-sea?${stayQuery}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Deluxe Sea View' })).toBeVisible();

  await page.goto('/admin/content/rooms/room_deluxe-sea');
  await expect(page.locator('#rate-rate_deluxe-sea_flex-nightlyPrice')).toHaveValue('348');

  await page.goto('/admin/content');
  await expect(page.getByText('Sunset Kayak Tour')).toHaveCount(0);
});
