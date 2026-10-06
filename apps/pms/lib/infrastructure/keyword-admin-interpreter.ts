import {
  adminPages,
  addOnDraftFields,
  emptyAddOnDraft,
  emptyRateDraft,
  emptyRoomTypeDraft,
  roomTypeDraftFields,
  type AdminDraft,
  type AddOnDraft,
  type AddOnDraftField,
  type RateDraft,
  type RateDraftField,
  type AdminPage,
  type RoomTypeDraft,
  type RoomTypeDraftField,
} from '../domain/admin-assistant';
import type { AdminCommand, AdminCommandInterpreter, AdminCommandVocabulary } from '../domain/ports';
import type { RoomStatus } from '../domain/schemas';

/**
 * The deterministic fallback for the admin assistant, same job as
 * `keyword-search-interpreter.ts` for the guest: no key configured, or the
 * OpenAI call failed, and the chat still answers. A small vocabulary of
 * verbs, and the target is whichever catalog name the request contains —
 * longest first, so "Deluxe Sea View" wins over "Sea View" when both are
 * in the catalog. Mid-conversation, with a draft open, a message is read as
 * the answer to the draft's next question. Every example the idle panel
 * shows must resolve here.
 */

const PAGE_WORDS: Record<AdminPage, string[]> = {
  dashboard: ['dashboard', 'overview', 'home'],
  'front-desk': ['front desk', 'frontdesk', 'desk'],
  housekeeping: ['housekeeping', 'cleaning', 'room status'],
  reservations: ['reservations', 'bookings', 'booking'],
  services: ['services', 'add-ons', 'add ons', 'addons', 'extras'],
  rates: ['room rates', 'rates', 'prices', 'pricing'],
  accounting: ['accounting', 'payments', 'finance'],
  'channel-manager': ['channel manager', 'channels', 'integrations'],
  rooms: ['room types', 'rooms'],
  'hotel-settings': ['hotel settings', 'settings', 'hotel'],
  orbit: ['360 orbit', 'orbit', 'spinner'],
  frames: ['frames', 'key angles'],
  markup: ['markup', 'zones'],
};

const STATUS_WORDS: Array<[RegExp, RoomStatus | 'auto']> = [
  [/\b(sold ?out|sell ?out|no availability|fully booked|off sale)\b/, 'sold_out'],
  [/\blast room\b/, 'last_room'],
  [/\blimited\b/, 'limited'],
  [/\b(available|open( up)?|on sale)\b/, 'available'],
  [/\b(auto|automatic|clear( the)? override|reset( the)? status)\b/, 'auto'],
];

const NAVIGATE = /^\s*(open|go to|show me|take me to|switch to)\b/;
const HIDE = /\b(hide|unpublish|take (it )?off the site|remove from the site)\b/;
const SHOW = /\b(unhide|show|publish|put (it )?(back )?on the site)\b/;
// Verbs only an add-on takes, and the on/off-sale phrasing both share — which
// the request's whole room-type name, if it has one, claims for the room.
const ADD_ON_VERB = /\b(enable|disable|turn on|turn off|activate|deactivate|start selling|stop selling)\b/;
const SALE_PHRASE = /\b(on sale|off sale)\b/;
const ENABLING = /\b(enable|turn on|activate|start selling|on sale)\b/;
const PRICE_VERB = /\b(rate|price|nightly|per night|a night|cost)\b/;
const NUMBER = /(\d+(?:[.,]\d+)?)/;
const CREATE = /\b(create|add|make|new|set up)\b/;
const ROOM_TYPE = /\broom ?types?\b|\bcategory\b|\btype of room\b/;
const ROOM = /\brooms?\b/;
const RATE = /\b(rate|rates|rate plan|pricing plan)\b/;
const ADD_ON = /\b(service|services|add-?on|add on|extra|extras|dish|menu item)\b/;
const ALSO_ROOM = /\b(and|with|plus)\b[^.]*\brooms?\b/;
const ROOM_NUMBER = /\b([a-z]?\d{2,4})\b/i;

