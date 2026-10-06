'use client';

import * as React from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { Receipt } from '@phosphor-icons/react/dist/ssr';
import type { Currency, PaymentMethod } from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';
import { lDate, lDateRange, lMoney, lNights, PAYMENT_METHOD_LABEL } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import type { InvoiceDetails } from '@/lib/application/accounting-invoices';

interface InvoiceLine {
  label: string;
  amount: number;
}

export interface InvoiceData {
  details?: InvoiceDetails;
  reference: string;
  issuedOn: string;
  hotelName: string;
  hotelLocation: string;
  guestName: string;
  guestEmail: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  currency: Currency;
  lines: InvoiceLine[];
  taxesAndFees: number;
  total: number;
  methodLabel: string | null;
  paid: boolean;
}

/**
 * A one-page tax invoice, styled to print — the demo's own version of what a
 * real PMS would email as a PDF. `#invoice-printable`'s print rule (see
 * `app/globals.css`) hides everything else on the page when "Print" is
 * pressed, so this is the only thing that comes out.
 *
 * Controlled (`open`/`onClose`) so both the guest confirmation page
 * (`InvoiceButton`, its own trigger below) and the back office (its
 * "Issue invoice" action in `BookingHeaderActions`) can open the same
 * modal from whichever control makes sense on that page.
 */
