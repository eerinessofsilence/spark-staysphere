import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { MaintenanceIssueActions } from '@/components/admin/housekeeping/maintenance-issue-actions';
import { MaintenancePhotoUpload } from '@/components/admin/housekeeping/maintenance-photo-upload';
import { MaintenancePhotoRemove } from '@/components/admin/housekeeping/maintenance-photo-remove';
import { MaintenanceStatusBadge } from '@/components/admin/housekeeping/maintenance-status-badge';
import { MaintenanceTour } from '@/components/admin/onboarding/maintenance-tour';
import { PanoramaViewer } from '@/components/view-360';
import { availableHotels, catalogService, maintenanceIssueService } from '@/lib/application/container';
import { getAdminMember } from '@/lib/application/admin-session';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { maintenanceCategoryKeys } from '@/lib/i18n/admin/maintenance';
import { lRoomNumber } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ issueId: string }> }): Promise<Metadata> {
  const [{ issueId }, locale] = await Promise.all([params, getAdminLocale()]);
  const t = adminT(locale);
  return { title: adminPageTitle(t, `${t('nav.maintenance')} ${issueId}`) };
}

export default async function MaintenanceIssuePage({ params, searchParams }: {
  params: Promise<{ issueId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ issueId }, query, member] = await Promise.all([params, searchParams, getAdminMember()]);
  if (!member) notFound();
  const requestedSlug = typeof query.hotel === 'string' ? query.hotel : '';
  const candidateHotels = availableHotels.filter((hotel) =>
    (member.role === 'Owner' || member.hotelIds?.includes(hotel.id)) && (!requestedSlug || hotel.slug === requestedSlug));
  for (const hotelOption of candidateHotels) {
    const hotel = await catalogService.getHotel(hotelOption.slug);
    const issue = await maintenanceIssueService.getForHotelier(hotel.id, issueId, member);
    if (!issue) continue;
    const locale = await getAdminLocale();
    const t = adminT(locale);
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: hotel.timezone });
    const demoPhotoUrls = issue.demo ? issue.demoPhotoUrls ?? [] : [];
    const photoLinks = [
      ...issue.photos.map((photo) => ({ id: photo.id,
        view: photo.view,
        href: `/api/admin/maintenance-issues/${encodeURIComponent(issue.id)}/photos/${encodeURIComponent(photo.id)}?hotel=${encodeURIComponent(hotelOption.slug)}` })),
      ...demoPhotoUrls.map((href) => ({ id: href, href, view: 'photo' as const })),
    ];
    return <AdminPage width="narrow">
      <AdminPageHeader breadcrumbs={[{ label: t('nav.maintenance'), href: `/admin/maintenance?hotel=${encodeURIComponent(hotelOption.slug)}` }]}
        title={lRoomNumber(issue.roomNumber, locale)} description={`${hotel.name} · ${t(maintenanceCategoryKeys[issue.category])}`} />
      <MaintenanceTour memberKey={`${member.role}:${member.id}`} detail />
      <div className="mt-6 grid gap-5">
        <section className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Info label={t('maintenance.category')} value={t(maintenanceCategoryKeys[issue.category])} />
            <div><dt className="text-xs text-muted-foreground">{t('maintenance.status')}</dt>
              <dd className="mt-1"><MaintenanceStatusBadge status={issue.status} t={t} /></dd></div>
            <Info label={t('maintenance.reporter')} value={issue.reporterName} />
            <Info label={t('maintenance.created')} value={formatter.format(new Date(issue.createdAt))} />
          </dl>
          {issue.description ? <div className="mt-5 border-t border-border pt-4"><p className="text-xs text-muted-foreground">{t('maintenance.description')}</p><p className="mt-1 whitespace-pre-wrap text-sm">{issue.description}</p></div> : null}
          <div data-tour="maintenance-evidence" className="mt-6">
          <h2 className="text-sm font-medium">{t('maintenance.photos')}</h2>
          {issue.demo ? <p className="mt-2 text-sm text-muted-foreground">{t(demoPhotoUrls.length > 0 ? 'maintenance.demoPhotoBody' : 'maintenance.demoBody')}</p> : null}
          {photoLinks.length > 0 ? <div className={`mt-3 grid gap-3 ${photoLinks.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {photoLinks.map((photo, index) => <div key={photo.id} className={photo.view === '360' && photoLinks.length > 1 ? 'sm:col-span-2' : undefined}>
              {photo.view === '360' ? <>
              <p className="mb-2 text-sm text-muted-foreground">{t('maintenance.view360')}</p>
              <PanoramaViewer src={photo.href} title={t('maintenance.photoAlt', { room: issue.roomNumber })}
                className="relative aspect-video w-full overflow-hidden bg-stone" />
              </> : <a href={photo.href} target="_blank" rel="noreferrer"
              className="relative block aspect-video w-full overflow-hidden bg-stone focus-visible:outline-2 focus-visible:outline-accent">
              <img src={photo.href} alt={t('maintenance.photoAlt', { room: issue.roomNumber })}
                width={600} height={600} loading="lazy" className="absolute inset-0 size-full object-contain" />
            </a>}
              {index < issue.photos.length ? <MaintenancePhotoRemove href={photo.href} number={index + 1} /> : null}
            </div>)}
          </div> : null}
          <MaintenancePhotoUpload issueId={issue.id} hotelSlug={hotelOption.slug} roomNumber={issue.roomNumber} photoCount={issue.photos.length} />
          </div>
          <MaintenanceIssueActions issueId={issue.id} hotelSlug={hotelOption.slug} status={issue.status}
            replacement={issue.replacement} canApproveReplacement={member.role === 'Hotelier'} timezone={hotel.timezone} />
        </section>
        <section data-tour="maintenance-availability" className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <h2 className="text-lg font-medium">{t('maintenance.availability')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('maintenance.availabilityBody')}</p>
          <Link href={`/admin/housekeeping/${encodeURIComponent(issue.unitId)}?hotel=${encodeURIComponent(hotelOption.slug)}`} className={pill('secondary', 'mt-4')}>{t('maintenance.openRoom')}</Link>
        </section>
      </div>
    </AdminPage>;
  }
  notFound();
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}
