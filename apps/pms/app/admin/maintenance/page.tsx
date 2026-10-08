import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminMember } from '@/lib/application/admin-session';
import { availableHotels, catalogService, hotelRepository, maintenanceIssueService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { MAINTENANCE_ISSUE_STATUSES, maintenanceIssueStatusSchema } from '@/lib/domain/maintenance-issue';
import type { MaintenanceIssueStatus } from '@/lib/domain/maintenance-issue';
import { getAdminT, getAdminLocale } from '@/lib/i18n/admin/server';
import { maintenanceCategoryKeys, maintenanceStatusKeys } from '@/lib/i18n/admin/maintenance';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lRoomNumber } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { FilterPills } from '@/components/admin/operations/filter-pills';
import { paginate, Pagination, tablePager } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { MaintenanceStatusBadge } from '@/components/admin/housekeeping/maintenance-status-badge';
import { MaintenanceReport } from '@/components/admin/housekeeping/maintenance-report';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('nav.maintenance')) };
}

export default async function MaintenancePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, member, selectedSlug, locale] = await Promise.all([
    searchParams, getAdminMember(), getSelectedHotelSlug(), getAdminLocale(),
  ]);
  if (!member) notFound();
  const slug = typeof query.hotel === 'string' ? query.hotel : selectedSlug;
  const option = availableHotels.find((hotel) => hotel.slug === slug);
  if (!option) notFound();
  const hotel = await catalogService.getHotel(option.slug);
  if (!(await maintenanceIssueService.canManageHotel(member, hotel.id))) notFound();
  const [issues, rooms] = await Promise.all([
    maintenanceIssueService.listForHotelier(hotel.id, member), hotelRepository.listPhysicalRooms(hotel.id),
  ]);
  const t = adminT(locale);
  const parsedStatus = maintenanceIssueStatusSchema.safeParse(query.status);
  const filter = parsedStatus.success ? parsedStatus.data : 'all';
  const filters: Array<'all' | MaintenanceIssueStatus> = ['all', ...MAINTENANCE_ISSUE_STATUSES];
  const visible = filter === 'all' ? issues : issues.filter((issue) => issue.status === filter);
  const pager = tablePager({ ...query, hotel: hotel.slug }, '/admin/maintenance');
  const { pageItems, page, totalPages } = paginate(visible, pager.page, pager.pageSize);
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: hotel.timezone });
  const hrefForStatus = (status: string) => {
    const params = new URLSearchParams({ hotel: hotel.slug });
    if (status !== 'all') params.set('status', status);
    return `/admin/maintenance?${params}`;
  };

  return <AdminPage>
    <AdminPageHeader title={t('nav.maintenance')} description={`${hotel.name} · ${t('maintenance.body')}`}
      actions={<MaintenanceReport key={hotel.id} hotelSlug={hotel.slug} memberKey={`${member.role}:${member.id}`}
        rooms={rooms.map(({ id, number }) => ({ id, number }))} />} />
    <div className="mt-4" data-tour="maintenance-filters">
      <FilterPills label={t('maintenance.filter')} sheetTitle={t('maintenance.filterTitle')}
        options={filters.map((status) => ({
          key: status,
          label: status === 'all' ? t('maintenance.all') : t(maintenanceStatusKeys[status]),
          count: status === 'all' ? issues.length : issues.filter((issue) => issue.status === status).length,
          href: hrefForStatus(status), current: filter === status,
        }))} />
    </div>
    {visible.length === 0 ? <section data-tour="maintenance-issues" className="mt-6 rounded-[18px] bg-card p-6 shadow-soft">
      <h2 className="text-display text-2xl">{t(issues.length === 0 ? 'maintenance.empty' : 'maintenance.noMatch')}</h2>
      {issues.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t('maintenance.emptyBody')}</p>
        : <Link href={hrefForStatus('all')} className={pill('secondary', 'mt-4')}>{t('maintenance.showAll')}</Link>}
    </section> : <div data-tour="maintenance-issues" className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
      <TableCard caption={t('nav.maintenance')} className="min-w-[70rem]" attached>
        <thead><tr className="border-b border-border">
          <Th className="w-28">{t('maintenance.photos')}</Th><Th>{t('maintenance.room')}</Th><Th>{t('maintenance.category')}</Th><Th>{t('maintenance.description')}</Th><Th>{t('maintenance.status')}</Th>
          <Th>{t('maintenance.reporter')}</Th><Th>{t('maintenance.created')}</Th>
        </tr></thead>
        <tbody>{pageItems.map((issue) => {
          const photo = issue.photos[0];
          const photoUrl = photo
            ? `/api/admin/maintenance-issues/${encodeURIComponent(issue.id)}/photos/${encodeURIComponent(photo.id)}?hotel=${encodeURIComponent(hotel.slug)}`
            : issue.demo ? issue.demoPhotoUrls?.[0] : null;
          return <tr key={issue.id} className="relative border-b border-border last:border-b-0 hover:bg-stone/50">
          <Td>{photoUrl ? <img src={photoUrl} alt={t('maintenance.photoAlt', { room: issue.roomNumber })}
            width={64} height={64} loading="lazy" className="admin-grid-photo" />
            : <span className="text-xs text-muted-foreground">{t('maintenance.noPhotos')}</span>}</Td>
          <Td><Link href={`/admin/maintenance/${encodeURIComponent(issue.id)}?hotel=${encodeURIComponent(hotel.slug)}`}
            className="font-semibold hover:text-accent-strong before:absolute before:inset-0 focus-visible:outline-2 focus-visible:outline-accent">
            {lRoomNumber(issue.roomNumber, locale)}
          </Link>{issue.demo ? <span className="mt-1 block text-xs text-muted-foreground">{t('maintenance.demo')}</span> : null}</Td>
          <Td>{t(maintenanceCategoryKeys[issue.category])}</Td>
          <Td className="max-w-sm"><p className="line-clamp-2 text-muted-foreground">{issue.description ?? '—'}</p></Td>
          <Td><MaintenanceStatusBadge status={issue.status} t={t} />{issue.replacement ? <p className="mt-1 text-xs text-muted-foreground">
            {t(issue.replacement.status === 'Pending' ? 'maintenance.replacementPending' : 'maintenance.replacementApproved')}
          </p> : null}</Td>
          <Td>{issue.reporterName}</Td><Td className="whitespace-nowrap text-muted-foreground">{formatter.format(new Date(issue.createdAt))}</Td>
        </tr>;
        })}</tbody>
      </TableCard>
      <Pagination page={page} totalPages={totalPages} total={visible.length} pageSize={pager.pageSize}
        hrefFor={pager.hrefFor} pageSizeHrefFor={pager.pageSizeHrefFor} attached />
    </div>}
  </AdminPage>;
}
