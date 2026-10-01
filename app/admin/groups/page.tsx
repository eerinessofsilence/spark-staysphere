import type { Metadata } from 'next';
import Link from 'next/link';
import { MagnifyingGlass, UsersFour } from '@phosphor-icons/react/dist/ssr';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { searchGroups, summarizeGroup } from '@/lib/application/group-directory';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { SearchInput } from '@/components/ui/search-input';
import { CreateGroupButton } from '@/components/admin/operations/create-group-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.groups')) };
}

export default async function GroupsPage({
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

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const [groups, allBookings] = await Promise.all([
    hotelRepository.listBookingGroups(hotel.id),
    hotelRepository.listBookings(),
  ]);
  const visibleGroups = searchGroups(groups, query);
  const summaries = visibleGroups.map((group) => summarizeGroup(group, allBookings));
  const { pageItems, page: currentPage, totalPages } = paginate(summaries, page, pageSize);

  function hrefFor(next: { q?: string; page?: number; pageSize?: number }): string {
    const params = new URLSearchParams();
    const nextQuery = next.q ?? query;
    const nextPage = next.page ?? 1;
    const nextPageSize = next.pageSize ?? pageSize;
    if (nextQuery) params.set('q', nextQuery);
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextPageSize !== PAGE_SIZE) params.set('pageSize', String(nextPageSize));
    const qs = params.toString();
    return qs ? `/admin/groups?${qs}` : '/admin/groups';
  }

  return (
    <AdminPage>
      <AdminPageHeader title={t('nav.groups')} actions={<CreateGroupButton />} />

      <form role="search" action="/admin/groups" method="get" className="mt-2 flex gap-2">
        <label htmlFor="groups-search" className="sr-only">
          {t('groups.searchLabel')}
        </label>
        <SearchInput
          id="groups-search"
          name="q"
          defaultValue={query}
          placeholder={t('groups.searchPlaceholder')}
          wrapperClassName="w-full sm:w-80"
        />
        <button type="submit" className={pill('primary')}>
          {t('ops.search')}
        </button>
      </form>

      <div className="mt-6">
        {groups.length === 0 ? (
          <EmptyState title={t('groups.emptyTitle')} body={t('groups.emptyBody')} search={false} />
        ) : pageItems.length === 0 ? (
          <EmptyState title={t('groups.noMatchTitle')} body={t('groups.noMatchQuery', { query })} search />
        ) : (
          <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('groups.tableCaption')} className="min-w-[48rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('groups.thName')}</Th>
                  <Th className="text-right">{t('guests.thBookings')}</Th>
                  <Th className="text-right">{t('groups.thAmount')}</Th>
                  <Th>{t('groups.thCreated')}</Th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(({ group, bookingsCount, cancelledCount, amount }) => (
                  <tr key={group.id} className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50">
                    <Td className="whitespace-nowrap">
                      <Link href={`/admin/groups/${group.id}`} className="text-display text-base hover:text-accent-strong before:absolute before:inset-0">
                        {group.name}
                      </Link>
                      {group.notes ? <span className="block max-w-xs truncate text-xs text-muted-foreground">{group.notes}</span> : null}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {bookingsCount}
                      {cancelledCount > 0 ? (
                        <span className="block text-xs text-muted-foreground">{t('guests.cancelledCount', { count: cancelledCount })}</span>
                      ) : null}
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{lMoney(amount, hotel.currency, locale)}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{lDate(group.createdAt.slice(0, 10), locale)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={summaries.length}
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
  const Icon = search ? MagnifyingGlass : UsersFour;
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
        <Icon weight="fill" className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-display text-2xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
      {!search ? <CreateGroupButton /> : null}
    </div>
  );
}
