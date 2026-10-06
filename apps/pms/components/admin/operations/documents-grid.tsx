'use client';

import * as React from 'react';
import Link from 'next/link';
import type { GuestDocument } from '@/lib/domain/guest-document';
import { Modal } from '@/components/site/modal';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateRange } from '@/lib/i18n/format';
import { pill, tag } from '@/lib/ui';
import { CLIENT_PAGE_SIZE, ClientPagination, paginateClient } from './client-pagination';
import { TableCard, Td, Th } from './table';
import { DocumentActions } from './document-actions';
import { SearchInput } from '@/components/ui/search-input';
import { NativeSelect } from '@/components/ui/native-select';
import { filterDocuments } from '@/lib/application/document-filters';

export type DocumentTile = Omit<GuestDocument, 'objectKeys' | 'hotelId'> & {
  guestName: string;
  /** The stay the document was scanned for — what its photo is kept until. `null` once that booking is gone. */
  checkIn: string | null;
  checkOut: string | null;
};

function imageUrl(id: string): string {
  return `/admin/guests/documents/${encodeURIComponent(id)}/image`;
}

export function DocumentsGrid({ documents }: { documents: DocumentTile[] }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [photoRevision, setPhotoRevision] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(CLIENT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');
  const searchLabel = locale === 'ru' ? 'Имя, фамилия или номер документа' : locale === 'de' ? 'Name oder Dokumentnummer' : 'Name or document number';
  const filtered = filterDocuments(documents, { query, status, type });
  const applySearch = () => { setQuery(search); setPage(1); };
  const open = documents.find((document) => document.id === openId) ?? null;
  const { pageItems, page: currentPage, totalPages } = paginateClient(filtered, page, pageSize);

  return (
    <>
      <form onSubmit={(event) => { event.preventDefault(); applySearch(); }} className="mt-6 grid gap-4 rounded-[18px] bg-card p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
        <div className="min-w-0"><label htmlFor="documents-search" className="mb-2 block text-sm text-muted-foreground">{searchLabel}</label>
          <SearchInput id="documents-search" disabled={!ready} value={search} placeholder={searchLabel} onChange={(event) => { setSearch(event.target.value); if (!event.target.value) { setQuery(''); setPage(1); } }}
            suggestions={documents.map((item) => ({ value: item.identity.documentNumber, label: `${item.identity.firstName} ${item.identity.lastName}`, detail: `${item.identity.documentNumber} · ${item.reservationReference}` }))}
            onSuggestionSelect={(item) => { setSearch(item.value); setQuery(item.value); setPage(1); }} />
        </div>
        <label className="grid gap-2 text-sm text-muted-foreground"><span>{t('orders.thStatus')}</span><NativeSelect aria-label={t('orders.thStatus')} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">{t('orders.all')}</option>{(['active', 'uploading', 'pending_deletion', 'deleted'] as const).map((value) => <option key={value} value={value}>{statusLabel(value, t)}</option>)}
        </NativeSelect></label>
        <label className="grid gap-2 text-sm text-muted-foreground"><span>{t('nav.documents')}</span><NativeSelect aria-label={t('nav.documents')} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
          <option value="">{t('orders.all')}</option><option value="passport">{t('documents.passport')}</option><option value="id">{t('documents.idCard')}</option>
        </NativeSelect></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3"><button type="submit" className={pill('primary')} disabled={!ready}>{t('orders.searchButton')}</button><button type="button" className={pill('secondary')} onClick={() => { setSearch(''); setQuery(''); setStatus(''); setType(''); setPage(1); }}>{t('orders.reset')}</button></div>
      </form>
      <div className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
        <TableCard caption={t('nav.documents')} className="min-w-[900px]" attached>
          <thead className="border-b border-border bg-stone/30"><tr>
            <Th>{t('documents.guest')}</Th>
            <Th>{t('nav.documents')}</Th>
            <Th>{t('documents.reservation')}</Th>
            <Th>{t('documents.stay')}</Th>
            <Th>{t('documents.scannedAt')}</Th>
            <Th>{t('orders.thStatus')}</Th>
            <Th><span className="sr-only">{t('nav.documents')}</span></Th>
          </tr></thead>
          <tbody className="divide-y divide-border">{pageItems.map((document) => <tr key={document.id} tabIndex={ready ? 0 : -1} aria-label={t('documents.open', { name: document.guestName })} className="cursor-pointer hover:bg-stone/30 focus-visible:outline-2 focus-visible:outline-accent" onClick={(event) => { if (!(event.target as HTMLElement).closest('a,button')) setOpenId(document.id); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setOpenId(document.id); } }}>
            <Td><Link href={`/admin/guests/${encodeURIComponent(document.guestId)}`} className="font-medium hover:underline">{document.guestName}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{document.identity.dateOfBirth || '—'} · {document.identity.nationality || document.identity.issuingCountry || '—'}</p>
            </Td>
            <Td><span>{document.identity.documentType === 'passport' ? t('documents.passport') : t('documents.idCard')}</span><p className="mt-1 max-w-52 break-all text-xs text-muted-foreground">{document.identity.documentNumber || '—'}</p></Td>
            <Td><Link href={`/admin/bookings/${encodeURIComponent(document.reservationReference)}`} className="font-medium hover:underline">{document.reservationReference}</Link></Td>
            <Td className="whitespace-nowrap">{document.checkIn && document.checkOut ? lDateRange(document.checkIn, document.checkOut, locale) : '—'}</Td>
            <Td className="whitespace-nowrap"><time dateTime={document.createdAt}>{new Date(document.createdAt).toLocaleDateString(locale, { timeZone: 'UTC' })}</time></Td>
            <Td><span className={tag(document.status === 'active' ? 'bg-success/10 text-success' : 'text-muted-foreground')}>{statusLabel(document.status, t)}</span>
              {document.status === 'active' && <p className="mt-1 text-xs text-muted-foreground">{t('documents.photoUntilCheckout')}</p>}
            </Td>
            <Td><DocumentActions document={document} /></Td>
          </tr>)}{pageItems.length === 0 && <tr><Td colSpan={7}><p className="py-8 text-center text-muted-foreground">{t('orders.noMatchBody')}</p></Td></tr>}</tbody>
        </TableCard>

      <ClientPagination
        attached
        page={currentPage}
        totalPages={totalPages}
        total={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      </div>

      <Modal
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? (open.identity.documentType === 'passport' ? t('documents.passport') : t('documents.idCard')) : ''}
        className="sm:max-w-2xl"
      >
        {open ? (
          <div className="grid gap-5">
            {open.status === 'active' ? (
              <DocumentPhoto key={`${open.id}-${photoRevision}`} document={open} revision={photoRevision} />
            ) : (
              <p className="rounded-[14px] bg-stone p-6 text-center text-sm text-muted-foreground">
                {open.status === 'deleted'
                  ? t(open.deletionReason === 'manual' ? 'documents.imageUnavailable' : 'documents.imageDeleted')
                  : open.status === 'pending_deletion'
                    ? t('documents.imagePendingDeletion')
                    : t('documents.imageUploading')}
              </p>
            )}

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('documents.guest')}</dt>
                <dd className="mt-0.5 font-medium">
                  <Link href={`/admin/guests/${encodeURIComponent(open.guestId)}`} className="underline">
                    {open.guestName}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('documents.reservation')}</dt>
                <dd className="mt-0.5 font-medium">
                  <Link href={`/admin/bookings/${open.reservationReference}`} className="underline">
                    {open.reservationReference}
                  </Link>
                </dd>
              </div>
              {open.checkIn && open.checkOut ? (
                <div>
                  <dt className="text-muted-foreground">{t('documents.stay')}</dt>
                  <dd className="mt-0.5 font-medium">{lDateRange(open.checkIn, open.checkOut, locale)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">{t('documents.dateOfBirth')}</dt>
                <dd className="mt-0.5 font-medium">{open.identity.dateOfBirth || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('documents.documentNumber')}</dt>
                <dd className="mt-0.5 truncate font-medium">{open.identity.documentNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('documents.issuingCountry')}</dt>
                <dd className="mt-0.5 font-medium">{open.identity.issuingCountry || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('documents.nationality')}</dt>
                <dd className="mt-0.5 font-medium">{open.identity.nationality || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('documents.issueDate')}</dt>
                <dd className="mt-0.5 font-medium">{open.identity.issueDate || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('documents.expirationDate')}</dt>
                <dd className="mt-0.5 font-medium">{open.identity.expirationDate || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('documents.scannedAt')}</dt>
                <dd className="mt-0.5 font-medium">
                  <time dateTime={open.createdAt}>{new Date(open.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time>
                </dd>
              </div>
              {open.deletedAt ? (
                <div>
                  <dt className="text-muted-foreground">{t('documents.deletedAt')}</dt>
                  <dd className="mt-0.5 font-medium">
                    <time dateTime={open.deletedAt}>{new Date(open.deletedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-wrap justify-end gap-3">
              <DocumentActions document={open} editButton onSaved={() => { setPhotoRevision(Date.now()); setOpenId(null); }} />
              <button type="button" className={pill('secondary')} onClick={() => setOpenId(null)}>
                {t('documents.close')}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function DocumentPhoto({ document, revision }: { document: DocumentTile; revision: number }) {
  const t = useAdminT();
  const [failed, setFailed] = React.useState(false);
  return failed ? <p role="status" className="rounded-[14px] bg-stone p-6 text-center text-sm text-muted-foreground">{t('documents.imageUnavailable')}</p> : (
    <figure>
      <img src={`${imageUrl(document.id)}?v=${revision}`} alt={t('documents.open', { name: document.guestName })}
        onError={() => setFailed(true)} className="max-h-[50vh] w-full rounded-[14px] bg-stone object-contain" />
      <figcaption className="mt-2 text-xs text-muted-foreground">{t('documents.photoUntilCheckout')}</figcaption>
    </figure>
  );
}

function statusLabel(status: GuestDocument['status'], t: ReturnType<typeof useAdminT>): string {
  switch (status) {
    case 'active':
      return t('documents.statusActive');
    case 'uploading':
      return t('documents.statusUploading');
    case 'pending_deletion':
      return t('documents.statusPendingDeletion');
    case 'deleted':
      return t('documents.statusDeleted');
  }
}
