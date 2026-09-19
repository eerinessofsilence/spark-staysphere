import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
// Type-only: `RoomFilters` is an application-layer shape, reused here rather
// than restated so the assistant's summary sentence and the catalog page
// describe the same filter object with one vocabulary.
import type { RoomFilters } from './application/catalog-service';
import type { AdminApplyResult, AdminAskResult } from './application/admin-assistant-service';
import type { AdminDraft, AdminPage, AdminProposal, RoomTypeDraftField } from './domain/admin-assistant';
import type { RoomCategory } from './domain/room-attributes';
import type { Facade } from './domain/room-units';
import type { AddOn, Booking, Currency, PaymentMethod, RoomStatus, RoomType, StayCriteria } from './domain/schemas';
import type { AdminLocale } from './i18n/admin/locale';
import { translateAdmin } from './i18n/admin/translate';
import type { AdminTranslationKey } from './i18n/admin/dictionaries';
import { lBed, lFloor, lMoney, lView, STATUS_LABEL } from './i18n/format';

type AdminAskIncompleteAction = Extract<AdminAskResult, { outcome: 'incomplete' }>['action'];

/** Fixed locale on purpose: server and client must format identically or React rehydrates wrong. */
const MONEY_LOCALE = 'en-GB';

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy');
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'EEE d MMM');
}

export function formatDateRange(checkIn: string, checkOut: string): string {
  return `${formatDateShort(checkIn)} → ${formatDateShort(checkOut)}`;
}

/**
 * "2 hours ago" — client-only by convention (the caller renders it after
 * mount, e.g. inside a popover that isn't in the server-rendered HTML at
 * all): "now" moves between the server render and hydration, so text
 * computed from it during SSR would just be stale by the network's own delay.
 */
export function formatRelativeTime(iso: string): string {
  return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
}

export function formatNights(nights: number): string {
  return nights === 1 ? '1 night' : `${nights} nights`;
}

export function formatGuests(adults: number, children: number): string {
  const parts = [adults === 1 ? '1 adult' : `${adults} adults`];
  if (children > 0) parts.push(children === 1 ? '1 child' : `${children} children`);
  return parts.join(', ');
}

export const viewLabels: Record<RoomType['view'], string> = {
  sea: 'Sea view',
  garden: 'Garden view',
  pool: 'Pool view',
  city: 'City view',
};

export const bedLabels: Record<RoomType['bedType'], string> = {
  king: 'King bed',
  queen: 'Queen bed',
  twin: 'Twin beds',
};

/** How a payment method is named wherever a booking is read back. */
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  card: 'Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  bank_transfer: 'Bank transfer',
  pay_at_hotel: 'Pay at the hotel',
};

export const addOnCategoryLabels: Record<AddOn['category'], string> = {
  service: 'Services',
  dining: 'Food and drink',
};

export const categoryLabels: Record<RoomCategory, string> = {
  room: 'Room',
  studio: 'Studio',
  suite: 'Suite',
  loft: 'Loft',
  residence: 'Residence',
  penthouse: 'Penthouse',
};

export const statusLabels: Record<RoomStatus, string> = {
  available: 'Available',
  limited: 'Limited',
  last_room: 'Last room',
  sold_out: 'Fully booked',
};

/** Status text always spells out the number so the badge never relies on colour alone. */
export function statusText(status: RoomStatus, remaining: number): string {
  switch (status) {
    case 'sold_out':
      // A room type with nothing left on these dates is "fully booked" — the
      // word a hotel uses. "Sold out" is a concert.
      return 'Fully booked';
    case 'last_room':
      return 'Last room';
    case 'limited':
      return `Only ${remaining} left`;
    case 'available':
      return 'Available';
  }
}

/** The one line a marker gets to say about the room it sells — floor and tonight's rate. */
export function formatRoomLine(
  facts: { floor: number; nightlyPrice: number; currency: Currency } | null | undefined,
): string | null {
  if (!facts) return null;
  return `${formatFloor(facts.floor)} · from ${formatMoney(facts.nightlyPrice, facts.currency)}`;
}

export const facadeLabels: Record<Facade, string> = {
  sea: 'Sea side',
  town: 'Town side',
};

export function formatRoomNumber(number: string): string {
  return `Room ${number}`;
}

