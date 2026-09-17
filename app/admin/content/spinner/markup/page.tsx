import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { cn } from '@/lib/utils';
import { MarkupEditor } from './markup-editor';

export const metadata: Metadata = { title: 'Markup — 360 Orbit | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function SpinnerMarkupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
        breadcrumbs={[{ label: 'Content' }, { label: '360 Orbit', href: '/admin/content/spinner' }]}
        title="Markup"
        description="Draw the zones on each key-angle frame, then bind every zone to a room, a floor, a room type, or a link."
      />

      <nav aria-label="Key-angle frames" className="mt-6 -mx-1 flex gap-2 overflow-x-auto pb-1">
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
                <img src={frame.imageUrl} alt="" width={96} height={54} className="h-14 w-24 rounded-lg object-cover" />
              ) : (
                <span className="h-14 w-24 rounded-lg bg-stone" />
              )}
              <span className="text-xs font-medium text-foreground">Frame {angle}</span>
              <span className="text-[11px] text-muted-foreground">{zonesByFrame.get(angle) ?? 0} zones</span>
              {unresolved > 0 ? (
                <span aria-label={`${unresolved} unbound`} className="absolute top-1 right-1 size-2 rounded-full bg-[#dc2626]" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 h-[calc(100svh-14rem)] min-h-[480px]">
        <MarkupEditor
          frameIndex={frameIndex}
          image={image}
          initialZones={zonesForFrame}
          catalog={{ units: content.units, roomTypes: content.roomTypes }}
        />
      </div>
    </AdminPage>
  );
}
