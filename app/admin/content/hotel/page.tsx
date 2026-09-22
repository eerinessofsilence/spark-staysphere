import type { Metadata } from 'next';
import { PhotoField } from '@/components/admin/content/photo-field';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { pluralForm } from '@/lib/i18n/plural';
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
  const points = (count: number) =>
    pluralForm(locale, count, {
      one: t('hotel.pointsOne', { count }),
      few: t('hotel.pointsFew', { count }),
      many: t('hotel.pointsMany', { count }),
      other: t('hotel.pointsMany', { count }),
    });

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
                value: 'photos',
                label: t('hotel.tabPhotos'),
                content: (
                  <div className="grid gap-6">
                    {hotel.areas.map((area) => (
                      <div
                        key={area.id}
                        role="group"
                        aria-labelledby={`area-${area.id}-heading`}
                        className={`${card} grid gap-5`}
                      >
                        <div>
                          <PhotoField name={`areas.${area.id}.photoUrl`} initial={area.photo.url} assets={assets} />
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('hotel.pointsHint', { points: points(area.hotspots.length) })}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <h3 id={`area-${area.id}-heading`} className="text-base font-medium">
                            {area.name}
                          </h3>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Field id={`area-${area.id}-name`} name={`areas.${area.id}.name`} label={t('hotel.name')}>
                              <TextInput
                                id={`area-${area.id}-name`}
                                name={`areas.${area.id}.name`}
                                defaultValue={area.name}
                                required
                              />
                            </Field>
                            <Field
                              id={`area-${area.id}-photoAlt`}
                              name={`areas.${area.id}.photoAlt`}
                              label={t('hotel.photoAlt')}
                            >
                              <TextInput
                                id={`area-${area.id}-photoAlt`}
                                name={`areas.${area.id}.photoAlt`}
                                defaultValue={area.photo.alt}
                                required
                              />
                            </Field>
                          </div>
                          <div className="mt-4">
                            <Field
                              id={`area-${area.id}-description`}
                              name={`areas.${area.id}.description`}
                              label={t('hotel.description')}
                              hint={t('hotel.plainText')}
                            >
                              <TextArea
                                id={`area-${area.id}-description`}
                                name={`areas.${area.id}.description`}
                                defaultValue={area.description}
                                required
                              />
                            </Field>
                          </div>

                          {area.hotspots.length > 0 ? (
                            <div className="mt-6 grid gap-3 border-t border-border pt-6">
                              <h4 className="text-sm font-medium">{t('hotel.pointsOnPhoto')}</h4>
                              {area.hotspots.map((hotspot) => {
                                const path = `areas.${area.id}.hotspots.${hotspot.id}`;
                                return (
                                  <details key={hotspot.id} className="group rounded-2xl border border-border">
                                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                                      <span id={`hotspot-${hotspot.id}-heading`}>{hotspot.label}</span>
                                      <ChevronDownIcon
                                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                                        aria-hidden="true"
                                      />
                                    </summary>
                                    <div
                                      role="group"
                                      aria-labelledby={`hotspot-${hotspot.id}-heading`}
                                      className="grid gap-3 px-4 pb-4"
                                    >
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <Field id={`hotspot-${hotspot.id}-label`} name={`${path}.label`} label={t('hotel.label')}>
                                          <TextInput
                                            id={`hotspot-${hotspot.id}-label`}
                                            name={`${path}.label`}
                                            defaultValue={hotspot.label}
                                            required
                                          />
                                        </Field>
                                        <Field id={`hotspot-${hotspot.id}-cta`} name={`${path}.cta`} label={t('hotel.buttonText')}>
                                          <TextInput
                                            id={`hotspot-${hotspot.id}-cta`}
                                            name={`${path}.cta`}
                                            defaultValue={hotspot.cta}
                                            required
                                          />
                                        </Field>
                                      </div>
                                      <Field
                                        id={`hotspot-${hotspot.id}-description`}
                                        name={`${path}.description`}
                                        label={t('hotel.description')}
                                      >
                                        <TextArea
                                          id={`hotspot-${hotspot.id}-description`}
                                          name={`${path}.description`}
                                          defaultValue={hotspot.description}
                                          required
                                        />
                                      </Field>
                                      {hotspot.roomSlug ? (
                                        <p className="text-xs text-muted-foreground">
                                          {t('hotel.buttonOpens', { path: `/rooms/${hotspot.roomSlug}` })}
                                        </p>
                                      ) : null}
                                    </div>
                                  </details>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
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
