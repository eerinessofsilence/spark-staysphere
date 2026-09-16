import { format, parseISO } from 'date-fns';
import { de, enGB, es, fr, hr, it, pl, ru } from 'date-fns/locale';
import type { RoomCategory } from '../domain/room-attributes';
import type { Facade } from '../domain/room-units';
import type { AddOn, Booking, Currency, PaymentMethod, RoomStatus, RoomType } from '../domain/schemas';
import { DICTIONARIES } from './dictionaries';
import { INTL_TAGS, type Locale } from './locale';
import { pluralCount, type PluralForms } from './plural';

export const DATE_FNS_LOCALES = { en: enGB, ru, hr, de, fr, it, es, pl };

export function lMoney(amount: number, currency: Currency, locale: Locale): string {
  return new Intl.NumberFormat(INTL_TAGS[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Floor and tonight's price for a marker that sells a room, as one short line. */
export function lRoomLine(
  facts: { floor: number; nightlyPrice: number; currency: Currency } | null | undefined,
  locale: Locale,
): string | null {
  if (!facts) return null;
  return `${lFloor(facts.floor, locale)} · ${DICTIONARIES[locale]['rooms.from']} ${lMoney(facts.nightlyPrice, facts.currency, locale)}`;
}

export function lDate(iso: string, locale: Locale): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: DATE_FNS_LOCALES[locale] });
}

export function lDateShort(iso: string, locale: Locale): string {
  return format(parseISO(iso), 'EEE d MMM', { locale: DATE_FNS_LOCALES[locale] });
}

export function lDateRange(checkIn: string, checkOut: string, locale: Locale): string {
  return `${lDateShort(checkIn, locale)} → ${lDateShort(checkOut, locale)}`;
}

const NIGHT: Record<Locale, PluralForms> = {
  en: { one: 'night', other: 'nights' },
  ru: { one: 'ночь', few: 'ночи', many: 'ночей', other: 'ночей' },
  hr: { one: 'noć', few: 'noći', many: 'noći', other: 'noći' },
  de: { one: 'Nacht', other: 'Nächte' },
  fr: { one: 'nuit', other: 'nuits' },
  it: { one: 'notte', other: 'notti' },
  es: { one: 'noche', other: 'noches' },
  pl: { one: 'noc', few: 'noce', many: 'nocy', other: 'nocy' },
};

export function lNights(nights: number, locale: Locale): string {
  return pluralCount(locale, nights, NIGHT[locale]);
}

const ADULT: Record<Locale, PluralForms> = {
  en: { one: 'adult', other: 'adults' },
  ru: { one: 'взрослый', few: 'взрослых', many: 'взрослых', other: 'взрослых' },
  hr: { one: 'odrasla osoba', few: 'odrasle osobe', many: 'odraslih osoba', other: 'odraslih osoba' },
  de: { one: 'Erwachsener', other: 'Erwachsene' },
  fr: { one: 'adulte', other: 'adultes' },
  it: { one: 'adulto', other: 'adulti' },
  es: { one: 'adulto', other: 'adultos' },
  pl: { one: 'dorosły', few: 'dorosłych', many: 'dorosłych', other: 'dorosłych' },
};

const CHILD: Record<Locale, PluralForms> = {
  en: { one: 'child', other: 'children' },
  ru: { one: 'ребёнок', few: 'ребёнка', many: 'детей', other: 'детей' },
  hr: { one: 'dijete', few: 'djeteta', many: 'djece', other: 'djece' },
  de: { one: 'Kind', other: 'Kinder' },
  fr: { one: 'enfant', other: 'enfants' },
  it: { one: 'bambino', other: 'bambini' },
  es: { one: 'niño', other: 'niños' },
  pl: { one: 'dziecko', few: 'dzieci', many: 'dzieci', other: 'dzieci' },
};

export function lGuests(adults: number, children: number, locale: Locale): string {
  const parts = [pluralCount(locale, adults, ADULT[locale])];
  if (children > 0) parts.push(pluralCount(locale, children, CHILD[locale]));
  return parts.join(', ');
}

