import type { Metadata } from 'next';
import { contentService } from '@/lib/application/container';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { FrameManager } from './frame-manager';

export const metadata: Metadata = { title: 'Frames & key angles — 360 Orbit | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function SpinnerFramesPage() {
  const content = await contentService.getSpinnerMarkupContent();

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Content' }, { label: '360 Orbit', href: '/admin/content/spinner' }]}
        title="Frames & key angles"
        description="Upload the orbit's frames, then pick which ones a guest can stop on and where the spinner opens."
      />

      {!content ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No building spinner is configured for this hotel yet — there is nothing to upload frames for.
        </p>
      ) : (
        <FrameManager
          initialFrames={content.frames}
          initialFrameWidth={content.frameWidth}
          initialFrameHeight={content.frameHeight}
          initialKeyAngles={content.keyAngles}
          initialStartFrame={content.startFrame}
          version={content.version}
          zoneCount={content.zones.length}
          hotspotCount={content.hotspotCount}
        />
      )}
    </AdminPage>
  );
}
