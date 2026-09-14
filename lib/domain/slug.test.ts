import { describe, expect, it } from 'vitest';
import { KEBAB_CASE, kebabSuggestion } from './slug';

describe('kebabSuggestion', () => {
  it('lowercases and hyphenates a free-text name', () => {
    expect(kebabSuggestion('Sunset Kayak Tour')).toBe('sunset-kayak-tour');
  });

  it('collapses runs of punctuation and whitespace into one hyphen', () => {
    expect(kebabSuggestion('  Deluxe   Sea -- View!! Room  ')).toBe('deluxe-sea-view-room');
  });

  it('trims leading and trailing hyphens', () => {
    expect(kebabSuggestion('--Spa & Wellness--')).toBe('spa-wellness');
  });

  it('every suggestion it produces satisfies KEBAB_CASE', () => {
    const inputs = ['Café Terrace', "Chef's Table", 'Two-Bedroom Residence', '2 Adults'];
    for (const input of inputs) {
      const suggestion = kebabSuggestion(input);
      expect(suggestion).toMatch(KEBAB_CASE);
    }
  });
});

describe('KEBAB_CASE', () => {
  it.each(['deluxe-sea-view', 'spa', 'room-2'])('accepts %s', (value) => {
    expect(KEBAB_CASE.test(value)).toBe(true);
  });

  it.each(['Deluxe-Sea', 'deluxe--sea', '-deluxe', 'deluxe-', 'deluxe sea', ''])(
    'rejects %s',
    (value) => {
      expect(KEBAB_CASE.test(value)).toBe(false);
    },
  );
});
