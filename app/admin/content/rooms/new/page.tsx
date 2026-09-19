import type { Metadata } from 'next';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { BED_LABEL, VIEW_LABEL } from '@/lib/i18n/format';
import { ContentForm } from '@/components/admin/content/content-form';
import { Field, Select, TextArea, TextInput } from '@/components/admin/content/fields';
import { labelOptions } from '@/components/admin/content/label-options';
import { MediaListEditor } from '@/components/admin/content/media-list-editor';
import { NewRoomIdentityFields } from '@/components/admin/content/new-room-identity-fields';
import { OrderedStringList } from '@/components/admin/content/ordered-string-list';
import { RoomFacilitiesPicker } from '@/components/admin/content/room-facilities-picker';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createRoomAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('room.newTitle')) };
}

export const dynamic = 'force-dynamic';

export default async function NewRoomPage() {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const [assets, { hotel }] = await Promise.all([Promise.resolve(contentService.listMedia()), contentService.getHotelContent()]);

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.content') }, { label: t('rooms.title'), href: '/admin/content' }]}
        title={t('room.newTitle')}
        description={t('room.newDescription')}
      />

      <div className="mt-8 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm action={createRoomAction} initialVersion={0} submitLabel={t('room.createType')} dock>
          <div className="grid gap-6">
            <div role="group" aria-labelledby="identity-heading">
              <h2 id="identity-heading" className="text-base font-medium">
                {t('room.identity')}
              </h2>
              <div className="mt-4">
                <NewRoomIdentityFields />
              </div>
            </div>

            <div role="group" aria-labelledby="details-heading">
              <h2 id="details-heading" className="text-base font-medium">
                {t('room.details')}
              </h2>
              <div className="mt-4 grid gap-4">
                <Field
                  id="room-description"
                  name="description"
                  label={t('room.descriptionLabel')}
                  hint={t('room.descriptionHint')}
                >
                  <TextArea id="room-description" name="description" required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field id="room-areaM2" name="areaM2" label={t('room.size')}>
                    <TextInput id="room-areaM2" name="areaM2" type="number" min={1} step="0.1" required />
                  </Field>
                  <Field id="room-floor" name="floor" label={t('room.floor')}>
                    <TextInput id="room-floor" name="floor" type="number" min={0} step="1" required />
                  </Field>
                  <Field id="room-capacity" name="capacity" label={t('room.sleeps')}>
                    <TextInput id="room-capacity" name="capacity" type="number" min={1} step="1" required />
                  </Field>
                  <Field id="room-bedType" name="bedType" label={t('room.bed')}>
                    <Select id="room-bedType" name="bedType" defaultValue="king" required>
                      {labelOptions(BED_LABEL[locale])}
                    </Select>
                  </Field>
                </div>
                <Field id="room-view" name="view" label={t('room.view')}>
                  <Select id="room-view" name="view" defaultValue="sea" required className="sm:w-56">
                    {labelOptions(VIEW_LABEL[locale])}
                  </Select>
                </Field>
              </div>
            </div>

            <div role="group" aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className="text-base font-medium">
                {t('room.amenities')}
              </h2>
              <div className="mt-4">
                <OrderedStringList name="amenities" initial={[]} addPlaceholder={t('room.addAmenity')} itemNoun="amenity" />
              </div>
            </div>

            <div role="group" aria-labelledby="room-facilities-heading">
              <h2 id="room-facilities-heading" className="text-base font-medium">
                {t('room.facilities')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('room.facilitiesHint')}</p>
              <div className="mt-4">
                <RoomFacilitiesPicker name="facilities" facilities={hotel.facilities ?? []} initial={null} />
              </div>
            </div>

            <div role="group" aria-labelledby="media-heading">
              <h2 id="media-heading" className="text-base font-medium">
                {t('room.photos')}
              </h2>
              <div className="mt-4">
                <MediaListEditor name="media" initial={[]} assets={assets} />
              </div>
            </div>
          </div>
        </ContentForm>
      </div>
    </AdminPage>
  );
}
