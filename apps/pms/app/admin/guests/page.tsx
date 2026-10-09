import type { Metadata } from 'next';
import Link from 'next/link';
import { MagnifyingGlass, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { buildGuestDirectory, searchGuestDirectory } from '@/lib/application/guest-directory';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lMoney, lNights } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { CreateGuestButton } from '@/components/admin/operations/create-guest-button';
import { SearchInput } from '@/components/ui/search-input';
import { ImportGuestsButton } from '@/components/admin/operations/import-guests-button';
import { GuestRowActions, GuestTableRow } from '@/components/admin/operations/guest-row-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.guests')) };
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : '';
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const locale = await getAdminLocale();
  const t = adminT(locale);

  const [hotel, allBookings] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    hotelRepository.listBookings(),
  ]);
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const profiles = await hotelRepository.listGuestProfiles(hotel.id);
  const directory = buildGuestDirectory(bookings, profiles, hotel.currency);
  const visible = searchGuestDirectory(directory, query);
  const { pageItems, page: currentPage, totalPages } = paginate(visible, page, pageSize);

  function hrefFor(next: { q?: string; page?: number; pageSize?: number }): string {
    const params = new URLSearchParams();
    const nextQuery = next.q ?? query;
    const nextPage = next.page ?? 1;
    const nextPageSize = next.pageSize ?? pageSize;
    if (nextQuery) params.set('q', nextQuery);
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextPageSize !== PAGE_SIZE) params.set('pageSize', String(nextPageSize));
    const qs = params.toString();
    return qs ? `/admin/guests?${qs}` : '/admin/guests';
  }

  return (
    <AdminPage>
      <AdminPageHeader title={t('nav.guests')} actions={<div className="flex flex-wrap gap-2"><ImportGuestsButton hotelSlug={hotel.slug} /><CreateGuestButton /></div>} />

      <form role="search" action="/admin/guests" method="get" className="mt-2 flex gap-2">
        <label htmlFor="guests-search" className="sr-only">
          {t('guests.searchLabel')}
        </label>
        <SearchInput
          id="guests-search"
          name="q"
          defaultValue={query}
          suggestions={directory.map((guest) => ({ value: `${guest.firstName} ${guest.lastName}`, label: `${guest.firstName} ${guest.lastName}`, detail: guest.email || guest.phone }))}
          suggestionsLabel={t('guests.searchLabel')}
          placeholder={t('guests.searchPlaceholder')}
          wrapperClassName="w-full sm:w-80"
        />
        <button type="submit" className={pill('primary')}>
          {t('ops.search')}
        </button>
      </form>

      <div className="mt-6">
        {directory.length === 0 ? (
          <EmptyState title={t('guests.emptyTitle')} body={t('guests.emptyBody')} search={false} />
        ) : pageItems.length === 0 ? (
          <EmptyState title={t('guests.noMatchTitle')} body={t('guests.noMatchQuery', { query })} search />
        ) : (
          <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('guests.tableCaption')} className="min-w-[52rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('guests.thGuest')}</Th>
                  <Th>{t('guests.thPhone')}</Th>
                  <Th className="text-right">{t('guests.thBookings')}</Th>
                  <Th className="text-right">{t('guests.thSpent')}</Th>
                  <Th className="text-right">{t('guests.thNights')}</Th>
                  <Th>{t('guests.thLastStay')}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((guest) => (
                  <GuestTableRow key={guest.id} id={guest.id} hotelId={hotel.id}>
                    <Td className="whitespace-nowrap">
                      {/* Stretched: the row opens the guest's own page from anywhere in it. */}
                      <Link
                        href={`/admin/guests/${encodeURIComponent(guest.id)}`}
                        className="text-display text-base hover:text-accent-strong before:absolute before:inset-0"
                      >
                        {guest.firstName} {guest.lastName}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{guest.email}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{guest.phone}</Td>
                    <Td className="text-right tabular-nums">
                      {guest.bookingsCount}
                      {guest.cancelledCount > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          {t('guests.cancelledCount', { count: guest.cancelledCount })}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{lMoney(guest.totalSpent, guest.currency, locale)}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{lNights(guest.nights, locale)}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {guest.lastCheckIn ? lDate(guest.lastCheckIn, locale) : t('guests.neverStayed')}
                    </Td>
                    <Td className="relative text-right"><GuestRowActions id={guest.id} hotelId={hotel.id} name={`${guest.firstName} ${guest.lastName}`} canDelete /></Td>
                  </GuestTableRow>
                ))}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={visible.length}
              pageSize={pageSize}
              hrefFor={(next) => hrefFor({ page: next })}
              pageSizeHrefFor={(size) => hrefFor({ pageSize: size, page: 1 })}
            />
          </div>
        )}
      </div>
    </AdminPage>
  );
}

function EmptyState({ title, body, search }: { title: string; body: string; search: boolean }) {
  const Icon = search ? MagnifyingGlass : UsersThree;
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
        <Icon weight="fill" className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-display text-2xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
      {!search ? <CreateGuestButton /> : null}
    </div>
  );
}
