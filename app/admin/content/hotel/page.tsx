import type { Metadata } from 'next';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { FacilitiesEditor } from '@/components/admin/content/facilities-editor';
import { Field, Select, TextArea, TextInput } from '@/components/admin/content/fields';
import { HotelSettingsTabs } from '@/components/admin/content/hotel-settings-tabs';
import { PhotoListEditor } from '@/components/admin/content/photo-list-editor';
import { StarRatingField } from '@/components/admin/content/star-rating-field';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { updateHotelAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.hotelSettings')) };
}

export const dynamic = 'force-dynamic';

const card = 'rounded-[18px] bg-card p-5 shadow-soft sm:p-6';

export default async function HotelContentPage() {
  const [{ hotel, version }, assets, locale] = await Promise.all([
    contentService.getHotelContent(),
    contentService.listMedia(),
    getAdminLocale(),
  ]);
  const t = adminT(locale);

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title={t('nav.hotelSettings')}
        actions={
          <a href="/" target="_blank" rel="noreferrer" className={pill('secondary')}>
            {t('hotel.preview')}
            <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <div className="mt-8">
        <ContentForm
          action={updateHotelAction}
          initialVersion={version}
          submitLabel={t('hotel.save')}
          versionKey="hotel"
          dock
        >
          <HotelSettingsTabs
            tabs={[
              {
                value: 'details',
                label: t('hotel.tabDetails'),
                content: (
                  <div className={card}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field id="hotel-name" name="name" label={t('hotel.name')}>
                        <TextInput id="hotel-name" name="name" defaultValue={hotel.name} required />
                      </Field>
                      <Field id="hotel-tagline" name="tagline" label={t('hotel.tagline')}>
                        <TextInput id="hotel-tagline" name="tagline" defaultValue={hotel.tagline} required />
                      </Field>
                      <Field id="hotel-location" name="location" label={t('hotel.location')}>
                        <TextInput id="hotel-location" name="location" defaultValue={hotel.location} required />
                      </Field>
                      <Field id="hotel-starRating" name="starRating" label={t('hotel.starRating')}>
                        <StarRatingField id="hotel-starRating" name="starRating" defaultValue={hotel.starRating} />
                      </Field>
                      <Field id="hotel-currency" name="currency" label={t('hotel.currency')}>
                        <Select id="hotel-currency" name="currency" defaultValue={hotel.currency}>
                          <option value="EUR">{t('hotel.currencyEur')}</option>
                          <option value="USD">{t('hotel.currencyUsd')}</option>
                        </Select>
                      </Field>
                    </div>

                    {/* The "About" section on the arrival page — the one paragraph and
                        photograph below the building, the guest-facing counterpart to
                        a room's own description and gallery. */}
                    <div role="group" aria-labelledby="hotel-about-heading" className="mt-8">
                      <h3 id="hotel-about-heading" className="text-base font-medium">
                        {t('hotel.about')}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t('hotel.aboutBody')}</p>
                      <div className="mt-4 grid gap-4">
                        <Field
                          id="hotel-description"
                          name="description"
                          label={t('hotel.description')}
                          hint={t('hotel.plainText')}
                        >
                          <TextArea
                            id="hotel-description"
                            name="description"
                            defaultValue={hotel.description}
                            required
                          />
                        </Field>
                        <div>
                          <p className="mb-1.5 block text-sm text-muted-foreground">{t('hotel.tabPhotos')}</p>
                          <input type="hidden" name="aboutPhoto" value={hotel.aboutPhoto.url} />
                          <PhotoListEditor name="aboutPhotos" initial={(hotel.aboutPhotos ?? [hotel.aboutPhoto]).map((photo) => photo.url)} assets={assets} />
                        </div>
                      </div>
                    </div>

                    <p className="mt-8 text-xs text-muted-foreground">
                      {t('hotel.onboardingNote', { timezone: hotel.timezone })}
                    </p>
                  </div>
                ),
              },
              {
                value: 'facilities',
                label: t('hotel.tabFacilities'),
                content: (
                  <div role="group" aria-labelledby="hotel-facilities-heading" className={card}>
                    <h3 id="hotel-facilities-heading" className="text-base font-medium">
                      {t('hotel.facilities')}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t('hotel.facilitiesBody')}</p>
                    <div className="mt-4">
                      <FacilitiesEditor name="facilities" initial={hotel.facilities ?? []} />
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </ContentForm>
      </div>
    </AdminPage>
  );
}
