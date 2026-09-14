import { describe, expect, it } from 'vitest';
import { BOOKING_REFERENCE_PATTERN, matchesGuestEmail } from './booking';

describe('matchesGuestEmail', () => {
  it('matches the same address', () => {
    expect(matchesGuestEmail('guest@example.com', 'guest@example.com')).toBe(true);
  });

  it('ignores case', () => {
    expect(matchesGuestEmail('Guest@Example.com', 'guest@example.com')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(matchesGuestEmail('guest@example.com', '  guest@example.com  ')).toBe(true);
  });

  it('rejects a different address', () => {
    expect(matchesGuestEmail('guest@example.com', 'someone-else@example.com')).toBe(false);
  });
});

describe('BOOKING_REFERENCE_PATTERN', () => {
  it.each(['AC-3F7K2P', 'AC-000000', 'AC-abcdef'])('accepts %s', (value) => {
    expect(BOOKING_REFERENCE_PATTERN.test(value)).toBe(true);
  });

  it.each(['ac-3f7k2p', 'AC-3F7K2', 'AC-3F7K2PP', 'XX-3F7K2P', '3F7K2P'])('rejects %s', (value) => {
    expect(BOOKING_REFERENCE_PATTERN.test(value)).toBe(false);
  });
});
