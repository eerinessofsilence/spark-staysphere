import { expect, test, type APIRequestContext } from '@playwright/test';

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// A far stay that moves each run, so reruns against the persisted D1 never run out of rooms.
const offset = 120 + (Math.floor(Date.now() / 1000) % 200);
const stay = { checkIn: isoDaysFromNow(offset), checkOut: isoDaysFromNow(offset + 3), adults: 2, children: 0 };
const guest = { firstName: 'Nadia', lastName: 'Petrova', email: 'nadia@example.com', phone: '91 555 0142' };
const deluxeSeaRooms = ['401', '402', '403', '404', '405', '406', '407', '408'];

async function quoteTotal(request: APIRequestContext, dates = stay): Promise<number> {
  const response = await request.post('/api/quotes', {
    data: { roomSlug: 'deluxe-sea', ...dates, addOnIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return (body.quote ?? body).price.total;
}

function book(
  request: APIRequestContext,
  key: string,
  expectedTotal: number,
  extra: Record<string, unknown> = {},
  dates = stay,
) {
  return request.post('/api/bookings', {
    headers: { 'Idempotency-Key': key },
    data: { roomSlug: 'deluxe-sea', ...dates, addOnIds: [], guest, expectedTotal, ...extra },
  });
}

test.describe.configure({ mode: 'serial' });

let chosenRoom = '';
let chosenReference = '';
let chosenKey = '';

test('a guest can book the exact room they picked', async ({ request }, testInfo) => {
  const total = await quoteTotal(request);

  for (const room of deluxeSeaRooms) {
    const key = `inventory-${testInfo.project.name}-${Date.now()}-${room}`;
    const response = await book(request, key, total, { unitNumber: room });
    if (response.status() === 409) continue;

    expect(response.status()).toBe(201);
    const { booking } = await response.json();
    expect(booking.unitNumber).toBe(room);
    chosenRoom = room;
    chosenReference = booking.reference;
    chosenKey = key;
    break;
  }
  expect(chosenRoom, 'some Deluxe Sea View room should be free for the stay').not.toBe('');

  const readBack = await request.get(`/api/bookings/${chosenReference}`);
  expect(readBack.ok()).toBeTruthy();
  const body = await readBack.json();
  expect((body.booking ?? body).unitNumber).toBe(chosenRoom);
});

test('replaying the same request returns the same booking and room', async ({ request }) => {
  const response = await book(request, chosenKey, await quoteTotal(request), { unitNumber: chosenRoom });
  expect(response.status()).toBe(201);
  const { booking } = await response.json();
  expect(booking.reference).toBe(chosenReference);
  expect(booking.unitNumber).toBe(chosenRoom);
});

test('the same room cannot be booked for overlapping nights', async ({ request }, testInfo) => {
  const sameStay = await book(
    request,
    `inventory-${testInfo.project.name}-${Date.now()}-again`,
    await quoteTotal(request),
    { unitNumber: chosenRoom },
  );
  expect(sameStay.status()).toBe(409);
  const refusal = await sameStay.json();
  expect(refusal.error).toBe('unavailable');
  expect(refusal.message).toContain(`Room ${chosenRoom}`);

  const shifted = { ...stay, checkIn: isoDaysFromNow(offset + 2), checkOut: isoDaysFromNow(offset + 5) };
  const overlapping = await book(
    request,
    `inventory-${testInfo.project.name}-${Date.now()}-overlap`,
    await quoteTotal(request, shifted),
    { unitNumber: chosenRoom },
    shifted,
  );
  expect(overlapping.status()).toBe(409);
});

test('a room belonging to another room type is refused', async ({ request }, testInfo) => {
  const response = await book(
    request,
    `inventory-${testInfo.project.name}-${Date.now()}-other-type`,
    await quoteTotal(request),
    { unitNumber: '801' },
  );
  expect(response.status()).toBe(409);
});

test('a malformed room number is rejected before anything is checked', async ({ request }, testInfo) => {
  const response = await book(
    request,
    `inventory-${testInfo.project.name}-${Date.now()}-malformed`,
    await quoteTotal(request),
    { unitNumber: 'abc' },
  );
  expect(response.status()).toBe(400);
});

test('booking without choosing a room still works', async ({ request }, testInfo) => {
  const response = await book(
    request,
    `inventory-${testInfo.project.name}-${Date.now()}-any-room`,
    await quoteTotal(request),
  );
  expect(response.status()).toBe(201);
  const { booking } = await response.json();
  expect(booking.unitNumber).toBeUndefined();
});