const ROOM_COUNT: Record<Locale, PluralForms> = {
  en: { one: 'room', other: 'rooms' },
  ru: { one: 'номер', few: 'номера', many: 'номеров', other: 'номеров' },
  hr: { one: 'soba', few: 'sobe', many: 'soba', other: 'soba' },
  de: { one: 'Zimmer', other: 'Zimmer' },
  fr: { one: 'chambre', other: 'chambres' },
  it: { one: 'camera', other: 'camere' },
  es: { one: 'habitación', other: 'habitaciones' },
  pl: { one: 'pokój', few: 'pokoje', many: 'pokoi', other: 'pokoi' },
};

export function lRoomCount(n: number, locale: Locale): string {
  return pluralCount(locale, n, ROOM_COUNT[locale]);
}

const SERVICE_COUNT: Record<Locale, PluralForms> = {
  en: { one: 'service', other: 'services' },
  ru: { one: 'услуга', few: 'услуги', many: 'услуг', other: 'услуг' },
  hr: { one: 'usluga', few: 'usluge', many: 'usluga', other: 'usluga' },
  de: { one: 'Leistung', other: 'Leistungen' },
  fr: { one: 'prestation', other: 'prestations' },
  it: { one: 'servizio', other: 'servizi' },
  es: { one: 'servicio', other: 'servicios' },
  pl: { one: 'usługa', few: 'usługi', many: 'usług', other: 'usług' },
};

export function lServiceCount(n: number, locale: Locale): string {
  return pluralCount(locale, n, SERVICE_COUNT[locale]);
}

export const VIEW_LABEL: Record<Locale, Record<RoomType['view'], string>> = {
  en: { sea: 'Sea view', garden: 'Garden view', pool: 'Pool view', city: 'City view' },
  ru: { sea: 'Вид на море', garden: 'Вид на сад', pool: 'Вид на бассейн', city: 'Вид на город' },
  hr: { sea: 'Pogled na more', garden: 'Pogled na vrt', pool: 'Pogled na bazen', city: 'Pogled na grad' },
  de: { sea: 'Meerblick', garden: 'Gartenblick', pool: 'Poolblick', city: 'Stadtblick' },
  fr: { sea: 'Vue sur la mer', garden: 'Vue sur le jardin', pool: 'Vue sur la piscine', city: 'Vue sur la ville' },
  it: { sea: 'Vista mare', garden: 'Vista giardino', pool: 'Vista piscina', city: 'Vista città' },
  es: { sea: 'Vista al mar', garden: 'Vista al jardín', pool: 'Vista a la piscina', city: 'Vista a la ciudad' },
  pl: { sea: 'Widok na morze', garden: 'Widok na ogród', pool: 'Widok na basen', city: 'Widok na miasto' },
};

export function lView(view: RoomType['view'], locale: Locale): string {
  return VIEW_LABEL[locale][view];
}

export const BED_LABEL: Record<Locale, Record<RoomType['bedType'], string>> = {
  en: { king: 'King bed', queen: 'Queen bed', twin: 'Twin beds' },
  ru: { king: 'Кровать king-size', queen: 'Кровать queen-size', twin: 'Две отдельные кровати' },
  hr: { king: 'Bračni krevet king', queen: 'Bračni krevet queen', twin: 'Odvojeni kreveti' },
  de: { king: 'Kingsize-Bett', queen: 'Queensize-Bett', twin: 'Zwei Einzelbetten' },
  fr: { king: 'Lit king size', queen: 'Lit queen size', twin: 'Lits jumeaux' },
  it: { king: 'Letto king size', queen: 'Letto queen size', twin: 'Letti singoli' },
  es: { king: 'Cama king size', queen: 'Cama queen size', twin: 'Camas separadas' },
  pl: { king: 'Łóżko king size', queen: 'Łóżko queen size', twin: 'Osobne łóżka' },
};

export function lBed(bed: RoomType['bedType'], locale: Locale): string {
  return BED_LABEL[locale][bed];
}

