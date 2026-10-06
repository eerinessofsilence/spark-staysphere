import { format, isValid, parseISO } from 'date-fns';
import type { InvoiceRegisterRow } from './accounting-invoices';
import type { LedgerState } from './accounting';

export const INVOICE_FILTER_KEYS = ['q', 'status', 'method', 'from', 'to'] as const;
export const INVOICE_STATES: LedgerState[] = ['collected', 'awaiting', 'declined', 'owed_back', 'void'];

export interface InvoiceFilters {
  query: string;
  status: LedgerState | null;
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

export function parseInvoiceFilters(params: SearchParams): InvoiceFilters {
  const status = first(params.status);
  const rawFrom = first(params.from);
  const rawTo = first(params.to);
  const from = validDate(rawFrom);
  const to = validDate(rawTo);
  return {
    query: first(params.q).trim().slice(0, 200),
    status: INVOICE_STATES.includes(status as LedgerState) ? status as LedgerState : null,
    method: first(params.method).trim(),
    from,
    to,
    invalidDates: Boolean((rawFrom && !from) || (rawTo && !to) || (from && to && from > to)),
  };
}

/** Dates filter the invoice issue date, which is the booking creation date in this demo register. */
export function filterInvoiceRows(rows: InvoiceRegisterRow[], filters: InvoiceFilters): InvoiceRegisterRow[] {
  if (filters.invalidDates) return [];
  const query = filters.query.toLocaleLowerCase();
  return rows.filter(({ booking, method, state }) => {
    if (filters.status && state !== filters.status) return false;
    if (filters.method && method !== filters.method) return false;
    const issuedOn = booking.createdAt.slice(0, 10);
    if (filters.from && issuedOn < filters.from) return false;
    if (filters.to && issuedOn > filters.to) return false;
    const guest = booking.guest;
    return !query || `${booking.reference} ${guest.firstName} ${guest.lastName} ${guest.email}`.toLocaleLowerCase().includes(query);
  });
}

export function resetInvoiceFiltersHref(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'page' || key === 'invoice' || INVOICE_FILTER_KEYS.some((filter) => key === filter) || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const search = query.toString();
  return `/admin/accounting/invoices${search ? `?${search}` : ''}`;
}
