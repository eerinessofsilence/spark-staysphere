import { format, parseISO } from 'date-fns';
import type { RoomCategory } from './domain/room-attributes';
import type { AddOn, Currency, RoomStatus, RoomType } from './domain/schemas';

/** Fixed locale on purpose: server and client must format identically or React rehydrates wrong. */
const MONEY_LOCALE = 'en-GB';

export function formatMoney(amount: number, currency: Currency): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(MONEY_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
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
  sold_out: 'Sold out',
};

/** Status text always spells out the number so the badge never relies on colour alone. */
export function statusText(status: RoomStatus, remaining: number): string {
  switch (status) {
    case 'sold_out':
      return 'Sold out';
    case 'last_room':
      return 'Last room';
    case 'limited':
      return `Only ${remaining} left`;
    case 'available':
      return 'Available';
  }
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