const BED_WORDS: Array<[RegExp, RoomTypeDraft['bedType'] & string]> = [
  [/\bking\b/, 'king'],
  [/\btwin\b/, 'twin'],
  [/\bqueen\b/, 'queen'],
];
const VIEW_WORDS: Array<[RegExp, RoomTypeDraft['view'] & string]> = [
  [/\b(sea|ocean)\b/, 'sea'],
  [/\bgarden\b/, 'garden'],
  [/\bpool\b/, 'pool'],
  [/\b(city|town|street)\b/, 'city'],
];

function findTarget(text: string, names: string[]): string | null {
  const lower = text.toLowerCase();
  const hits = names.filter((name) => lower.includes(name.toLowerCase()));
  if (hits.length === 0) return null;
  return hits.sort((a, b) => b.length - a.length)[0]!;
}

// The verbs, values and filler this interpreter itself reads; what is left
// of a request after them is whatever the admin called the thing.
const NOISE =
  /\b(please|the|a|an|it|this|that|to|for|of|on|off|sale|night|nights|per|rate|rates|price|prices|type|types|now|again|back|from|site|override|status|set|change|make|update|mark|put|take|hide|unhide|show|publish|unpublish|enable|disable|turn|clear|reset|open|remove|stop|start|selling|activate|deactivate|available|limited|last|sold|out|auto|automatic|sell|fully|booked|availability|nightly|cost|and|is|as|be|create|add|new|up|room|number|no|in|under|called|named)\b/g;

/**
 * When no catalog name appears whole, the words that are not the request's
 * own vocabulary are still the admin's name for the target — "hide sea view"
 * names something, even if two room types answer to it. Passing them on lets
 * the service ask which, as it would for the OpenAI interpreter's `target`,
 * instead of this fallback asking "which room type?" as if nothing was said.
 */
function remainder(lower: string): string | null {
  const words = lower
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b\d+([.,]\d+)?\b/g, ' ')
    .replace(NOISE, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.length ? words.join(' ') : null;
}

function findPage(text: string): AdminPage | null {
  const lower = text.toLowerCase();
  let best: { page: AdminPage; length: number } | null = null;
  for (const page of adminPages) {
    for (const word of PAGE_WORDS[page]) {
      if (lower.includes(word) && (!best || word.length > best.length)) best = { page, length: word.length };
    }
  }
  return best?.page ?? null;
}

function empty(): AdminCommand {
  return {
    action: 'unknown',
    target: null,
    price: null,
    hidden: null,
    status: null,
    enabled: null,
    page: null,
    roomType: { ...emptyRoomTypeDraft },
    roomNumber: null,
    rate: { ...emptyRateDraft },
    addOn: { ...emptyAddOnDraft },
    alsoRoom: null,
    unresolved: [],
  };
}

