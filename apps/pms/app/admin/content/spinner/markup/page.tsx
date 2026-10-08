import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { pluralCount } from '@/lib/i18n/plural';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { MarkupEditor } from './markup-editor';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, `${t('markup.title')} — ${t('nav.orbit')}`) };
}
export const dynamic = 'force-dynamic';

export default async function SpinnerMarkupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const zoneForms = { one: t('zones.countOne'), few: t('zones.countFew'), many: t('zones.countMany'), other: t('zones.countOther') };
  const content = await contentService.getSpinnerMarkupContent();
  if (!content) notFound();

  const params = await searchParams;
  const rawFrame = Array.isArray(params.frame) ? params.frame[0] : params.frame;
  const requested = Number.parseInt(rawFrame ?? '', 10);
  const frameIndex = content.keyAngles.includes(requested) ? requested : content.keyAngles[0]!;
  // A zone can only ever be drawn on a key-angle frame — an explicit but
  // invalid `?frame=` redirects to the one this page actually shows, so the
  // address bar never disagrees with what's on screen.
  if (rawFrame !== undefined && requested !== frameIndex) {
    redirect(`/admin/content/spinner/markup?frame=${frameIndex}`);
  }

  const zonesByFrame = new Map<number, number>();
  const unresolvedByFrame = new Map<number, number>();
  for (const zone of content.zones) {
    zonesByFrame.set(zone.frameIndex, (zonesByFrame.get(zone.frameIndex) ?? 0) + 1);
    if (!zone.target) unresolvedByFrame.set(zone.frameIndex, (unresolvedByFrame.get(zone.frameIndex) ?? 0) + 1);
  }

  const image = {
    url: content.frames.find((frame) => frame.index === frameIndex)?.imageUrl ?? '',
    width: content.frameWidth,
    height: content.frameHeight,
  };
  const zonesForFrame = content.zones
    .filter((zone) => zone.frameIndex === frameIndex)
    .map((zone) => ({ id: zone.id, polygon: zone.polygon, target: zone.target }));

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.content') }, { label: t('nav.orbit'), href: '/admin/content/spinner' }]}
        title={t('markup.title')}
        actions={
          <Link href="/admin/content/spinner/frames" className={pill('secondary')}>
            {t('orbit.framesLink')}
          </Link>
        }
      />

      <nav aria-label={t('orbit.keyAngleFrames')} className="mt-6 -mx-1 flex gap-2 overflow-x-auto pb-1">
        {content.keyAngles.map((angle) => {
          const frame = content.frames.find((candidate) => candidate.index === angle);
          const active = angle === frameIndex;
          const unresolved = unresolvedByFrame.get(angle) ?? 0;
          return (
            <Link
              key={angle}
              href={`/admin/content/spinner/markup?frame=${angle}`}
              className={cn(
                'relative flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border p-1.5 transition-colors',
                active ? 'border-primary bg-tint-clay' : 'border-border hover:bg-stone',
              )}
            >
              {frame ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frame.imageUrl} alt="" width={64} height={64} className="admin-grid-photo" />
              ) : (
                <span className="admin-grid-photo bg-stone" />
              )}
              <span className="text-xs font-medium text-foreground">{t('frames.frameN', { n: angle })}</span>
              <span className="text-[11px] text-muted-foreground">
                {pluralCount(locale, zonesByFrame.get(angle) ?? 0, zoneForms)}
              </span>
              {unresolved > 0 ? (
                <span
                  aria-label={t('markup.unbound', { count: unresolved })}
                  className="absolute top-1 right-1 size-2 rounded-full bg-[#dc2626]"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* The editor takes the frame's own shape, so the photograph fills it
          edge to edge: sized any other way the canvas letterboxes, and a
          cover-crop would put the zones near the edges out of reach. */}
      <div className="mt-4 w-full min-h-[480px]" style={{ aspectRatio: `${content.frameWidth} / ${content.frameHeight}` }}>
        <MarkupEditor
          frameIndex={frameIndex}
          image={image}
          initialZones={zonesForFrame}
          catalog={{ units: content.units, roomTypes: content.roomTypes }}
          frames={content.frames}
          keyAngles={content.keyAngles}
        />
      </div>
    </AdminPage>
  );
}
