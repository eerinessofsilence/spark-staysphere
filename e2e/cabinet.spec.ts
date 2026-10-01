import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

interface Stay {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

// A far stay that moves each run, so reruns against the persisted D1 never run out of rooms.
const offset = 200 + (Math.floor(Date.now() / 1000) % 100);
const guest = { firstName: 'Mira', lastName: 'Hollis', email: 'mira@example.com', phone: '91 555 0177' };
const roomLabel = /^Room \w{3,4}$/;

function stayFrom(days: number): Stay {
  return { checkIn: isoDaysFromNow(days), checkOut: isoDaysFromNow(days + 3), adults: 2, children: 0 };
}

/** A click on a server-rendered island is lost until React attaches its listeners. */
async function actUntil(act: () => Promise<void>, effect: () => Promise<void>) {
  await expect(async () => {
    await act();
    await effect();
  }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] });
}

/** A checkbox settles after a round trip; guard on its state so a retry never toggles it back. */
async function check(box: Locator) {
  await actUntil(
    async () => {
      if ((await box.getAttribute('aria-checked')) !== 'true') {
        await box.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        await box.click();
      }
    },
    () => expect(box).toHaveAttribute('aria-checked', 'true', { timeout: 3_000 }),
  );
}

async function bookDeluxeRoom(request: APIRequestContext, stay: Stay, room: string, key: string) {
  const quote = await request.post('/api/quotes', { data: { roomSlug: 'deluxe-sea', ...stay, addOnIds: [] } });
  expect(quote.ok()).toBeTruthy();
  const quoted = await quote.json();
  return request.post('/api/bookings', {
    headers: { 'Idempotency-Key': key },
    data: {
      roomSlug: 'deluxe-sea',
      ...stay,
      addOnIds: [],
      guest,
      expectedTotal: (quoted.quote ?? quoted).price.total,
      unitNumber: room,
    },
  });
}

/**
 * Books a named Deluxe Sea View room. Simulated demand can sell the whole type out on some nights,
 * so it walks forward a week at a time until a stay has a room left, and returns the stay it used.
 */
async function bookFreeDeluxeRoom(request: APIRequestContext, project: string) {
  for (let week = 0; week < 6; week += 1) {
    const stay = stayFrom(offset + week * 7);
    for (const room of ['401', '402', '403', '404', '405', '406', '407', '408']) {
      const response = await bookDeluxeRoom(request, stay, room, `cabinet-${project}-${Date.now()}-${room}`);
      if (response.status() === 409) continue;
      expect(response.status(), await response.text()).toBe(201);
      const { booking } = await response.json();
      return { reference: booking.reference as string, room, stay };
    }
  }
  throw new Error('No Deluxe Sea View room was free for any of the test stays.');
}

test.describe.configure({ mode: 'serial' });