function extractRateDraft(text: string): AdminCommand['rate'] {
  const price = text.match(/(?:at|for|price|rate)?\s*(\d+(?:[.,]\d+)?)\s*(?:a |per )?night/i);
  const named = text.match(/["“]([^"”]+)["”]/) ?? text.match(/\b(?:called|named)\s+(.+?)(?=\s+(?:for|at)\b|,|$)/i);
  return {
    roomTypeName: null,
    name: named?.[1]?.trim() ?? null,
    nightlyPrice: price ? Number(price[1]!.replace(',', '.')) : null,
    breakfastIncluded: /\b(with|including|includes) breakfast\b/i.test(text) ? true : /\bwithout breakfast\b/i.test(text) ? false : null,
    cancellationPolicy: /\b(non[- ]refundable|flexible cancellation|free cancellation)\b/i.test(text) ? text.match(/\b(non[- ]refundable|flexible cancellation|free cancellation)\b/i)?.[1] ?? null : null,
  };
}

function extractAddOnDraft(text: string): AdminCommand['addOn'] {
  const named = text.match(/["“]([^"”]+)["”]/) ?? text.match(/\b(?:called|named)\s+(.+?)(?=\s+(?:for|at)\b|,|$)/i);
  const price = text.match(/(?:at|for|price)\s*(\d+(?:[.,]\d+)?)/i);
  return {
    ...emptyAddOnDraft,
    name: named?.[1]?.trim() ?? null,
    description: null,
    category: /\b(dining|dish|food|menu)\b/i.test(text) ? 'dining' : /\b(service|transfer|spa|parking)\b/i.test(text) ? 'service' : null,
    price: price ? Number(price[1]!.replace(',', '.')) : null,
    pricingUnit: /\bper guest\b/i.test(text) ? 'per_guest' : /\bper night\b/i.test(text) ? 'per_night' : /\bper stay\b/i.test(text) ? 'per_stay' : null,
  };
}

function rateAnswer(field: RateDraftField, text: string): RateDraft[RateDraftField] {
  if (field === 'roomTypeName' || field === 'name' || field === 'cancellationPolicy') return text.trim() || null;
  if (field === 'nightlyPrice') return decimal(text);
  return /\b(yes|with|include)\b/i.test(text) ? true : /\b(no|without|exclude)\b/i.test(text) ? false : null;
}

function addOnAnswer(field: AddOnDraftField, text: string): AddOnDraft[AddOnDraftField] {
  if (field === 'name' || field === 'description') return text.trim() || null;
  if (field === 'price') return decimal(text);
  if (field === 'photos') return null;
  if (field === 'enabled') return /^(yes|on sale|publish|да|в продажу)$/i.test(text.trim()) ? true : /^(no|hidden|draft|нет|скрыт|черновик)$/i.test(text.trim()) ? false : null;
  if (field === 'category') return /\b(dining|dish|food|menu)\b/i.test(text) ? 'dining' : /\b(service|transfer|spa|parking)\b/i.test(text) ? 'service' : null;
  return /\bper guest\b/i.test(text) ? 'per_guest' : /\bper night\b/i.test(text) ? 'per_night' : /\bper stay\b/i.test(text) ? 'per_stay' : null;
}

function integer(text: string): number | null {
  const match = text.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function decimal(text: string): number | null {
  const match = text.match(NUMBER);
  return match ? Number(match[1]!.replace(',', '.')) : null;
}

/** Whatever room-type details a sentence gives away, whether or not it was asked for them. */
function extractRoomTypeFields(lower: string): Partial<RoomTypeDraft> {
  const found: Partial<RoomTypeDraft> = {};
  for (const [pattern, bed] of BED_WORDS) if (pattern.test(lower)) { found.bedType = bed; break; }
  for (const [pattern, view] of VIEW_WORDS) if (pattern.test(lower)) { found.view = view; break; }

  const capacity = lower.match(/\b(?:sleeps|for)\s+(\d+)\b/) ?? lower.match(/\b(\d+)\s+(?:guests|people|persons|adults)\b/);
  if (capacity) found.capacity = Number(capacity[1]);

  const area = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(?:m2|m²|sqm|sq\.? ?m|square met)/);
  if (area) found.areaM2 = Number(area[1]!.replace(',', '.'));

  if (/\bground floor\b/.test(lower)) found.floor = 0;
  else {
    const floor = lower.match(/\b(\d+)(?:st|nd|rd|th)?\s+floor\b/) ?? lower.match(/\bfloor\s+(\d+)\b/);
    if (floor) found.floor = Number(floor[1]);
  }

  // A quoted name is exact; "called X" runs to the next comma or the end.
  const named = lower.match(/["“]([^"”]+)["”]/) ?? lower.match(/\b(?:called|named)\s+([^,]+?)\s*(?:,|$)/);
  if (named) found.name = named[1]!.trim().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  return found;
}

/** The reply, read as the answer to one question. */
function answerFor(field: RoomTypeDraftField, text: string, lower: string): RoomTypeDraft[RoomTypeDraftField] {
  switch (field) {
    case 'name':
    case 'description':
      return text.trim() || null;
    case 'floor':
      return /\bground\b/.test(lower) ? 0 : integer(lower);
    case 'areaM2':
      return decimal(lower);
    case 'capacity':
      return integer(lower);
    case 'bedType':
      return extractRoomTypeFields(lower).bedType ?? null;
    case 'view':
      return extractRoomTypeFields(lower).view ?? null;
  }
}

function roomNumberIn(text: string): string | null {
  const match = text.match(ROOM_NUMBER);
  return match ? match[1]!.toUpperCase() : null;
}

export function interpretAdminKeywords(utterance: string, vocabulary: AdminCommandVocabulary, draft: AdminDraft | null = null): AdminCommand {
  const text = utterance.trim();
  const lower = text.toLowerCase();
  const command = empty();

  if (draft?.kind === 'create_room_type') {
    const asked = roomTypeDraftFields.find((field) => draft.fields[field] === null) ?? null;
    const volunteered = extractRoomTypeFields(lower);
    const roomType: RoomTypeDraft = { ...emptyRoomTypeDraft, ...volunteered };
    if (asked) {
      const answer = answerFor(asked, text, lower);
      // A name or a description is the whole reply — not the reply minus a
      // "king bed" it happened to mention.
      if (answer !== null) roomType[asked] = answer as never;
    }
    return { ...command, action: 'create_room_type', roomType };
  }

  if (draft?.kind === 'create_physical_room') {
    return { ...command, action: 'create_physical_room', roomNumber: roomNumberIn(text) };
  }

  if (draft?.kind === 'create_rate') {
    const field = ['roomTypeName', 'name', 'nightlyPrice', 'breakfastIncluded', 'cancellationPolicy'].find((key) => draft.fields[key as RateDraftField] === null) as RateDraftField | undefined;
    const rate = { ...emptyRateDraft, ...extractRateDraft(text) };
    if (field) rate[field] = rateAnswer(field, text) as never;
    return { ...command, action: 'create_rate', rate };
  }

  if (draft?.kind === 'create_add_on') {
    const field = addOnDraftFields.find((key) => draft.fields[key] === null);
    const addOn = { ...emptyAddOnDraft, ...extractAddOnDraft(text) };
    if (field) addOn[field] = addOnAnswer(field, text) as never;
    return { ...command, action: 'create_add_on', addOn };
  }

  if (NAVIGATE.test(lower)) {
    const page = findPage(lower);
    if (page) return { ...command, action: 'navigate', page };
  }

  const addOnName = findTarget(text, vocabulary.addOns);
  const roomTypeName = findTarget(text, vocabulary.roomTypes);
  const rest = remainder(lower);
  const addOn = addOnName ?? rest;
  const roomType = roomTypeName ?? rest;

  if (CREATE.test(lower) && ROOM_TYPE.test(lower)) {
    return {
      ...command,
      action: 'create_room_type',
      roomType: { ...emptyRoomTypeDraft, ...extractRoomTypeFields(lower) },
      alsoRoom: ALSO_ROOM.test(lower.replace(ROOM_TYPE, ' ')),
    };
  }

  if (CREATE.test(lower) && RATE.test(lower)) {
    return { ...command, action: 'create_rate', rate: { ...extractRateDraft(text), roomTypeName: roomTypeName ?? rest } };
  }

  if (CREATE.test(lower) && ADD_ON.test(lower)) {
    return { ...command, action: 'create_add_on', addOn: extractAddOnDraft(text) };
  }

  if (CREATE.test(lower) && ROOM.test(lower)) {
    return { ...command, action: 'create_physical_room', target: roomType, roomNumber: roomNumberIn(text) };
  }

  // "enable the airport transfer" is an add-on whatever else the words say;
  // "put X back on sale" is an add-on unless X is, whole, one of the room
  // types — a room is "available", but that is how an admin will say it.
  if (ADD_ON_VERB.test(lower) || (SALE_PHRASE.test(lower) && !roomTypeName)) {
    return { ...command, action: 'set_add_on_enabled', target: addOn, enabled: ENABLING.test(lower) };
  }

  const priceMatch = PRICE_VERB.test(lower) ? lower.match(NUMBER) : null;
  if (priceMatch) {
    return { ...command, action: 'set_rate_price', target: roomType, price: Number(priceMatch[1]!.replace(',', '.')) };
  }

  for (const [pattern, status] of STATUS_WORDS) {
    if (pattern.test(lower)) return { ...command, action: 'set_room_status', target: roomType, status };
  }

  if (HIDE.test(lower)) return { ...command, action: 'set_room_hidden', target: roomType, hidden: true };
  if (SHOW.test(lower)) return { ...command, action: 'set_room_hidden', target: roomType, hidden: false };

  const page = findPage(lower);
  if (page) return { ...command, action: 'navigate', page };

  return { ...command, unresolved: text ? [text] : [] };
}

export const keywordAdminInterpreter: AdminCommandInterpreter = {
  async interpret(input) {
    return interpretAdminKeywords(input.utterance, input.vocabulary, input.draft);
  },
};