export const CATEGORY_LABEL: Record<Locale, Record<RoomCategory, string>> = {
  en: { room: 'Room', studio: 'Studio', suite: 'Suite', loft: 'Loft', residence: 'Residence', penthouse: 'Penthouse' },
  ru: { room: 'Номер', studio: 'Студия', suite: 'Люкс', loft: 'Лофт', residence: 'Резиденция', penthouse: 'Пентхаус' },
  hr: { room: 'Soba', studio: 'Studio', suite: 'Apartman', loft: 'Loft', residence: 'Rezidencija', penthouse: 'Penthouse' },
  de: { room: 'Zimmer', studio: 'Studio', suite: 'Suite', loft: 'Loft', residence: 'Residenz', penthouse: 'Penthouse' },
  fr: { room: 'Chambre', studio: 'Studio', suite: 'Suite', loft: 'Loft', residence: 'Résidence', penthouse: 'Penthouse' },
  it: { room: 'Camera', studio: 'Monolocale', suite: 'Suite', loft: 'Loft', residence: 'Residenza', penthouse: 'Attico' },
  es: { room: 'Habitación', studio: 'Estudio', suite: 'Suite', loft: 'Loft', residence: 'Residencia', penthouse: 'Ático' },
  pl: { room: 'Pokój', studio: 'Studio', suite: 'Apartament', loft: 'Loft', residence: 'Rezydencja', penthouse: 'Penthouse' },
};

export function lCategory(category: RoomCategory, locale: Locale): string {
  return CATEGORY_LABEL[locale][category];
}

/** Fits a 44px floor-plan cell under the room number; the full word is in the cell's own label. */
export const CATEGORY_SHORT: Record<Locale, Record<RoomCategory, string>> = {
  en: { room: 'Room', studio: 'Studio', suite: 'Suite', loft: 'Loft', residence: 'Res.', penthouse: 'Penth.' },
  ru: { room: 'Ном.', studio: 'Студ.', suite: 'Люкс', loft: 'Лофт', residence: 'Рез.', penthouse: 'Пентх.' },
  hr: { room: 'Soba', studio: 'Stud.', suite: 'Lux', loft: 'Loft', residence: 'Rez.', penthouse: 'Penth.' },
  de: { room: 'Zi.', studio: 'Stud.', suite: 'Suite', loft: 'Loft', residence: 'Res.', penthouse: 'Pent.' },
  fr: { room: 'Ch.', studio: 'Stud.', suite: 'Suite', loft: 'Loft', residence: 'Rés.', penthouse: 'Pent.' },
  it: { room: 'Cam.', studio: 'Stud.', suite: 'Suite', loft: 'Loft', residence: 'Res.', penthouse: 'Attico' },
  es: { room: 'Hab.', studio: 'Estu.', suite: 'Suite', loft: 'Loft', residence: 'Res.', penthouse: 'Ático' },
  pl: { room: 'Pok.', studio: 'Stud.', suite: 'Apart.', loft: 'Loft', residence: 'Rez.', penthouse: 'Penth.' },
};

export function lCategoryShort(category: RoomCategory, locale: Locale): string {
  return CATEGORY_SHORT[locale][category];
}

export const FACADE_LABEL: Record<Locale, Record<Facade, string>> = {
  en: { sea: 'Sea side', town: 'Town side' },
  ru: { sea: 'Со стороны моря', town: 'Со стороны города' },
  hr: { sea: 'Strana s pogledom na more', town: 'Gradska strana' },
  de: { sea: 'Meerseite', town: 'Stadtseite' },
  fr: { sea: 'Côté mer', town: 'Côté ville' },
  it: { sea: 'Lato mare', town: 'Lato città' },
  es: { sea: 'Lado mar', town: 'Lado ciudad' },
  pl: { sea: 'Strona morska', town: 'Strona miejska' },
};

export function lFacade(facade: Facade, locale: Locale): string {
  return FACADE_LABEL[locale][facade];
}

