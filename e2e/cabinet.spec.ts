import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// A far stay that moves each run, so reruns against the persisted D1 never run out of rooms.
const offset = 200 + (Math.floor(Date.now() / 1000) % 100);
const stay = { checkIn: isoDaysFromNow(offset), checkOut: isoDaysFromNow(offset + 3), adults: 2, children: 0 };
const guest = { firstName: 'Mira', lastName: 'Hollis', email: 'mira@example.com', phone: '91 555 0177' };
const roomLabel = /^Room \w{3,4}$/;

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

async function bookFreeDeluxeRoom(request: APIRequestContext, project: string) {
  const quote = await request.post('/api/quotes', {
    data: { roomSlug: 'deluxe-sea', ...stay, addOnIds: [] },
  });
  expect(quote.ok()).toBeTruthy();
  const quoted = await quote.json();
  const expectedTotal = (quoted.quote ?? quoted).price.total;

  for (const room of ['401', '402', '403', '404', '405', '406', '407', '408']) {
    const response = await request.post('/api/bookings', {
      headers: { 'Idempotency-Key': `cabinet-${project}-${Date.now()}-${room}` },
      data: { roomSlug: 'deluxe-sea', ...stay, addOnIds: [], guest, expectedTotal, unitNumber: room },
    });
    if (response.status() === 409) continue;
    expect(response.status()).toBe(201);
    const { booking } = await response.json();
    return { reference: booking.reference as string, room };
  }
  throw new Error('No Deluxe Sea View room was free for the test stay.');
}

test.describe.configure({ mode: 'serial' });

test('the chessboard lays out every room and filters by room type', async ({ page }) => {
  await page.goto('/admin/chessboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Chessboard' })).toBeVisible();

  const summary = page.getByText(/^Tonight \d+ of \d+ rooms are occupied/);
  await expect(summary).toBeVisible();
  const total = Number((await summary.innerText()).match(/of (\d+) rooms/)![1]);
  await expect(page.getByRole('group', { name: roomLabel })).toHaveCount(total);

  await page.goto('/admin/chessboard?type=room_deluxe-sea');
  await expect(page.getByRole('group', { name: roomLabel })).toHaveCount(8);

  // Nonsense parameters fall back to today, 14 nights and every room type.
  await page.goto('/admin/chessboard?from=garbage&days=5&type=nope');
  await expect(page.getByRole('link', { name: '14 nights', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.getByRole('group', { name: roomLabel })).toHaveCount(total);
});

test('a room the guest chose shows on that room in the chessboard', async ({ page, request }, testInfo) => {
  const { reference, room } = await bookFreeDeluxeRoom(request, testInfo.project.name);

  await page.goto(`/admin/chessboard?from=${stay.checkIn}&type=room_deluxe-sea`);
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

  await expect(page).toHaveURL(/\/booking\/AC-/, { timeout: 20_000 });
  await expect(page.getByText(`Room ${room}`)).toBeVisible();
  const reference = (await page.getByText(/^AC-[A-Z0-9]{6}$/).first().innerText()).trim();

  await page.goto(`/admin/chessboard?from=${checkIn}&type=room_${slug}`);
  await expect(
    page
      .getByRole('group', { name: `Room ${room}` })
      .getByRole('button', { name: new RegExp(`^Booking ${reference},.*room chosen by guest$`) }),
  ).toBeVisible();
});