export function InvoiceModal({ invoice, open, onClose, locale: suppliedLocale }: { invoice: InvoiceData; open: boolean; onClose: () => void; locale?: Locale }) {
  const t = useT(suppliedLocale);
  const { locale: siteLocale } = useLocale();
  const locale = suppliedLocale ?? siteLocale;

  return (
    <Modal open={open} onClose={onClose} title={t('invoice.invoice')} className="sm:max-w-4xl">
      <article id="invoice-printable" className="invoice-document">
        <div className="invoice-brand flex flex-wrap items-start justify-between gap-5">
          <div>
            <img src="/brand/staysphere-logo-on-light.svg" alt="StaySphere" width={190} height={33} className="invoice-logo mb-5 h-auto w-44 sm:w-48" />
            <p className="text-display text-xl">{invoice.hotelName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{invoice.hotelLocation}</p>
          </div>
          <div className="invoice-number sm:text-right">
            <h2 className="text-display text-3xl sm:text-4xl">{t('invoice.invoice')}</h2>
            <p className="mt-3 font-mono text-sm font-semibold">INV-{invoice.reference}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('invoice.issued', { date: lDate(invoice.issuedOn, locale) })}
            </p>
          </div>
        </div>

        <div className="invoice-parties mt-7 grid gap-6 border-y border-border py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('invoice.billedTo')}</p>
            <p className="mt-2 break-words text-sm font-semibold">{invoice.guestName}</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">{invoice.guestEmail}</p>
            {invoice.details?.phone ? <p className="mt-1 text-sm text-muted-foreground">{invoice.details.phone}</p> : null}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('invoice.stay')}</p>
            <p className="mt-2 text-sm font-semibold">{invoice.roomName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lDateRange(invoice.checkIn, invoice.checkOut, locale)} · {lNights(invoice.nights, locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('invoice.bookingReference')}: {invoice.reference}{invoice.details?.roomNumber ? ` · ${t('invoice.room')}: ${invoice.details.roomNumber}` : ''}</p>
          </div>
        </div>

        {invoice.details ? <>
        <div className="invoice-table-wrap mt-6 overflow-x-auto">
          <table aria-label={t('invoice.description')} className="invoice-lines w-full min-w-[36rem] text-xs">
            <thead><tr className="border-b border-border text-left text-muted-foreground">
              {(['invoice.date', 'invoice.type', 'invoice.description', 'invoice.quantity', 'invoice.unitPrice', 'invoice.amount'] as const).map((key, index) => <th key={key} scope="col" className={`px-2 py-3 font-medium ${index >= 3 ? 'text-right' : ''}`}>{t(key)}</th>)}
            </tr></thead>
            <tbody>{invoice.details.lines.map((line) => <tr key={line.id} className="border-b border-border/60">
              <td className="px-2 py-3">{line.endDate ? lDateRange(line.date, line.endDate, locale) : lDate(line.date, locale)}</td>
              <td className="px-2 py-3">{t(`invoice.${line.type}`)}</td>
              <td className="px-2 py-3">{line.type === 'tax' ? t('invoice.cityTax') : line.description}</td>
              <td className="px-2 py-3 text-right tabular-nums">{line.quantity ?? '—'}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap tabular-nums">{line.unitPrice === null ? '—' : lMoney(line.unitPrice, invoice.currency, locale)}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap tabular-nums">{lMoney(line.amount, invoice.currency, locale)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('invoice.vatUnspecified')}</p>
        </> : <table className="invoice-lines mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-3 font-medium">{t('invoice.description')}</th>
              <th scope="col" className="pb-3 text-right font-medium">{t('invoice.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.label} className="border-b border-border/60">
                <td className="py-3 pr-4">{line.label}</td>
                <td className="whitespace-nowrap py-3 text-right tabular-nums">{lMoney(line.amount, invoice.currency, locale)}</td>
              </tr>
            ))}
            <tr className="border-b border-border/60">
              <td className="py-3 pr-4">{t('invoice.taxesAndFees')}</td>
              <td className="whitespace-nowrap py-3 text-right tabular-nums">
                {lMoney(invoice.taxesAndFees, invoice.currency, locale)}
              </td>
            </tr>
          </tbody>
        </table>}

        <div className="invoice-total mt-6 flex flex-wrap items-baseline justify-between gap-3 rounded-2xl px-5 py-5">
          <span className="text-sm font-medium">{t('invoice.total')}</span>
          <span className="text-display text-3xl tabular-nums sm:text-4xl">{lMoney(invoice.details?.total ?? invoice.total, invoice.currency, locale)}</span>
        </div>

        {invoice.details ? <div className="mt-6">
          <h3 className="text-sm font-semibold">{t('invoice.payments')}</h3>
          {invoice.details.payments.length > 0 ? <div className="invoice-table-wrap mt-3 overflow-x-auto"><table aria-label={t('invoice.payments')} className="w-full min-w-[28rem] text-xs">
            <thead><tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="px-2 py-2 font-medium">{t('invoice.date')}</th><th scope="col" className="px-2 py-2 font-medium">{t('invoice.type')}</th><th scope="col" className="px-2 py-2 font-medium">{t('invoice.method')}</th><th scope="col" className="px-2 py-2 text-right font-medium">{t('invoice.amount')}</th>
            </tr></thead><tbody>{invoice.details.payments.map((payment) => <tr key={payment.id} className="border-b border-border/60">
              <td className="px-2 py-3">{payment.date ? lDate(payment.date, locale) : '—'}</td>
              <td className="px-2 py-3">{t(`invoice.${payment.type}`)}{payment.receipt ? <span className="mt-1 block text-muted-foreground">{payment.receipt}</span> : null}{payment.operator ? <span className="mt-1 block text-muted-foreground">{payment.operator}</span> : null}</td>
              <td className="px-2 py-3">{payment.method ? PAYMENT_METHOD_LABEL[locale][payment.method as PaymentMethod] ?? payment.method : '—'}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap tabular-nums">{payment.type === 'refund' ? '−' : ''}{lMoney(payment.amount, invoice.currency, locale)}</td>
            </tr>)}</tbody></table></div> : <p className="mt-3 text-xs text-muted-foreground">{t('invoice.noPayments')}</p>}
          <dl className="mt-4 ml-auto max-w-xs text-sm">
            <div className="flex justify-between gap-4 py-1"><dt>{t('invoice.paid')}</dt><dd className="tabular-nums">{lMoney(invoice.details.paid, invoice.currency, locale)}</dd></div>
            {invoice.details.refunded > 0 ? <div className="flex justify-between gap-4 py-1"><dt>{t('invoice.refund')}</dt><dd className="tabular-nums">{lMoney(invoice.details.refunded, invoice.currency, locale)}</dd></div> : null}
            <div className="mt-2 flex justify-between gap-4 border-t border-border pt-3 font-semibold"><dt>{t(invoice.details.balance < 0 ? 'invoice.credit' : 'invoice.balance')}</dt><dd className="tabular-nums">{lMoney(Math.abs(invoice.details.balance), invoice.currency, locale)}</dd></div>
          </dl>
        </div> : invoice.methodLabel ? (
          <p className="mt-4 flex flex-wrap items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {invoice.paid ? t('invoice.paidWith') : t('invoice.toPayWith')}
            </span>
            <span className="font-semibold">{invoice.methodLabel}</span>
          </p>
        ) : null}

        <footer className="mt-7 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{t('invoice.disclaimer')}</footer>
      </article>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={() => window.print()} className={pill('primary')}>
          <PrinterIcon className="size-4" aria-hidden="true" />
          {t('invoice.print')}
        </button>
      </div>
    </Modal>
  );
}

/** The guest confirmation page's own trigger — a button that owns its modal's open state. */
export function InvoiceButton({ invoice }: { invoice: InvoiceData }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        <Receipt weight="fill" className="size-4" aria-hidden="true" />
        {t('confirm.viewInvoice')}
      </button>
      <InvoiceModal invoice={invoice} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