export const PAYMENT_METHOD_LABEL: Record<Locale, Record<PaymentMethod, string>> = {
  en: { card: 'Card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Bank transfer', pay_at_hotel: 'Pay at the hotel' },
  ru: { card: 'Карта', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Банковский перевод', pay_at_hotel: 'Оплата в отеле' },
  hr: { card: 'Kartica', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Bankovni prijenos', pay_at_hotel: 'Plaćanje u hotelu' },
  de: { card: 'Karte', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Banküberweisung', pay_at_hotel: 'Zahlung im Hotel' },
  fr: { card: 'Carte', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Virement bancaire', pay_at_hotel: "Paiement à l'hôtel" },
  it: { card: 'Carta', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Bonifico bancario', pay_at_hotel: 'Pagamento in hotel' },
  es: { card: 'Tarjeta', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Transferencia bancaria', pay_at_hotel: 'Pago en el hotel' },
  pl: { card: 'Karta', apple_pay: 'Apple Pay', google_pay: 'Google Pay', bank_transfer: 'Przelew bankowy', pay_at_hotel: 'Płatność w hotelu' },
};

export function lPaymentMethod(method: PaymentMethod, locale: Locale): string {
  return PAYMENT_METHOD_LABEL[locale][method];
}

export const ADDON_CATEGORY_LABEL: Record<Locale, Record<AddOn['category'], string>> = {
  en: { service: 'Services', dining: 'Food and drink' },
  ru: { service: 'Услуги', dining: 'Еда и напитки' },
  hr: { service: 'Usluge', dining: 'Hrana i piće' },
  de: { service: 'Services', dining: 'Essen und Trinken' },
  fr: { service: 'Services', dining: 'Boissons et repas' },
  it: { service: 'Servizi', dining: 'Cibo e bevande' },
  es: { service: 'Servicios', dining: 'Comida y bebida' },
  pl: { service: 'Usługi', dining: 'Jedzenie i napoje' },
};

export function lAddOnCategory(category: AddOn['category'], locale: Locale): string {
  return ADDON_CATEGORY_LABEL[locale][category];
}

export const PRICING_UNIT_LABEL: Record<Locale, Record<AddOn['pricingUnit'], string>> = {
  en: { per_stay: 'per stay', per_night: 'per night', per_guest: 'per guest' },
  ru: { per_stay: 'за проживание', per_night: 'за ночь', per_guest: 'за гостя' },
  hr: { per_stay: 'po boravku', per_night: 'po noćenju', per_guest: 'po gostu' },
  de: { per_stay: 'pro Aufenthalt', per_night: 'pro Nacht', per_guest: 'pro Gast' },
  fr: { per_stay: 'par séjour', per_night: 'par nuit', per_guest: 'par personne' },
  it: { per_stay: 'a soggiorno', per_night: 'a notte', per_guest: 'a ospite' },
  es: { per_stay: 'por estancia', per_night: 'por noche', per_guest: 'por huésped' },
  pl: { per_stay: 'za pobyt', per_night: 'za noc', per_guest: 'za gościa' },
};

export function lPricingUnit(unit: AddOn['pricingUnit'], locale: Locale): string {
  return PRICING_UNIT_LABEL[locale][unit];
}

export const STATUS_LABEL: Record<Locale, Record<RoomStatus, string>> = {
  en: { available: 'Available', limited: 'Limited', last_room: 'Last room', sold_out: 'Fully booked' },
  ru: { available: 'Доступно', limited: 'Осталось немного', last_room: 'Последний номер', sold_out: 'Мест нет' },
  hr: { available: 'Dostupno', limited: 'Ograničeno', last_room: 'Zadnja soba', sold_out: 'Popunjeno' },
  de: { available: 'Verfügbar', limited: 'Begrenzt', last_room: 'Letztes Zimmer', sold_out: 'Ausgebucht' },
  fr: { available: 'Disponible', limited: 'Limité', last_room: 'Dernière chambre', sold_out: 'Complet' },
  it: { available: 'Disponibile', limited: 'Limitato', last_room: 'Ultima camera', sold_out: 'Al completo' },
  es: { available: 'Disponible', limited: 'Limitado', last_room: 'Última habitación', sold_out: 'Completo' },
  pl: { available: 'Dostępny', limited: 'Ograniczona liczba', last_room: 'Ostatni pokój', sold_out: 'Brak miejsc' },
};

const ONLY_LEFT: Record<Locale, (n: number) => string> = {
  en: (n) => `Only ${n} left`,
  ru: (n) => `Осталось всего ${n}`,
  hr: (n) => `Preostalo još ${n}`,
  de: (n) => `Nur noch ${n} übrig`,
  fr: (n) => `Plus que ${n}`,
  it: (n) => `Solo ${n} rimaste`,
  es: (n) => `Solo quedan ${n}`,
  pl: (n) => `Zostało tylko ${n}`,
};

/** Mirrors `statusText` in `lib/formatting.ts` — always spells out the number, colour is never the only signal. */
export function lStatusText(status: RoomStatus, remaining: number, locale: Locale): string {
  if (status === 'limited') return ONLY_LEFT[locale](remaining);
  return STATUS_LABEL[locale][status];
}

export const BOOKING_STATUS_LABEL: Record<Locale, Record<Booking['status'], string>> = {
  en: { draft: 'Not finished', held: 'Held', confirmed: 'Confirmed', cancelled: 'Cancelled' },
  ru: { draft: 'Не завершено', held: 'Удержано', confirmed: 'Подтверждено', cancelled: 'Отменено' },
  hr: { draft: 'Nezavršeno', held: 'Zadržano', confirmed: 'Potvrđeno', cancelled: 'Otkazano' },
  de: { draft: 'Nicht abgeschlossen', held: 'Reserviert', confirmed: 'Bestätigt', cancelled: 'Storniert' },
  fr: { draft: 'Non terminé', held: 'Retenu', confirmed: 'Confirmé', cancelled: 'Annulé' },
  it: { draft: 'Non completato', held: 'In attesa', confirmed: 'Confermato', cancelled: 'Annullato' },
  es: { draft: 'No finalizado', held: 'Retenido', confirmed: 'Confirmado', cancelled: 'Cancelado' },
  pl: { draft: 'Niedokończone', held: 'Wstrzymane', confirmed: 'Potwierdzone', cancelled: 'Anulowane' },
};

export function lBookingStatus(status: Booking['status'], locale: Locale): string {
  return BOOKING_STATUS_LABEL[locale][status];
}

const FLOOR_ORDINAL: Record<Locale, (floor: number) => string> = {
  en: (f) => {
    const suffix = f === 1 ? 'st' : f === 2 ? 'nd' : f === 3 ? 'rd' : 'th';
    return `${f}${suffix} floor`;
  },
  ru: (f) => `${f}-й этаж`,
  hr: (f) => `${f}. kat`,
  de: (f) => `${f}. Etage`,
  fr: (f) => `${f}${f === 1 ? 'er' : 'e'} étage`,
  it: (f) => `${f}° piano`,
  es: (f) => `Planta ${f}`,
  pl: (f) => `${f}. piętro`,
};

const GROUND_FLOOR: Record<Locale, string> = {
  en: 'Ground floor',
  ru: 'Первый этаж',
  hr: 'Prizemlje',
  de: 'Erdgeschoss',
  fr: 'Rez-de-chaussée',
  it: 'Piano terra',
  es: 'Planta baja',
  pl: 'Parter',
};

export function lFloor(floor: number, locale: Locale): string {
  if (floor === 0) return GROUND_FLOOR[locale];
  return FLOOR_ORDINAL[locale](floor);
}

const ROOM_NUMBER: Record<Locale, (n: string) => string> = {
  en: (n) => `Room ${n}`,
  ru: (n) => `Номер ${n}`,
  hr: (n) => `Soba ${n}`,
  de: (n) => `Zimmer ${n}`,
  fr: (n) => `Chambre ${n}`,
  it: (n) => `Camera ${n}`,
  es: (n) => `Habitación ${n}`,
  pl: (n) => `Pokój ${n}`,
};

export function lRoomNumber(number: string, locale: Locale): string {
  return ROOM_NUMBER[locale](number);
}