export const bookingStatusLabels: Record<Booking['status'], string> = {
  draft: 'Not finished',
  held: 'Held',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

export function formatFloor(floor: number): string {
  if (floor === 0) return 'Ground floor';
  const suffix = floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th';
  return `${floor}${suffix} floor`;
}

function roundedMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** The filter chips as a sentence fragment — "sea view, balcony, under €400" — never a fact the model wrote itself. */
function describeAssistantFilters(filters: RoomFilters, currency: Currency): string[] {
  const parts: string[] = [
    ...filters.views.map((view) => viewLabels[view].toLowerCase()),
    ...filters.bedTypes.map((bed) => bedLabels[bed].toLowerCase()),
    ...filters.categories.map((category) => categoryLabels[category].toLowerCase()),
    ...filters.amenities.map((amenity) => amenity.toLowerCase()),
  ];
  if (filters.minPrice !== null) parts.push(`over ${roundedMoney(filters.minPrice, currency)}`);
  if (filters.maxPrice !== null) parts.push(`under ${roundedMoney(filters.maxPrice, currency)}`);
  return parts;
}

/**
 * The one deterministic result line the assistant panel is allowed to show —
 * composed here from the app's own numbers, never written by the model.
 * `DESIGN_SYSTEM.md › Rules 2`: counts read as a sentence, not a stat tile.
 * Two lines: the answer (how many, matching what), then the stay it was
 * priced for — so the number a guest is scanning for is not buried mid-sentence.
 */
export function formatAssistantSummary(input: {
  matchedRooms: number;
  totalRooms: number;
  filters: RoomFilters;
  criteria: StayCriteria;
  currency: Currency;
  fromNightly: number | null;
}): { lead: string; detail: string } {
  const descriptors = describeAssistantFilters(input.filters, input.currency);
  const lead = descriptors.length
    ? `${input.matchedRooms} of ${input.totalRooms} room types match ${descriptors.join(', ')}`
    : `${input.matchedRooms} of ${input.totalRooms} room types are available`;
  const dates = `${formatDateShort(input.criteria.checkIn)} – ${formatDateShort(input.criteria.checkOut)}`;
  const detail =
    input.fromNightly !== null ? `${dates} · from ${formatMoney(input.fromNightly, input.currency)} a night` : dates;
  return { lead, detail };
}

/**
 * The admin assistant's sentences are composed in the team member's language
 * (`lib/i18n/admin`), unlike the guest-facing formatters above, which are
 * fixed English: the panel is a client component that knows its locale
 * (`useAdminLocale()`) and passes it in. Room status words come from the same
 * `STATUS_LABEL` the rest of the back office uses.
 */
function overrideLabel(status: RoomStatus | null, locale: AdminLocale): string {
  return status ? STATUS_LABEL[locale][status] : translateAdmin(locale, 'assistant.status.auto');
}

/** "Open …" names the screen as the sidebar does; the spinner's sub-screens keep the label the proposal carries. */
const ADMIN_PAGE_NAV_KEY: Partial<Record<AdminPage, AdminTranslationKey>> = {
  dashboard: 'nav.dashboard',
  'front-desk': 'nav.frontDesk',
  reservations: 'nav.reservations',
  services: 'nav.services',
  rates: 'nav.roomRates',
  accounting: 'nav.accounting',
  'channel-manager': 'nav.channelManager',
  rooms: 'nav.rooms',
  'hotel-settings': 'nav.hotelSettings',
  orbit: 'nav.orbit',
};

function navigateLabel(proposal: Extract<AdminProposal, { kind: 'navigate' }>, locale: AdminLocale): string {
  const key = ADMIN_PAGE_NAV_KEY[proposal.page];
  return key ? translateAdmin(locale, key) : proposal.label;
}

/**
 * What the admin assistant proposes, in the app's own words — same rule as
 * `formatAssistantSummary`: the sentence the admin confirms is composed here
 * from the proposal's numbers and names, never taken from the model.
 */
export function formatAdminProposal(proposal: AdminProposal, locale: AdminLocale): { lead: string; detail: string | null } {
  const t = (key: AdminTranslationKey, vars?: Record<string, string | number>) => translateAdmin(locale, key, vars);
  switch (proposal.kind) {
    case 'set_rate_price':
      return {
        lead: t('assistant.proposal.setRate.lead', { rate: proposal.rateName, roomType: proposal.roomTypeName }),
        detail: t('assistant.proposal.setRate.detail', {
          from: lMoney(proposal.from, proposal.currency, locale),
          to: lMoney(proposal.to, proposal.currency, locale),
        }),
      };
    case 'set_room_hidden':
      return proposal.hidden
        ? { lead: t('assistant.proposal.hide.lead', { roomType: proposal.roomTypeName }), detail: t('assistant.proposal.hide.detail') }
        : { lead: t('assistant.proposal.show.lead', { roomType: proposal.roomTypeName }), detail: t('assistant.proposal.show.detail') };
    case 'set_room_status':
      return {
        lead: t('assistant.proposal.status.lead', { roomType: proposal.roomTypeName, status: overrideLabel(proposal.status, locale) }),
        detail: t('assistant.proposal.status.detail', { status: overrideLabel(proposal.current, locale) }),
      };
    case 'set_add_on_enabled':
      return {
        lead: proposal.enabled
          ? t('assistant.proposal.addOnOn.lead', { addOn: proposal.addOnName })
          : t('assistant.proposal.addOnOff.lead', { addOn: proposal.addOnName }),
        detail: null,
      };
    case 'create_room_type': {
      const { input } = proposal;
      return {
        lead: t('assistant.proposal.createType.lead', { name: input.name }),
        detail: t('assistant.proposal.createType.detail', {
          floor: lFloor(input.floor, locale),
          area: input.areaM2,
          capacity: input.capacity,
          bed: lBed(input.bedType, locale),
          view: lView(input.view, locale),
        }),
      };
    }
    case 'create_physical_room':
      return { lead: t('assistant.proposal.createRoom.lead', { number: proposal.number, roomType: proposal.roomTypeName }), detail: null };
    case 'navigate':
      return { lead: t('assistant.proposal.navigate.lead', { label: navigateLabel(proposal, locale) }), detail: null };
  }
}

const ROOM_TYPE_QUESTION: Record<RoomTypeDraftField, AdminTranslationKey> = {
  name: 'assistant.question.name',
  description: 'assistant.question.description',
  floor: 'assistant.question.floor',
  areaM2: 'assistant.question.areaM2',
  capacity: 'assistant.question.capacity',
  bedType: 'assistant.question.bedType',
  view: 'assistant.question.view',
};

/** The next thing the assistant needs to know, for the draft it is holding. */
export function formatAdminQuestion(field: RoomTypeDraftField | 'number', draft: AdminDraft, locale: AdminLocale): string {
  if (field === 'number') {
    return draft.kind === 'create_physical_room' && draft.suggestedNumber
      ? translateAdmin(locale, 'assistant.question.numberSuggested', { roomType: draft.roomTypeName, suggested: draft.suggestedNumber })
      : translateAdmin(locale, 'assistant.question.number');
  }
  const question = translateAdmin(locale, ROOM_TYPE_QUESTION[field]);
  const known = draft.kind === 'create_room_type' && field !== 'name' ? draft.fields.name : null;
  return known ? translateAdmin(locale, 'assistant.question.known', { name: known, question }) : question;
}

const INCOMPLETE_REPLY: Record<AdminAskIncompleteAction, AdminTranslationKey> = {
  set_rate_price: 'assistant.incomplete.setRate',
  set_room_hidden: 'assistant.incomplete.setHidden',
  set_room_status: 'assistant.incomplete.setStatus',
  set_add_on_enabled: 'assistant.incomplete.setAddOn',
  create_physical_room: 'assistant.incomplete.createRoom',
};

/** The reply for everything that is not a proposal. */
export function formatAdminAssistantReply(result: AdminAskResult, locale: AdminLocale): string {
  switch (result.outcome) {
    case 'proposal':
      return translateAdmin(locale, 'assistant.reply.proposal');
    case 'question':
      return formatAdminQuestion(result.field, result.draft, locale);
    case 'cancelled':
      return translateAdmin(locale, 'assistant.reply.cancelled');
    case 'ambiguous':
      return translateAdmin(locale, 'assistant.reply.ambiguous', {
        target: result.target,
        candidates: result.candidates.join(` ${translateAdmin(locale, 'assistant.reply.or')} `),
      });
    case 'not_found':
      return translateAdmin(locale, 'assistant.reply.notFound', { target: result.target });
    case 'incomplete':
      return translateAdmin(locale, INCOMPLETE_REPLY[result.action]);
    case 'no_rate':
      return translateAdmin(locale, 'assistant.reply.noRate', {
        roomType: result.roomTypeName,
        screen: translateAdmin(locale, 'nav.roomRates'),
      });
    case 'unknown':
      return translateAdmin(locale, 'assistant.reply.unknown');
  }
}

export function formatAdminApplyOutcome(result: AdminApplyResult, proposal: AdminProposal, locale: AdminLocale): string {
  const t = (key: AdminTranslationKey, vars?: Record<string, string | number>) => translateAdmin(locale, key, vars);
  if (result.ok) {
    switch (proposal.kind) {
      case 'set_rate_price':
        return t('assistant.applied.setRate', {
          rate: proposal.rateName,
          roomType: proposal.roomTypeName,
          price: lMoney(proposal.to, proposal.currency, locale),
        });
      case 'set_room_hidden':
        return proposal.hidden
          ? t('assistant.applied.hidden', { roomType: proposal.roomTypeName })
          : t('assistant.applied.shown', { roomType: proposal.roomTypeName });
      case 'set_room_status':
        return t('assistant.applied.status', { roomType: proposal.roomTypeName, status: overrideLabel(proposal.status, locale) });
      case 'set_add_on_enabled':
        return proposal.enabled
          ? t('assistant.applied.addOnOn', { addOn: proposal.addOnName })
          : t('assistant.applied.addOnOff', { addOn: proposal.addOnName });
      case 'create_room_type':
        return t('assistant.applied.createType', { name: proposal.input.name });
      case 'create_physical_room':
        return t('assistant.applied.createRoom', { number: proposal.number, roomType: proposal.roomTypeName });
      case 'navigate':
        return t('assistant.applied.navigate', { label: navigateLabel(proposal, locale) });
    }
  }
  switch (result.reason) {
    case 'conflict':
      return t('assistant.failed.conflict');
    case 'not_found':
      return t('assistant.failed.notFound');
    case 'validation':
    case 'rule':
    case 'forbidden':
      // The CMS's own validation, rule, and permission messages, as the service returns them.
      return result.message;
  }
}

export function formatPricingUnit(unit: AddOn['pricingUnit']): string {
  switch (unit) {
    case 'per_stay':
      return 'per stay';
    case 'per_night':
      return 'per night';
    case 'per_guest':
      return 'per guest';
  }
}
