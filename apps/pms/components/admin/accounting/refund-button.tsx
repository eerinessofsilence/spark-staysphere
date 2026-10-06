'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { recordRefundAction } from '@/app/admin/accounting/actions';
import type { Currency } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lMoney } from '@/lib/i18n/format';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface RefundLine { id: string; label: string; amount: number; kind: 'room' | 'service' | 'order' }
export interface RefundableBooking { reference: string; guestName: string; refundable: number; currency: Currency; lines: RefundLine[] }
const METHODS = ['card', 'pos', 'cash', 'bank_transfer'] as const;
const VAT_RATES = [0, 6, 13, 23] as const;

export function RefundButton({ booking }: { booking: RefundableBooking }) {
  const t = useAdminT(); const locale = useAdminLocale(); const router = useRouter();
  const [open, setOpen] = React.useState(false); const [scope, setScope] = React.useState<'full' | 'items'>('full');
  const [selected, setSelected] = React.useState<string[]>([]); const [amount, setAmount] = React.useState(String(booking.refundable));
  const [vatRate, setVatRate] = React.useState('0'); const [method, setMethod] = React.useState<(typeof METHODS)[number]>('cash');
  const [reason, setReason] = React.useState(''); const [comment, setComment] = React.useState('');
  const [pending, setPending] = React.useState(false); const [error, setError] = React.useState('');
  const openModal = () => { setScope('full'); setSelected([]); setAmount(String(booking.refundable)); setVatRate('0'); setMethod('cash'); setReason(''); setComment(''); setError(''); setOpen(true); };
  const chooseScope = (next: 'full' | 'items') => { setScope(next); setSelected([]); setAmount(next === 'full' ? String(booking.refundable) : ''); };
  const toggle = (line: RefundLine) => setSelected((current) => { const next = current.includes(line.id) ? current.filter((id) => id !== line.id) : [...current, line.id]; const sum = booking.lines.filter((item) => next.includes(item.id)).reduce((total, item) => total + item.amount, 0); setAmount(String(Math.min(booking.refundable, Math.round(sum * 100) / 100))); return next; });
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setPending(true); setError(''); const result = await recordRefundAction(booking.reference, method, Number(amount), Number(vatRate), comment, scope, selected, reason); setPending(false); if (!result.ok) { setError(result.message); return; } setOpen(false); toast.success(result.message); router.refresh(); };
  return <>
    <button type="button" onClick={openModal} aria-label={`${t('accounting.refund')} ${booking.reference}`} className={iconButton('light', 'relative z-10 size-9')}><ArrowUturnLeftIcon className="size-4" aria-hidden="true" /></button>
    <Modal open={open} onClose={() => setOpen(false)} title={t('accounting.refund')}>
      <form onSubmit={submit} className="grid gap-4">
        <p className="text-sm text-muted-foreground">{booking.reference} · {booking.guestName} · {t('accounting.refundableBalance', { amount: lMoney(booking.refundable, booking.currency, locale) })}</p>
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm text-muted-foreground">{t('accounting.refundType')}</legend>
          <label className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition-colors', scope === 'full' ? 'border-accent bg-accent/10' : 'border-border hover:bg-stone/40')}><input type="radio" name="refund-scope" checked={scope === 'full'} onChange={() => chooseScope('full')} /> <span className="font-medium">{t('accounting.refundFull')}</span></label>
          <label className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition-colors', scope === 'items' ? 'border-accent bg-accent/10' : 'border-border hover:bg-stone/40')}><input type="radio" name="refund-scope" checked={scope === 'items'} onChange={() => chooseScope('items')} /> <span className="font-medium">{t('accounting.refundItems')}</span></label>
        </fieldset>
        {scope === 'items' ? <fieldset className="grid max-h-52 gap-2 overflow-y-auto rounded-2xl border border-border p-3"><legend className="px-1 text-sm text-muted-foreground">{t('accounting.chooseRefundItems')}</legend>{booking.lines.map((line) => <label key={line.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-stone"><input type="checkbox" checked={selected.includes(line.id)} onChange={() => toggle(line)} /><span className="min-w-0 flex-1 text-sm">{line.label}</span><span className="text-sm tabular-nums">{lMoney(line.amount, booking.currency, locale)}</span></label>)}</fieldset> : null}
        <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{t('accounting.refundReason')}</span><input className={fieldClass} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
        <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{t('accounting.thAmount')}</span><input className={fieldClass} type="number" min="0.01" max={booking.refundable} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{t('accounting.vat')}</span><Select items={VAT_RATES.map((rate) => ({ value: String(rate), label: `${rate}%` }))} value={vatRate} onValueChange={(value) => value && setVatRate(value)}><SelectTrigger className={cn(fieldClass, 'h-11 justify-between py-0')}><SelectValue /></SelectTrigger><SelectContent>{VAT_RATES.map((rate) => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}</SelectContent></Select></label>
        <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{t('accounting.refundMethod')}</span><Select items={METHODS.map((id) => ({ value: id, label: t(`accounting.refundMethod.${id}`) }))} value={method} onValueChange={(value) => value && setMethod(value as typeof method)}><SelectTrigger className={cn(fieldClass, 'h-11 justify-between py-0')}><SelectValue /></SelectTrigger><SelectContent>{METHODS.map((id) => <SelectItem key={id} value={id}>{t(`accounting.refundMethod.${id}`)}</SelectItem>)}</SelectContent></Select></label></div>
        <label className="grid gap-1.5 text-sm"><span className="text-muted-foreground">{t('accounting.comment')}</span><textarea className={cn(fieldClass, 'min-h-20 resize-y')} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending || (scope === 'items' && selected.length === 0)} className={pill('primary')}>{pending ? <ArrowPathIcon className="size-4 animate-spin" /> : null}{t('accounting.recordRefund')}</button><button type="button" onClick={() => setOpen(false)} className={pill('secondary')}>{t('frontDesk.cancel')}</button></div>
      </form>
    </Modal>
  </>;
}
