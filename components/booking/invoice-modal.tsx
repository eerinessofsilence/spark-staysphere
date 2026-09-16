'use client';

import * as React from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { Receipt } from '@phosphor-icons/react/dist/ssr';
import type { Currency } from '@/lib/domain/schemas';
import { formatDate, formatDateRange, formatMoney, formatNights } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';

interface InvoiceLine {
  label: string;
  amount: number;
}

export interface InvoiceData {
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
 */
export function InvoiceButton({ invoice }: { invoice: InvoiceData }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        <Receipt weight="fill" className="size-4" aria-hidden="true" />
        View invoice
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Invoice" className="sm:max-w-xl">
        <div id="invoice-printable">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-display text-2xl">{invoice.hotelName}</p>
              <p className="text-sm text-muted-foreground">{invoice.hotelLocation}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Invoice</p>
              <p className="text-display text-xl tracking-wide">INV-{invoice.reference}</p>
              <p className="text-xs text-muted-foreground">Issued {formatDate(invoice.issuedOn)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-y border-border py-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Billed to</p>
              <p className="mt-1 text-sm font-medium">{invoice.guestName}</p>
              <p className="text-sm text-muted-foreground">{invoice.guestEmail}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Stay</p>
              <p className="mt-1 text-sm font-medium">{invoice.roomName}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateRange(invoice.checkIn, invoice.checkOut)} · {formatNights(invoice.nights)}
              </p>
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.label} className="border-b border-border/60">
                  <td className="py-2">{line.label}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(line.amount, invoice.currency)}</td>
                </tr>
              ))}
              <tr className="border-b border-border/60">
                <td className="py-2">Taxes and city fees</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(invoice.taxesAndFees, invoice.currency)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <span className="text-sm font-medium">Total</span>
            <span className="text-display text-3xl">{formatMoney(invoice.total, invoice.currency)}</span>
          </div>

          {invoice.methodLabel ? (
            <p className="mt-2 flex items-baseline justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{invoice.paid ? 'Paid with' : 'To pay with'}</span>
              <span className="font-semibold">{invoice.methodLabel}</span>
            </p>
          ) : null}

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            This is a demo invoice generated for illustration only — no payment was collected and it
            has no fiscal standing.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={() => window.print()} className={pill('primary')}>
            <PrinterIcon className="size-4" aria-hidden="true" />
            Print
          </button>
        </div>
      </Modal>
    </>
  );
}
