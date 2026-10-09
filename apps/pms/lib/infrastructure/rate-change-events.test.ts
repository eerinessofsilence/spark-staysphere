import { describe, expect, it, vi } from 'vitest';
vi.mock('./cloudflare-env', () => ({ getDemoDatabase: () => null }));
import { listRateChanges, recordRateChange } from './rate-change-events';

describe('rate change notifications', () => {
  it('keeps changes scoped to the hotel and returns newest first', async () => {
    const hotelId = `hotel-${crypto.randomUUID()}`;
    const otherHotelId = `hotel-${crypto.randomUUID()}`;
    const base = { rateId: 'rate-1', rateName: 'Flexible', roomTypeId: 'room-1', actorName: 'Operator', description: 'Price changed' };
    await recordRateChange({ ...base, id: crypto.randomUUID(), hotelId, occurredAt: '2026-10-05T10:00:00.000Z' });
    await recordRateChange({ ...base, id: crypto.randomUUID(), hotelId: otherHotelId, occurredAt: '2026-10-05T10:01:00.000Z' });
    await recordRateChange({ ...base, id: crypto.randomUUID(), hotelId, occurredAt: '2026-10-05T10:02:00.000Z' });
    const changes = await listRateChanges(hotelId);
    expect(changes.map((change) => change.occurredAt)).toEqual(['2026-10-05T10:02:00.000Z', '2026-10-05T10:00:00.000Z']);
    expect(await listRateChanges(otherHotelId)).toHaveLength(1);
  });
});
