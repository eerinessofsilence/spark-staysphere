'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { InvoiceModal, type InvoiceData } from '@/components/booking/invoice-modal';
import { useAdminLocale } from '@/lib/i18n/admin/context';

/** The URL owns the selected invoice, so refresh and Back preserve the register. */
export function AccountingInvoicePreview({ invoice, closeHref }: { invoice: InvoiceData; closeHref: string }) {
  const router = useRouter();
  const locale = useAdminLocale();
  const [open, setOpen] = useState(true);
  return <InvoiceModal invoice={invoice} locale={locale} open={open} onClose={() => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  }} />;
}
