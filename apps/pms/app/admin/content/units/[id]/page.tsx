import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TableCellsIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { facadeOf } from '@/lib/domain/room-units';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lFacade, lFloor, lRoomNumber } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { DeleteEntityButton } from '@/components/admin/content/delete-entity-button';
import { Field, Select, TextInput } from '@/components/admin/content/fields';
import { MediaListEditor } from '@/components/admin/content/media-list-editor';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deletePhysicalRoomAction, updatePhysicalRoomAction } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, locale] = await Promise.all([params, getAdminLocale()]);
  const room = await contentService.getPhysicalRoomContent(id);
  return { title: adminPageTitle(adminT(locale), room ? lRoomNumber(room.number, locale) : id) };
}

export const dynamic = 'force-dynamic';

export default async function PhysicalRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale] = await Promise.all([params, getAdminLocale()]);
  const t = adminT(locale);
  const room = await contentService.getPhysicalRoomContent(id);
  if (!room) notFound();

  const [type, types, assets] = await Promise.all([
    contentService.getRoomContent(room.roomTypeId),
    contentService.listRoomsContent(),
    contentService.listMedia(),
  ]);
  const seed = contentService.isSeedEntry('unit', room.id);
  const backHref = `/admin/content/units#type-${room.roomTypeId}`;
  const side = type ? lFacade(facadeOf(type.view), locale) : null;
  const title = lRoomNumber(room.number, locale);

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.content') }, { label: t('nav.rooms'), href: backHref }]}
        title={title}
        description={[type?.name ?? room.roomTypeId, lFloor(room.floor, locale), side].filter(Boolean).join(' · ')}
      />

      <div className="mt-8 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm
          action={updatePhysicalRoomAction.bind(null, room.id)}
          initialVersion={room.version}
          submitLabel={t('unit.saveRoom')}
          dock
          extraActions={
            seed ? (
              <p className="text-sm text-muted-foreground">{t('unit.seedNote')}</p>
            ) : (
              <DeleteEntityButton
                id={room.id}
                label={title}
                confirmMessage={t('unit.confirmRemove', { number: room.number, type: type?.name ?? t('unit.itsRoomType') })}
                action={deletePhysicalRoomAction}
                redirectTo={backHref}
              />
            )
          }
        >
          <Field id="unit-number" name="number" label={t('unit.number')} hint={t('unit.numberHint')}>
            <TextInput
              id="unit-number"
              name="number"
              defaultValue={room.number}
              required
              autoComplete="off"
              spellCheck={false}
              maxLength={4}
              className="uppercase sm:w-40"
            />
          </Field>

          <Field id="unit-roomTypeId" name="roomTypeId" label={t('unit.roomType')} hint={t('unit.keepsType')}>
            <Select id="unit-roomTypeId" name="roomTypeId" defaultValue={room.roomTypeId} required>
              {types.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {t(candidate.hidden ? 'units.typeOptionHidden' : 'units.typeOption', {
                    name: candidate.name,
                    floor: lFloor(candidate.floor, locale),
                  })}
                </option>
              ))}
            </Select>
          </Field>

          <dl className="mt-6 grid gap-4 border-t border-border pt-6 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{t('unit.side')}</dt>
              <dd className="mt-0.5 font-medium">{side ?? '—'}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">{t('unit.sideHint')}</dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-border pt-6" id="unit-media">
            <div role="group" aria-labelledby="unit-media-heading">
              <h2 id="unit-media-heading" className="text-base font-medium">
                {t('unit.photos')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('unit.photosHint')}</p>
              <div className="mt-4">
                <MediaListEditor
                  name="media"
                  initial={(room.media ?? []).map((item) => ({
                    type: item.type === '360' ? '360' : 'image',
                    url: item.url,
                    label: item.label,
                  }))}
                  assets={assets}
                  suggestedFolder={type ? `rooms/${type.slug}` : undefined}
                />
              </div>
            </div>
          </div>
        </ContentForm>
      </div>

      <Link href={`/admin/front-desk?type=${room.roomTypeId}`} className={pill('ghost', 'mt-4')}>
        <TableCellsIcon className="size-4" aria-hidden="true" />
        {t('unit.seeOnFrontDesk')}
      </Link>
    </AdminPage>
  );
}
