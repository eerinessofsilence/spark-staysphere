import type { Metadata } from 'next';
import Link from 'next/link';
import { contentService } from '@/lib/application/container';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { pill } from '@/lib/ui';

export const metadata: Metadata = { title: '360 Orbit | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function SpinnerContentPage() {
  const content = await contentService.getSpinnerMarkupContent();

  if (!content) {
    return (
      <AdminPage width="narrow">
        <AdminPageHeader
          title="360 Orbit"
          description="No building spinner is configured for this hotel yet — there is nothing to mark up."
        />
      </AdminPage>
    );
  }

  const referencedUnits = new Set(
    content.zones.flatMap((zone) => (zone.target?.kind === 'unit' ? [zone.target.unitId] : [])),
  );
  const referencedRoomTypes = new Set(
    content.zones.flatMap((zone) => (zone.target?.kind === 'roomType' ? [zone.target.roomTypeId] : [])),
  );
  const unbound = content.zones.filter((zone) => !zone.target);
  const uncoveredUnits = content.units.filter((unit) => !referencedUnits.has(unit.id));
  const uncoveredRoomTypes = content.roomTypes.filter((room) => !room.hidden && !referencedRoomTypes.has(room.id));

  const zonesByFrame = new Map<number, number>();
  for (const zone of content.zones) zonesByFrame.set(zone.frameIndex, (zonesByFrame.get(zone.frameIndex) ?? 0) + 1);

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="360 Orbit"
        description="The building spinner on the arrival screen: its key-angle frames, and the zones drawn on them."
        actions={
          <div className="flex gap-3">
            <Link href="/admin/content/spinner/frames" className={pill('secondary')}>
              Frames & key angles
            </Link>
            <Link href="/admin/content/spinner/markup" className={pill('primary')}>
              Open markup
            </Link>
          </div>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <h2 className="font-medium">Key-angle frames</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The building can only carry a zone on one of these {content.keyAngles.length} frames — the ones a guest actually
            stops on.
          </p>
          <ul className="mt-4 flex flex-wrap gap-3">
            {content.keyAngles.map((angle) => {
              const frame = content.frames.find((candidate) => candidate.index === angle);
              return (
                <li key={angle}>
                  <Link
                    href={`/admin/content/spinner/markup?frame=${angle}`}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-border p-1.5 transition-colors hover:bg-stone"
                  >
                    {frame ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={frame.imageUrl} alt="" width={112} height={63} className="h-16 w-28 rounded-lg object-cover" />
                    ) : (
                      <span className="h-16 w-28 rounded-lg bg-stone" />
                    )}
                    <span className="text-xs font-medium">Frame {angle}</span>
                    <span className="text-[11px] text-muted-foreground">{zonesByFrame.get(angle) ?? 0} zones</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <h2 className="font-medium">Coverage</h2>
          <p className="mt-1 text-sm text-muted-foreground">What still has no zone pointing at it, or a zone nobody has bound yet.</p>

          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Unbound zones</dt>
              <dd className="font-medium">{unbound.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Rooms with no zone</dt>
              <dd className="font-medium">
                {uncoveredUnits.length} / {content.units.length}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Room types with no zone</dt>
              <dd className="font-medium">
                {uncoveredRoomTypes.length} / {content.roomTypes.filter((room) => !room.hidden).length}
              </dd>
            </div>
          </dl>

          {uncoveredRoomTypes.length > 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Not covered: {uncoveredRoomTypes.map((room) => room.name).join(', ')}
            </p>
          ) : null}
        </div>
      </div>
    </AdminPage>
  );
}
