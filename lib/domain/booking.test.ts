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
  it.each(['3F7K2P', '000000', 'abcdef'])('accepts %s', (value) => {
    expect(BOOKING_REFERENCE_PATTERN.test(value)).toBe(true);
  });

  it.each(['AC-3F7K2P', '3F7K2', '3F7K2PP', '3F7-K2P', ''])('rejects %s', (value) => {
    expect(BOOKING_REFERENCE_PATTERN.test(value)).toBe(false);
  });
});
