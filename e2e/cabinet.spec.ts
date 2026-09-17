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
  await expect(page.getByRole('heading', { level: 1, name: 'Front desk' })).toBeVisible();

  const rows = page.getByRole('group', { name: roomLabel });
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  expect(total).toBeGreaterThan(8);

  await page.goto('/admin/front-desk?type=room_deluxe-sea');
  await expect(page.getByRole('group', { name: roomLabel })).toHaveCount(8);

  // Nonsense parameters fall back to today, 14 nights and every room type.
  await page.goto('/admin/front-desk?from=garbage&days=5&type=nope');
  await expect(page.getByRole('link', { name: '14 nights', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.getByRole('group', { name: roomLabel })).toHaveCount(total);
});

test('a room the guest chose shows on that room in the front desk', async ({ page, request }, testInfo) => {
  const { reference, room, stay } = await bookFreeDeluxeRoom(request, testInfo.project.name);

  await page.goto(`/admin/front-desk?from=${stay.checkIn}&type=room_deluxe-sea`);
  const bar = page
    .getByRole('group', { name: `Room ${room}` })
    .getByRole('button', { name: new RegExp(`^Booking ${reference},.*room chosen by guest$`) });
  await expect(bar).toBeVisible();

  const dialog = page.getByRole('dialog', { name: `Booking ${reference}` });
  await actUntil(
    () => bar.click(),
    () => expect(dialog).toBeVisible({ timeout: 3_000 }),
  );
  await expect(dialog.getByText(`Room ${room}`)).toBeVisible();
  await expect(dialog.getByText('Chosen by the guest on the floor plan')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Open booking' })).toHaveAttribute(
    'href',
    `/admin/bookings/${reference}`,
  );
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
  await check(page.getByRole('checkbox', { name: /I understand this is a demo booking/ }));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Confirm demo booking' }).click();

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
