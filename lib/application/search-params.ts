import { addDays, format, isValid, parseISO } from 'date-fns';
import { roomCategories, type RoomCategory } from '../domain/room-attributes';
import type { RoomType, StayCriteria } from '../domain/schemas';
import { defaultRoomFilters, type RoomFilters, type SortOrder } from './catalog-service';

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export const searchParamKeys = {
  checkIn: 'checkIn',
  checkOut: 'checkOut',
  adults: 'adults',
  children: 'children',
  view: 'view',
  bed: 'bed',
  category: 'category',
  amenity: 'amenity',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  minArea: 'minArea',
  minFloor: 'minFloor',
  hideSoldOut: 'hideSoldOut',
  sort: 'sort',
  addOn: 'addOn',
} as const;

const views: RoomType['view'][] = ['sea', 'garden', 'pool', 'city'];
const bedTypes: RoomType['bedType'][] = ['king', 'queen', 'twin'];
const sortOrders: SortOrder[] = ['recommended', 'price_asc', 'price_desc', 'area_desc'];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.flatMap((entry) => entry.split(',')).map((entry) => entry.trim()).filter(Boolean);
}

function toInt(value: string | undefined, fallback: number | null): number | null {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
}

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** A demo stay three weeks out, so the calendar always opens on a bookable range. */
export function defaultCriteria(today: Date = new Date()): StayCriteria {
  const checkIn = addDays(today, 21);
  return {
    checkIn: toIsoDate(checkIn),
    checkOut: toIsoDate(addDays(checkIn, 3)),
    adults: 2,
    children: 0,
  };
}

/** Never throws: an unparseable URL degrades to the default stay rather than a 500. */
export function parseCriteria(params: SearchParamsInput, today: Date = new Date()): StayCriteria {
  const fallback = defaultCriteria(today);
  const rawCheckIn = first(params[searchParamKeys.checkIn]);
  const rawCheckOut = first(params[searchParamKeys.checkOut]);

  const checkIn = isIsoDate(rawCheckIn) ? rawCheckIn : fallback.checkIn;
  const parsedCheckOut = isIsoDate(rawCheckOut) ? rawCheckOut : fallback.checkOut;
  const checkOut =
    parsedCheckOut > checkIn ? parsedCheckOut : toIsoDate(addDays(parseISO(checkIn), 1));

  const adults = Math.min(8, Math.max(1, toInt(first(params[searchParamKeys.adults]), 2) ?? 2));
  const children = Math.min(6, Math.max(0, toInt(first(params[searchParamKeys.children]), 0) ?? 0));

  return { checkIn, checkOut, adults, children };
}

export function parseFilters(params: SearchParamsInput): RoomFilters {
  const sort = first(params[searchParamKeys.sort]);
  return {
    minPrice: toInt(first(params[searchParamKeys.minPrice]), null),
    maxPrice: toInt(first(params[searchParamKeys.maxPrice]), null),
    views: many(params[searchParamKeys.view]).filter((v): v is RoomType['view'] =>
      views.includes(v as RoomType['view']),
    ),
    bedTypes: many(params[searchParamKeys.bed]).filter((v): v is RoomType['bedType'] =>
      bedTypes.includes(v as RoomType['bedType']),
    ),
    categories: many(params[searchParamKeys.category]).filter((v): v is RoomCategory =>
      roomCategories.includes(v as RoomCategory),
    ),
    amenities: many(params[searchParamKeys.amenity]),
    minArea: toInt(first(params[searchParamKeys.minArea]), null),
    minFloor: toInt(first(params[searchParamKeys.minFloor]), null),
    includeSoldOut: first(params[searchParamKeys.hideSoldOut]) !== '1',
    sort: sortOrders.includes(sort as SortOrder) ? (sort as SortOrder) : 'recommended',
  };
}

export function parseAddOnIds(params: SearchParamsInput): string[] {
  return many(params[searchParamKeys.addOn]);
}

export function filtersAreDefault(filters: RoomFilters): boolean {
  return (
    filters.minPrice === null &&
    filters.maxPrice === null &&
    filters.views.length === 0 &&
    filters.bedTypes.length === 0 &&
    filters.categories.length === 0 &&
    filters.amenities.length === 0 &&
    filters.minArea === null &&
    filters.minFloor === null &&
    filters.includeSoldOut === defaultRoomFilters.includeSoldOut
  );
}

export function activeFilterCount(filters: RoomFilters): number {
  return (
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    filters.views.length +
    filters.bedTypes.length +
    filters.categories.length +
    filters.amenities.length +
    (filters.minArea !== null ? 1 : 0) +
    (filters.minFloor !== null ? 1 : 0) +
    (filters.includeSoldOut ? 0 : 1)
  );
}

interface QueryInput {
  criteria: StayCriteria;
  filters?: RoomFilters;
  addOnIds?: string[];
}

/** Builds the canonical query string so every link in the app carries the stay. */
export function buildQuery({ criteria, filters, addOnIds }: QueryInput): string {
  const params = new URLSearchParams();
  params.set(searchParamKeys.checkIn, criteria.checkIn);
  params.set(searchParamKeys.checkOut, criteria.checkOut);
  params.set(searchParamKeys.adults, String(criteria.adults));
  params.set(searchParamKeys.children, String(criteria.children));

  if (filters) {
    if (filters.minPrice !== null) params.set(searchParamKeys.minPrice, String(filters.minPrice));
    if (filters.maxPrice !== null) params.set(searchParamKeys.maxPrice, String(filters.maxPrice));
    if (filters.minArea !== null) params.set(searchParamKeys.minArea, String(filters.minArea));
    if (filters.minFloor !== null) params.set(searchParamKeys.minFloor, String(filters.minFloor));
    filters.views.forEach((view) => params.append(searchParamKeys.view, view));
    filters.bedTypes.forEach((bed) => params.append(searchParamKeys.bed, bed));
    filters.categories.forEach((category) => params.append(searchParamKeys.category, category));
    filters.amenities.forEach((amenity) => params.append(searchParamKeys.amenity, amenity));
    if (!filters.includeSoldOut) params.set(searchParamKeys.hideSoldOut, '1');
    if (filters.sort !== 'recommended') params.set(searchParamKeys.sort, filters.sort);
  }

  addOnIds?.forEach((id) => params.append(searchParamKeys.addOn, id));

  return params.toString();
}