test('the front desk lays out every room and filters by room type', async ({ page }) => {
  await page.goto('/admin/front-desk');
  await expect(page.getByRole('heading', { level: 1, name: 'Front Desk' })).toBeVisible();

  const rows = page.getByRole('group', { name: roomLabel });
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  expect(total).toBeGreaterThan(8);

  await page.goto('/admin/front-desk?type=room_deluxe-sea');
  const deluxeRows = page.getByRole('group', { name: roomLabel });
  await expect(deluxeRows.first()).toBeVisible();
  expect(await deluxeRows.count()).toBeLessThan(total);

  // Nonsense parameters fall back to today, 14 nights and every room type. Any whole number of
  // nights up to 90 is a valid custom range, so the fallback needs one past that.
  await page.goto('/admin/front-desk?from=garbage&days=500&type=nope');
  // On a phone the nights toggle lives in the filter sheet.
  const filters = page.getByRole('button', { name: /^Filters/ });
  if (await filters.isVisible()) {
    await actUntil(
      () => filters.click(),
      () => expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible({ timeout: 3_000 }),
    );
  }
  await expect(page.getByRole('link', { name: '14 nights', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // The sheet's own "Room type" group would otherwise match the room-row pattern too.
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  if (await sheet.isVisible()) {
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toBeHidden();
  }
  await expect(page.getByRole('group', { name: roomLabel })).toHaveCount(total);
});

test('a room the guest chose shows on that room in the front desk', async ({ page, request }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const { reference, room, stay } = await bookFreeDeluxeRoom(request, testInfo.project.name);

  await page.goto(`/admin/front-desk?from=${stay.checkIn}&type=room_deluxe-sea`);
  const bar = page
    .getByRole('group', { name: `Room ${room}` })
    .getByRole('button', { name: new RegExp(`^Booking ${reference},.*room chosen by guest$`) });
  await expect(bar).toBeVisible();
  await expect(page.locator('[data-front-desk-interactive="true"]')).toBeVisible();

  const dialog = page.getByRole('dialog', { name: `Booking ${reference}` });
  await actUntil(
    () => bar.click(),
    () => expect(dialog).toBeVisible({ timeout: 3_000 }),
  );
  await expect(dialog.getByText(`Room ${room}`, { exact: true })).toBeVisible();
  await expect(dialog.getByText('Room rate', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Change the stay’s status' })).toBeVisible();
});

test('dragging a booking to another room type reviews and saves the new price', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The room board uses native desktop drag and drop.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  let booked: { reference: string; room: string; stay: Stay } | null = null;
  for (let day = offset; day < offset + 30 && !booked; day += 1) {
    const stay = { checkIn: isoDaysFromNow(day), checkOut: isoDaysFromNow(day + 1), adults: 2, children: 0 };
    for (const room of ['401', '402', '403', '404', '405', '406', '407', '408']) {
      const response = await bookDeluxeRoom(request, stay, room, `type-move-${testInfo.project.name}-${Date.now()}-${room}`);
      if (response.status() === 409) continue;
      expect(response.status(), await response.text()).toBe(201);
      const { booking } = await response.json();
      booked = { reference: booking.reference as string, room, stay };
      break;
    }
  }
  expect(booked, 'A one-night Deluxe room should be available').not.toBeNull();
  const { reference, room, stay } = booked!;
  await page.goto(`/admin/front-desk?from=${stay.checkIn}&days=1`);
  const source = page.getByRole('group', { name: `Room ${room}` })
    .getByRole('button', { name: new RegExp(`^Booking ${reference},`) });
  await expect(source).toBeVisible();

  let target: Locator | null = null;
  let targetNumber = '';
  for (let number = 301; number <= 310; number += 1) {
    const row = page.getByRole('group', { name: `Room ${number}` });
    if (await row.locator('[data-night-index][title]').count() === 1) {
      target = row;
      targetNumber = String(number);
      break;
    }
  }
  expect(target, 'A Sea View room should be free for the whole stay').not.toBeNull();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await expect(source).toHaveAttribute('draggable', 'true');
  await expect(async () => {
    await source.dispatchEvent('dragstart', { dataTransfer });
    expect(await dataTransfer.evaluate((value) => (value as DataTransfer).types)).toContain('application/x-staysphere-booking-room');
  }).toPass({ timeout: 10_000 });
  await target!.dispatchEvent('dragover', { dataTransfer });
  await target!.dispatchEvent('drop', { dataTransfer });
  const dialog = page.getByRole('dialog', { name: 'Review room type move' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Previous booking price')).toBeVisible();
  await expect(dialog.getByText('New booking price')).toBeVisible();
  await expect(dialog.getByText('Price difference')).toBeVisible();
  const previousPrice = await dialog.getByText('Previous booking price').locator('..').locator('strong').innerText();
  const newPrice = await dialog.getByText('New booking price').locator('..').locator('strong').innerText();
  expect(newPrice).not.toBe(previousPrice);
  await dialog.getByRole('button', { name: 'Confirm move and new price' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('group', { name: `Room ${targetNumber}` })
    .getByRole('button', { name: new RegExp(`^Booking ${reference},`) })).toBeVisible();
});

test('resizing a confirmed booking previews the shorter stay before the price review', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The room board uses desktop pointer gestures.');
  await page.addInitScript(() => localStorage.setItem('admin-tour.seen.v1', '1'));
  const { reference, room, stay } = await bookFreeDeluxeRoom(request, `${testInfo.project.name}-resize`);
  await page.goto(`/admin/front-desk?from=${stay.checkIn}&days=6&type=room_deluxe-sea`);
  const row = page.getByRole('group', { name: `Room ${room}` });
  const bar = row.getByRole('button', { name: new RegExp(`^Booking ${reference},`) });
  await expect(bar).toBeVisible();
  await expect(page.locator('[data-front-desk-interactive="true"]')).toBeVisible();
  const barBox = (await bar.boundingBox())!;
  const secondNight = (await row.locator('[data-night-index="1"]').boundingBox())!;
  const y = barBox.y + barBox.height / 2;
  await page.mouse.move(barBox.x + barBox.width - 3, y);
  await page.mouse.down();
  await page.mouse.move(secondNight.x + secondNight.width / 2, y, { steps: 8 });
  await expect(bar).toContainText('-1');
  const dialog = page.getByRole('dialog', { name: 'Review date change' });
  await expect(dialog).toBeHidden();
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Previous booking price')).toBeVisible();
  await expect(dialog.getByText('New booking price')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm new dates and price' }).click();
  await expect(dialog).toBeHidden();
  const updatedBar = row.getByRole('button', { name: new RegExp(`^Booking ${reference},`) });
  await expect(updatedBar).toBeVisible();
  await expect.poll(async () => (await updatedBar.boundingBox())?.width ?? 0).toBeLessThan(barBox.width - 10);

  const updatedBox = (await updatedBar.boundingBox())!;
  const nextNight = (await row.locator('[data-night-index="1"]').boundingBox())!;
  const updatedY = updatedBox.y + updatedBox.height / 2;
  await page.mouse.move(updatedBox.x + 3, updatedY);
  await page.mouse.down();
  await page.mouse.move(nextNight.x + nextNight.width / 2, updatedY, { steps: 8 });
  await expect(updatedBar).toContainText('-1');
  await expect(dialog).toBeHidden();
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm new dates and price' }).click();
  await expect(dialog).toBeHidden();
});

test('a guest picks a room on the floor plan, books it, and the back office sees that room', async ({
  page,
}) => {
  const checkIn = isoDaysFromNow(offset + 20);
  const checkOut = isoDaysFromNow(offset + 23);
  await page.goto(`/rooms?layout=plan&checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`);

  const free = page.getByRole('button', { name: /^Room \w{3,4}, .+\. Free for your dates$/ }).first();
  await expect(free).toBeVisible();
  const room = (await free.getAttribute('aria-label'))!.match(/^Room (\w{3,4}),/)![1]!;

  const bookLink = page.getByRole('link', { name: `Book room ${room}` });
  await actUntil(
    async () => {
      if (!(await bookLink.isVisible())) await free.click();
    },
    () => expect(bookLink).toBeVisible({ timeout: 3_000 }),
  );
  const slug = (await bookLink.getAttribute('href'))!.match(/^\/book\/([^?]+)\?/)![1]!;

  await bookLink.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Complete your stay' })).toBeVisible();
  await expect(page.getByText(`Room ${room}`).first()).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('First name').fill(guest.firstName);
  await page.getByLabel('Last name').fill(guest.lastName);
  await page.getByLabel('Email').fill(guest.email);
  await page.getByLabel('Phone').fill(guest.phone);
  await page.getByRole('button', { name: 'Continue' }).click();
  await check(page.getByRole('checkbox', { name: /I understand this is a booking at a fictional property/ }));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(page).toHaveURL(/\/booking\/[A-Z0-9]{6}$/, { timeout: 20_000 });
  await expect(page.getByText(`Room ${room}`)).toBeVisible();
  const reference = (await page.getByText(/^[A-Z0-9]{6}$/).first().innerText()).trim();

  await page.goto(`/admin/front-desk?from=${checkIn}&type=room_${slug}`);
  await expect(
    page
      .getByRole('group', { name: `Room ${room}` })
      .getByRole('button', { name: new RegExp(`^Booking ${reference},.*room chosen by guest$`) }),
  ).toBeVisible();
});

test('the desk finds a booking, sees its room, and cancelling puts the room back on sale', async ({
  page,
  request,
}, testInfo) => {
  const { reference, room, stay } = await bookFreeDeluxeRoom(request, testInfo.project.name);

  await page.goto(`/admin/bookings?q=${reference}`);
  const row = page.getByRole('row').filter({ hasText: reference });
  await expect(row).toHaveCount(1);
  await expect(row.getByText(`Room ${room}`)).toBeVisible();
  await expect(row.getByText('(chosen by the guest)')).toBeAttached();

  await row.getByRole('link', { name: reference }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Booking details' })).toBeVisible();
  const details = page.getByRole('region', { name: 'Booking', exact: true });
  await expect(details.getByText(reference)).toBeVisible();
  await expect(details.getByText(`Room ${room}`)).toBeVisible();
  await expect(details.getByText('Chosen by the guest', { exact: true })).toBeVisible();

  const dialog = page.getByRole('dialog', { name: 'Cancel booking' });
  await actUntil(
    () => page.getByRole('button', { name: 'Cancel booking' }).click(),
    () => expect(dialog).toBeVisible({ timeout: 3_000 }),
  );
  await dialog.getByRole('button', { name: 'Yes, cancel booking' }).click();
  await expect(page.getByText('Booking cancelled. Its nights are back on sale.')).toBeVisible();
  await expect(page.getByText('Released', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);

  await page.goto(`/admin/front-desk?from=${stay.checkIn}&type=room_deluxe-sea`);
  await expect(page.getByRole('group', { name: `Room ${room}` })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^Booking ${reference},`) })).toHaveCount(0);

  // The same room can be booked again for the same nights.
  const rebooked = await bookDeluxeRoom(
    request,
    stay,
    room,
    `cabinet-rebook-${testInfo.project.name}-${Date.now()}`,
  );
  expect(rebooked.status(), await rebooked.text()).toBe(201);
});

test('reservations filter by stay dates, from the URL and from the toolbar calendar', async ({ page, request }, testInfo) => {
  const { reference, stay } = await bookFreeDeluxeRoom(request, testInfo.project.name);
  const row = page.getByRole('row').filter({ hasText: reference });

  // Any night of the stay matches — here its first.
  await page.goto(`/admin/bookings?from=${stay.checkIn}&to=${stay.checkIn}`);
  await expect(row).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Stay dates:/ })).toBeVisible();

  // The check-out day is not a night, so a range that starts there leaves the stay out.
  await page.goto(`/admin/bookings?from=${stay.checkOut}&to=${stay.checkOut}`);
  await expect(row).toHaveCount(0);

  await page.goto('/admin/bookings');
  const dialog = page.getByRole('dialog', { name: 'Filter by stay dates' });
  await actUntil(
    () => page.getByRole('button', { name: 'Filter by stay dates' }).click(),
    () => expect(dialog).toBeVisible({ timeout: 3_000 }),
  );
  await expect(dialog.getByRole('button', { name: 'Show stays' })).toBeDisabled();
});
