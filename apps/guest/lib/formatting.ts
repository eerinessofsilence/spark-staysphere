import { format, parseISO } from 'date-fns';
import type { RoomFilters } from './application/guest-contracts';
import type { RoomCategory } from './domain/room-attributes';
import type { Currency, RoomType, StayCriteria } from './domain/schemas';

const MONEY_LOCALE = 'en-GB';

const viewLabels: Record<RoomType['view'], string> = {
  sea: 'Sea view',
  garden: 'Garden view',
  pool: 'Pool view',
  city: 'City view',
};

const bedLabels: Record<RoomType['bedType'], string> = {
  king: 'King bed',
  queen: 'Queen bed',
  twin: 'Twin beds',
};

const categoryLabels: Record<RoomCategory, string> = {
  room: 'Room',
  studio: 'Studio',
  suite: 'Suite',
  loft: 'Loft',
  residence: 'Residence',
  penthouse: 'Penthouse',
};

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'EEE d MMM');
}

export function formatDateRange(checkIn: string, checkOut: string): string {
  return `${formatDateShort(checkIn)} → ${formatDateShort(checkOut)}`;
}

function roundedMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAssistantSummary(input: {
  matchedRooms: number;
  totalRooms: number;
  filters: RoomFilters;
  criteria: StayCriteria;
  currency: Currency;
  fromNightly: number | null;
}): { lead: string; detail: string } {
  const descriptors = [
    ...input.filters.views.map((view) => viewLabels[view].toLowerCase()),
    ...input.filters.bedTypes.map((bed) => bedLabels[bed].toLowerCase()),
    ...input.filters.categories.map((category) => categoryLabels[category].toLowerCase()),
    ...input.filters.amenities.map((amenity) => amenity.toLowerCase()),
  ];
  if (input.filters.minPrice !== null) descriptors.push(`over ${roundedMoney(input.filters.minPrice, input.currency)}`);
  if (input.filters.maxPrice !== null) descriptors.push(`under ${roundedMoney(input.filters.maxPrice, input.currency)}`);

  const lead = descriptors.length
    ? `${input.matchedRooms} of ${input.totalRooms} room types match ${descriptors.join(', ')}`
    : `${input.matchedRooms} of ${input.totalRooms} room types are available`;
  const dates = formatDateRange(input.criteria.checkIn, input.criteria.checkOut);
  const detail = input.fromNightly !== null
    ? `${dates} · from ${formatMoney(input.fromNightly, input.currency)} a night`
    : dates;
  return { lead, detail };
}
