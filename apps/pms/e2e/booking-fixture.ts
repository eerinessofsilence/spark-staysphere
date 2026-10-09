import { expect, type APIRequestContext } from '@playwright/test';

/** Create the record the scenario needs in its isolated server, including a real quote. */
export async function createAwaitingBooking(request: APIRequestContext, tag: string, offset = 160) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const start = new Date();
    start.setDate(start.getDate() + offset + attempt * 3);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const stay = { roomSlug: 'deluxe-sea', checkIn: start.toISOString().slice(0, 10), checkOut: end.toISOString().slice(0, 10), adults: 2, children: 0, addOnIds: [] };
    const quoteResponse = await request.post('/api/quotes', { data: stay });
    expect(quoteResponse.ok()).toBeTruthy();
    const body = await quoteResponse.json();
    const quote = body.quote ?? body;
    if (!quote.available) continue;
    const response = await request.post('/api/bookings', {
      headers: { 'Idempotency-Key': `e2e-${tag}-${crypto.randomUUID()}` },
      data: { ...stay, expectedTotal: quote.price.total, paymentMethod: 'pay_at_hotel', guest: { firstName: 'Invoice', lastName: 'Preview Test', email: 'invoice-preview@example.com', phone: '5551234567' } },
    });
    if (response.status() === 409) continue;
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()).booking as { reference: string; createdAt: string; checkIn: string; checkOut: string };
  }
  throw new Error(`No free stay for ${tag}`);
}
