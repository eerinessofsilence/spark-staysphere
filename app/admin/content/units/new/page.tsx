import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lFloor } from '@/lib/i18n/format';
import { ContentForm } from '@/components/admin/content/content-form';
import { NewPhysicalRoomFields } from '@/components/admin/content/new-physical-room-fields';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createPhysicalRoomAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('units.newRoom')) };
}

export const dynamic = 'force-dynamic';

export default async function NewPhysicalRoomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, locale] = await Promise.all([searchParams, getAdminLocale()]);
  const t = adminT(locale);
  const requested = Array.isArray(params.type) ? params.type[0] : params.type;
  const [types, suggestions] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.suggestRoomNumbers(),
  ]);
  // A room can't exist without a type; the Rooms page sends a hotel with none to create one first.
  if (types.length === 0) redirect('/admin/content/units');
  const initialTypeId = types.find((type) => type.id === requested)?.id ?? types[0]!.id;

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.content') }, { label: t('nav.rooms'), href: '/admin/content/units' }]}
        title={t('units.newRoom')}
      />

      <div className="mt-8 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm action={createPhysicalRoomAction} initialVersion={0} submitLabel={t('units.createRoom')} dock>
          <NewPhysicalRoomFields
            initialTypeId={initialTypeId}
            types={types.map((type) => ({
              id: type.id,
              label: t(type.hidden ? 'units.typeOptionHidden' : 'units.typeOption', {
                name: type.name,
                floor: lFloor(type.floor, locale),
              }),
              suggestion: suggestions[type.id] ?? '',
            }))}
          />
        </ContentForm>
      </div>
    </AdminPage>
  );
}
