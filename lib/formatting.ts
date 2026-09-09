import { format, parseISO } from 'date-fns';
import type { RoomCategory } from './domain/room-attributes';
import type { AddOn, Currency, PaymentMethod, RoomStatus, RoomType } from './domain/schemas';

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

export function formatFloor(floor: number): string {
  if (floor === 0) return 'Ground floor';
  const suffix = floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th';
  return `${floor}${suffix} floor`;
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
