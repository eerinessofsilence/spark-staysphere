'use client';

import * as React from 'react';
import Link from 'next/link';
import type { GuestDocument } from '@/lib/domain/guest-document';
import { Modal } from '@/components/site/modal';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateRange } from '@/lib/i18n/format';
import { pill, tag } from '@/lib/ui';
import { CLIENT_PAGE_SIZE, ClientPagination, paginateClient } from './client-pagination';

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
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(CLIENT_PAGE_SIZE);
  const open = documents.find((document) => document.id === openId) ?? null;
  const { pageItems, page: currentPage, totalPages } = paginateClient(documents, page, pageSize);

  return (
    <>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pageItems.map((document) => (
          <li key={document.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpenId(document.id)}
              aria-label={t('documents.open', { name: document.guestName })}
              className="group block w-full cursor-pointer rounded-[18px] bg-card p-2 text-left shadow-soft transition-colors hover:bg-stone/40"
            >
              <span className="relative block aspect-[3/2] overflow-hidden rounded-[14px] bg-stone">
                {document.status === 'active' ? (
                  <img
                    src={imageUrl(document.id)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
                    {document.status === 'deleted'
                      ? t('documents.imageDeleted')
                      : document.status === 'pending_deletion'
                        ? t('documents.imagePendingDeletion')
                        : t('documents.imageUploading')}
                  </span>
                )}
              </span>
              <span className="block px-2 pt-2.5 pb-1.5">
                <span className="block truncate text-sm font-medium">{document.guestName}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {document.identity.documentType === 'passport' ? t('documents.passport') : t('documents.idCard')}
                  {' · '}
                  {document.identity.documentNumber}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {document.identity.dateOfBirth || '—'}
                  {' · '}
                  {document.identity.nationality || document.identity.issuingCountry || '—'}
                </span>
                {document.checkIn && document.checkOut ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {lDateRange(document.checkIn, document.checkOut, locale)}
                  </span>
                ) : null}
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <span className={tag()}>{statusLabel(document.status, t)}</span>
                  {document.status === 'active' ? <span className={tag('text-muted-foreground')}>{t('documents.photoUntilCheckout')}</span> : null}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ClientPagination
        page={currentPage}
        totalPages={totalPages}
        total={documents.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <Modal
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? (open.identity.documentType === 'passport' ? t('documents.passport') : t('documents.idCard')) : ''}
        className="sm:max-w-2xl"
      >
        {open ? (
          <div className="grid gap-5">
            {open.status === 'active' ? (
              <img
                src={imageUrl(open.id)}
                alt=""
                className="max-h-[50vh] w-full rounded-[14px] bg-stone object-contain"
              />
            ) : (
              <p className="rounded-[14px] bg-stone p-6 text-center text-sm text-muted-foreground">
                {open.status === 'deleted'
                  ? t('documents.imageDeleted')
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

            <div className="flex justify-end">
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
