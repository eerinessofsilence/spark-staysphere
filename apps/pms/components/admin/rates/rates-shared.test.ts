import { describe, expect, it } from 'vitest';
import { ratePreviewHref } from './rates-shared';

describe('ratePreviewHref', () => {
  it('opens the changed room for exactly the changed night', () => {
    expect(ratePreviewHref('deluxe-sea', '2026-10-31')).toBe(
      '/rooms/deluxe-sea?checkIn=2026-10-31&checkOut=2026-11-01&adults=2&children=0',
    );
  });
});
