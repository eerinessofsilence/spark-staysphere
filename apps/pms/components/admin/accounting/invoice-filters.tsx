'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AdjustmentsHorizontalIcon, ArrowPathIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { INVOICE_FILTER_KEYS, INVOICE_STATES, type InvoiceFilters } from '@/lib/application/invoice-filters';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDateShort } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATE_KEYS: Record<string, AdminTranslationKey> = {
  collected: 'accounting.collected', awaiting: 'accounting.awaitingPayment', declined: 'accounting.declined',
  owed_back: 'accounting.owedBack', void: 'accounting.void',
};

export interface InvoiceSearchSuggestion {
  reference: string;
  guestName: string;
  email: string;
}

export function InvoiceFiltersBar({ filters, methods, resetHref, suggestions }: {
  filters: InvoiceFilters;
  methods: string[];
  resetHref: string;
  suggestions: InvoiceSearchSuggestion[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useAdminT();
  const locale = useAdminLocale();
  const [query, setQuery] = React.useState(filters.query);
  const [status, setStatus] = React.useState(filters.status ?? '');
  const [method, setMethod] = React.useState(filters.method);
  const [range, setRange] = React.useState<DateRange | undefined>(
    !filters.invalidDates && (filters.from || filters.to)
      ? { from: filters.from ? parseISO(filters.from) : undefined, to: filters.to ? parseISO(filters.to) : undefined }
      : undefined,
  );
  const [draft, setDraft] = React.useState<DateRange | undefined>();
  const [open, setOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [months, setMonths] = React.useState(1);
  const [ready, setReady] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const previousFilters = React.useRef({ query: filters.query, status: filters.status, method: filters.method, from: filters.from, to: filters.to, invalidDates: filters.invalidDates });

  React.useEffect(() => {
    setReady(true);
    const media = window.matchMedia('(min-width: 640px)');
    const apply = () => setMonths(media.matches ? 2 : 1);
    apply();
    media.addEventListener('change', apply);
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      media.removeEventListener('change', apply);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, []);

  React.useEffect(() => {
    const previous = previousFilters.current;
    if (filters.query !== previous.query) setQuery(filters.query);
    if (filters.status !== previous.status) setStatus(filters.status ?? '');
    if (filters.method !== previous.method) setMethod(filters.method);
    if (filters.from !== previous.from || filters.to !== previous.to || filters.invalidDates !== previous.invalidDates) {
      setRange(!filters.invalidDates && (filters.from || filters.to)
        ? { from: filters.from ? parseISO(filters.from) : undefined, to: filters.to ? parseISO(filters.to) : undefined }
        : undefined);
    }
    previousFilters.current = { query: filters.query, status: filters.status, method: filters.method, from: filters.from, to: filters.to, invalidDates: filters.invalidDates };
  }, [filters.query, filters.status, filters.method, filters.from, filters.to, filters.invalidDates]);

  function applyFilters(nextQuery = query, nextStatus = status, nextMethod = method, nextRange = range) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const key of INVOICE_FILTER_KEYS) params.delete(key);
    params.delete('page');
    params.delete('invoice');
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextStatus) params.set('status', nextStatus);
    if (nextMethod) params.set('method', nextMethod);
    if (nextRange?.from) params.set('from', format(nextRange.from, 'yyyy-MM-dd'));
    if (nextRange?.to) params.set('to', format(nextRange.to, 'yyyy-MM-dd'));
    const search = params.toString();
    startTransition(() => router.push(`${pathname}${search ? `?${search}` : ''}`, { scroll: false }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    applyFilters(query, status, method, range);
    setMobileOpen(false);
  }

  const statuses = [{ value: '', label: t('accounting.allStatuses') }, ...INVOICE_STATES.map((value) => ({ value, label: t(STATE_KEYS[value]) }))];
  const methodItems = [{ value: '', label: t('accounting.allMethods') }, ...methods.map((value) => ({ value, label: methodLabel(value, locale) }))];
  const dateLabel = range?.from && range.to
    ? `${lDateShort(format(range.from, 'yyyy-MM-dd'), locale)}${range.to.getTime() !== range.from.getTime() ? ` – ${lDateShort(format(range.to, 'yyyy-MM-dd'), locale)}` : ''}`
    : range?.from
      ? t('accounting.invoicesFrom', { date: lDateShort(format(range.from, 'yyyy-MM-dd'), locale) })
      : range?.to
        ? t('accounting.invoicesUntil', { date: lDateShort(format(range.to, 'yyyy-MM-dd'), locale) })
        : t('accounting.anyInvoiceDate');
  const activeCount = Number(Boolean(filters.query)) + Number(Boolean(filters.status)) + Number(Boolean(filters.method))
    + Number(Boolean(filters.from || filters.to || filters.invalidDates));
  const active = activeCount > 0;

  function openMobileFilters() {
    setQuery(filters.query);
    setStatus(filters.status ?? '');
    setMethod(filters.method);
    setRange(!filters.invalidDates && (filters.from || filters.to)
      ? { from: filters.from ? parseISO(filters.from) : undefined, to: filters.to ? parseISO(filters.to) : undefined }
      : undefined);
    setMobileOpen(true);
  }

  function selectField(id: string, label: string, value: string, items: { value: string; label: string }[], onChange: (next: string) => void) {
    return <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm text-muted-foreground">{label}</label>
      <Select disabled={!ready || pending} items={items} value={value} onValueChange={(next) => { const value = next ?? ''; onChange(value); applyFilters(filters.query, id.includes('status') ? value : status, id.includes('method') ? value : method, range); }}>
        <SelectTrigger id={id} className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0 text-sm data-[size=default]:h-11')}><SelectValue /></SelectTrigger>
        <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
          {items.map((item) => <SelectItem key={item.value} value={item.value} className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground">{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>;
  }

  function filterForm(variant: 'desktop' | 'mobile') {
    const suffix = `-${variant}`;
    return <form onSubmit={submit} aria-label={t('accounting.invoiceFilters')} aria-busy={pending}>
      <div role="group" aria-label={t('accounting.invoiceFilters')} className="min-w-0">
        <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1.4fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(13rem,1.2fr)]">
          <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
            <label htmlFor={`invoices-search${suffix}`} className="mb-1.5 block text-sm text-muted-foreground">{t('accounting.searchInvoices')}</label>
            <SearchInput
              id={`invoices-search${suffix}`}
              disabled={!ready || pending}
              maxLength={200}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              suggestions={suggestions.map((item) => ({ value: item.reference, label: item.guestName, detail: item.email }))}
              suggestionsLabel={t('accounting.searchInvoices')}
              onSuggestionSelect={(item) => setQuery(item.value)}
              placeholder={t('ops.searchPlaceholder')}
              className="h-11 py-0 text-sm"
            />
          </div>
          {selectField(`invoices-status${suffix}`, t('ops.thStatus'), status, statuses, setStatus)}
          {selectField(`invoices-method${suffix}`, t('accounting.thMethod'), method, methodItems, setMethod)}
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <span className="mb-1.5 block text-sm text-muted-foreground">{t('accounting.invoiceDate')}</span>
            <button type="button" disabled={!ready || pending} aria-label={t('accounting.chooseInvoiceDate')} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setDraft(range); setOpen(true); }} className={pill('secondary', 'min-h-11 w-full min-w-0 justify-start px-4 py-2 text-sm')}>
              <CalendarIcon className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{dateLabel}</span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!ready || pending || query.trim() === filters.query} className={pill('primary', 'min-h-11 px-5 text-sm')}>
            {pending ? t('accounting.filteringInvoices') : t('accounting.searchInvoicesAction')}
          </button>
          {active ? <Link href={resetHref} scroll={false} onClick={() => setMobileOpen(false)} className={pill('ghost', 'min-h-11 px-4 text-sm')}><ArrowPathIcon className="size-4" aria-hidden="true" />{t('accounting.resetFilters')}</Link> : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('accounting.invoiceFilterScope')}</p>
      </div>
    </form>;
  }

  return <>
    <div className="mt-5 flex items-center gap-2 lg:hidden">
      <button type="button" disabled={!ready || pending} onClick={openMobileFilters} aria-label={active ? `${t('ops.filters')} · ${activeCount}` : t('ops.filters')} aria-haspopup="dialog" aria-expanded={mobileOpen} className={pill('secondary', 'min-h-11 gap-2 px-4 text-sm shadow-soft')}>
        <AdjustmentsHorizontalIcon className="size-4 shrink-0" aria-hidden="true" />{t('ops.filters')}
        {active ? <span aria-hidden="true" className="rounded-full bg-primary px-2 py-0.5 text-xs tabular-nums text-primary-foreground">{activeCount}</span> : null}
      </button>
    </div>
    <div className="mt-5 hidden min-w-0 rounded-[18px] bg-card p-5 shadow-soft lg:block">{filterForm('desktop')}</div>
    <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title={t('accounting.invoiceFilters')}>{filterForm('mobile')}</Modal>
    <Modal open={open} onClose={() => setOpen(false)} title={t('accounting.chooseInvoiceDate')} className="sm:max-w-[44rem]">
      <DayPicker mode="range" selected={draft} onSelect={(next) => {
        setDraft(next);
        if (next?.from && next.to) {
          const selectedRange = { from: next.from, to: next.to };
          setRange(selectedRange);
          applyFilters(filters.query, status, method, selectedRange);
          setOpen(false);
        }
      }} numberOfMonths={months} showOutsideDays={false} weekStartsOn={1} fixedWeeks locale={DATE_FNS_LOCALES[locale]} defaultMonth={draft?.from ?? new Date()} classNames={CALENDAR_CLASS_NAMES} components={CALENDAR_COMPONENTS} />
      <p role="status" className="mt-4 text-center text-sm text-muted-foreground">{draft?.from ? `${lDateShort(format(draft.from, 'yyyy-MM-dd'), locale)}${draft.to ? ` – ${lDateShort(format(draft.to, 'yyyy-MM-dd'), locale)}` : ''}` : t('ops.datesPick')}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-border pt-4">
        <button type="button" onClick={() => { setRange(undefined); applyFilters(filters.query, status, method, undefined); setOpen(false); }} className={pill('ghost', 'min-h-11 text-sm')}>{t('ops.clearDates')}</button>
      </div>
    </Modal>
  </>;
}
