'use client';

import * as React from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { Currency } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';

export interface InvoiceChoice {
  reference: string;
  guestName: string;
  amount: number;
  currency: Currency;
}

/** Opens the selected booking's derived demo invoice; invoice records are not persisted yet. */
export function CreateInvoiceButton({ choices }: { choices: InvoiceChoice[] }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reference, setReference] = React.useState('');
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  function create(event: React.FormEvent) {
    event.preventDefault();
    if (!reference) return;
    setOpen(false);
    router.push(`/admin/accounting/invoices?invoice=${encodeURIComponent(reference)}`, { scroll: false });
  }

  return <>
    <button type="button" disabled={!ready || choices.length === 0} onClick={() => { setReference(choices[0]?.reference ?? ''); setOpen(true); }} className={pill('primary')}>
      <PlusIcon className="size-4" aria-hidden="true" />{t('accounting.createInvoice')}
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={t('accounting.createInvoice')}>
      <form onSubmit={create} className="grid gap-4">
        <p className="text-sm text-muted-foreground">{t('accounting.createInvoiceIntro')}</p>
        <div>
          <label htmlFor="create-invoice-booking" className="mb-1.5 block text-sm text-muted-foreground">{t('accounting.selectBooking')}</label>
          <Select items={choices.map((item) => ({
            value: item.reference,
            label: `${item.reference} — ${item.guestName} — ${lMoney(item.amount, item.currency, locale)}`,
          }))} value={reference} onValueChange={(value) => value && setReference(value)}>
            <SelectTrigger id="create-invoice-booking" className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0')}><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
              {choices.map((item) => <SelectItem key={item.reference} value={item.reference} className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground">
                {item.reference} — {item.guestName} — {lMoney(item.amount, item.currency, locale)}
              </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={!reference} className={pill('primary')}>{t('accounting.renderInvoice')}</button>
          <button type="button" onClick={() => setOpen(false)} className={pill('secondary')}>{t('frontDesk.cancel')}</button>
        </div>
      </form>
    </Modal>
  </>;
}
