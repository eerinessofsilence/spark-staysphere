import type { Metadata } from 'next';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { FrameManager } from './frame-manager';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, `${t('frames.title')} — ${t('nav.orbit')}`) };
}
export const dynamic = 'force-dynamic';

export default async function SpinnerFramesPage() {
  const t = adminT(await getAdminLocale());
  const content = await contentService.getSpinnerMarkupContent();

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.content') }, { label: t('nav.orbit'), href: '/admin/content/spinner' }]}
        title={t('frames.title')}
        description={t('frames.description')}
      />

      {!content ? (
        <p className="mt-8 text-sm text-muted-foreground">{t('frames.noSpinner')}</p>
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
