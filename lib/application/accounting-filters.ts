import { isValid, parseISO, format } from 'date-fns';
import type { LedgerRow, LedgerState } from './accounting';

export const PAYMENT_FILTER_KEYS = ['q', 'status', 'method', 'from', 'to'] as const;
export const PAYMENT_STATES: LedgerState[] = ['collected', 'awaiting', 'declined', 'owed_back', 'void'];

export interface PaymentFilters {
  query: string;
  status: LedgerState | null;
  /** Empty means all methods; `none` means no payment attempt recorded. */
  method: string;
  from: string | null;
  to: string | null;
  invalidDates: boolean;
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

function validDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseISO(value);
  return isValid(date) && format(date, 'yyyy-MM-dd') === value ? value : null;
}

export function parsePaymentFilters(params: SearchParams): PaymentFilters {
  const status = first(params.status);
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const from = validDate(rawFrom);
  const to = validDate(rawTo);
  return {
    query: first(params.q).trim().slice(0, 200),
    status: PAYMENT_STATES.includes(status as LedgerState) ? status as LedgerState : null,
    method: first(params.method).trim(),
    from,
    to,
    invalidDates: Boolean((rawFrom && !from) || (rawTo && !to) || (from && to && from > to)),
  };
}

/** Dates match the Booked column, inclusively, not the arrival or a transaction date. */
export function filterPaymentRows(rows: LedgerRow[], filters: PaymentFilters): LedgerRow[] {
  if (filters.invalidDates) return [];
  const query = filters.query.toLocaleLowerCase();
  return rows.filter(({ booking, method, state }) => {
    if (filters.status && state !== filters.status) return false;
    if (filters.method && (filters.method === 'none' ? method !== null : method !== filters.method)) return false;
    const booked = booking.createdAt.slice(0, 10);
    if (filters.from && booked < filters.from) return false;
    if (filters.to && booked > filters.to) return false;
    const guest = booking.guest;
    return !query || `${booking.reference} ${guest.firstName} ${guest.lastName} ${guest.email}`.toLocaleLowerCase().includes(query);
  });
}

/** Reset just this register, keeping the other grid's pager and the preferred page size. */
export function resetPaymentFiltersHref(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || PAYMENT_FILTER_KEYS.some((filter) => key === filter) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const search = query.toString();
  return `/admin/accounting${search ? `?${search}` : ''}`;
}
