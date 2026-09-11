import { addDays, parseISO } from 'date-fns';
import type { RoomSearchInterpreter, SearchIntent } from '../domain/ports';
import { roomCategories, type RoomCategory } from '../domain/room-attributes';
import type { RoomType } from '../domain/schemas';

/**
 * Deterministic stand-in for the OpenAI interpreter: a small vocabulary of
 * the phrases a guest actually says, mapped straight to the same
 * `SearchIntent` shape. This is what a keyless `npm run dev` and
 * `npm run test:e2e` run against, so every example chip the idle panel
 * offers must be something this file can resolve.
 */

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const VIEW_WORDS: Record<RoomType['view'], string[]> = {
  sea: ['sea', 'ocean', 'seaview', 'sea-view', 'coast', 'coastal'],
  garden: ['garden'],
  pool: ['pool'],
  city: ['city'],
};

const BED_WORDS: Record<RoomType['bedType'], string[]> = {
  king: ['king'],
  queen: ['queen'],
  twin: ['twin beds', 'twin', 'two beds', 'separate beds'],
};

const CATEGORY_WORDS: Record<RoomCategory, string[]> = {
  penthouse: ['penthouse'],
  residence: ['residence'],
  loft: ['loft'],
  suite: ['suite'],
  studio: ['studio'],
  room: [],
};

/** An amenity matches when a real word of its own name (4+ letters) shows up in the utterance. */
function matchAmenities(utterance: string, amenities: string[]): string[] {
  return amenities.filter((amenity) =>
    amenity
      .toLowerCase()
      .split(/[\s-]+/)
      .some((word) => word.length >= 4 && utterance.includes(word)),
  );
}

function parsePrice(utterance: string): { minPrice?: number; maxPrice?: number } {
  const under = utterance.match(/(?:under|below|less than|up to|no more than)\s*(?:€|eur|\$|usd|£|gbp)?\s*(\d{2,5})/);
  if (under) return { maxPrice: Number(under[1]) };
  const over = utterance.match(/(?:over|above|more than|starting (?:at|from)|from)\s*(?:€|eur|\$|usd|£|gbp)?\s*(\d{2,5})/);
  if (over) return { minPrice: Number(over[1]) };
  if (/\b(cheap|budget|affordable|inexpensive)\b/.test(utterance)) return { maxPrice: 250 };
  if (/\b(luxury|lavish|top[- ]?end|splurge|high[- ]?end)\b/.test(utterance)) return { minPrice: 400 };
  return {};
}

function parseGuests(utterance: string): { adults?: number; children?: number } {
  const result: { adults?: number; children?: number } = {};

  const adultsMatch = utterance.match(/(\d+)\s*(adults?|guests?|people|persons?)/);
  if (adultsMatch) result.adults = Number(adultsMatch[1]);
  else if (/\b(two people|a couple|for two|me and my partner)\b/.test(utterance)) result.adults = 2;
  else if (/\b(solo|by myself|just me|one person)\b/.test(utterance)) result.adults = 1;

  const childrenMatch = utterance.match(/(\d+)\s*(children|kids?)/);
  if (childrenMatch) result.children = Number(childrenMatch[1]);
  else if (/\bfamily\b/.test(utterance) && result.adults === undefined) result.adults = 2;

  return result;
}

function parseDates(utterance: string, today: string): { checkIn?: string; checkOut?: string } {
  const base = parseISO(today);

  if (/\bnext weekend\b/.test(utterance)) {
    const daysUntilFriday = ((5 - base.getDay() + 7) % 7) || 7;
    const checkIn = addDays(base, daysUntilFriday);
    return { checkIn: iso(checkIn), checkOut: iso(addDays(checkIn, 2)) };
  }
  if (/\btonight\b/.test(utterance)) {
    return { checkIn: iso(base), checkOut: iso(addDays(base, 1)) };
  }
  if (/\bthis weekend\b/.test(utterance)) {
    const daysUntilSaturday = (6 - base.getDay() + 7) % 7;
    const checkIn = addDays(base, daysUntilSaturday);
    return { checkIn: iso(checkIn), checkOut: iso(addDays(checkIn, 2)) };
  }
  if (/\bnext week\b/.test(utterance)) {
    const checkIn = addDays(base, 7);
    return { checkIn: iso(checkIn), checkOut: iso(addDays(checkIn, 3)) };
  }
  const nightsMatch = utterance.match(/(\d+)\s*nights?/);
  if (nightsMatch) {
    const checkIn = addDays(base, 14);
    return { checkIn: iso(checkIn), checkOut: iso(addDays(checkIn, Number(nightsMatch[1]))) };
  }
  return {};
}

/** The one thing this fallback admits it dropped, when a "near X" clause matched nothing above. */
function findUnresolved(utterance: string, recognisedWords: string[]): string[] {
  const nearMatch = utterance.match(/\b(?:near|close to|next to)\s+([a-z][a-z\s]{2,30})/i);
  if (!nearMatch) return [];
  const clause = nearMatch[1].toLowerCase();
  if (recognisedWords.some((word) => clause.includes(word))) return [];
  return [nearMatch[0].trim()];
}

export const keywordSearchInterpreter: RoomSearchInterpreter = {
  async interpret({ utterance, today, facets }): Promise<SearchIntent> {
    const text = ` ${utterance.toLowerCase()} `;

    const views = (Object.keys(VIEW_WORDS) as RoomType['view'][])
      .filter((view) => VIEW_WORDS[view].some((word) => text.includes(word)))
      .filter((view) => facets.views.includes(view));

    const bedTypes = (Object.keys(BED_WORDS) as RoomType['bedType'][])
      .filter((bed) => BED_WORDS[bed].some((word) => text.includes(word)))
      .filter((bed) => facets.bedTypes.includes(bed));

    const categories = roomCategories
      .filter((category) => CATEGORY_WORDS[category].some((word) => text.includes(word)))
      .filter((category) => facets.categories.includes(category));

    const amenities = matchAmenities(text, facets.amenities);
    const { minPrice, maxPrice } = parsePrice(text);
    const { adults, children } = parseGuests(text);
    const { checkIn, checkOut } = parseDates(text, today);

    const recognisedWords = [
      ...views.flatMap((view) => VIEW_WORDS[view]),
      ...bedTypes.flatMap((bed) => BED_WORDS[bed]),
      ...categories.flatMap((category) => CATEGORY_WORDS[category]),
      ...amenities.map((amenity) => amenity.toLowerCase()),
    ];

    return {
      criteria: {
        ...(checkIn ? { checkIn } : {}),
        ...(checkOut ? { checkOut } : {}),
        ...(adults !== undefined ? { adults } : {}),
        ...(children !== undefined ? { children } : {}),
      },
      filters: {
        ...(minPrice !== undefined ? { minPrice } : {}),
        ...(maxPrice !== undefined ? { maxPrice } : {}),
        ...(views.length ? { views } : {}),
        ...(bedTypes.length ? { bedTypes } : {}),
        ...(categories.length ? { categories } : {}),
        ...(amenities.length ? { amenities } : {}),
      },
      addOnIds: [],
      unresolved: findUnresolved(utterance, recognisedWords),
    };
  },
};
