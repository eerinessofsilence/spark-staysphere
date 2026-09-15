import type { Metadata } from 'next';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { FacilitiesEditor } from '@/components/admin/content/facilities-editor';
import { Field, TextArea, TextInput } from '@/components/admin/content/fields';
import { HotelSettingsTabs } from '@/components/admin/content/hotel-settings-tabs';
import { PhotoField } from '@/components/admin/content/photo-field';
import { StarRatingField } from '@/components/admin/content/star-rating-field';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { updateHotelAction } from './actions';

export const metadata: Metadata = {
  title: 'Hotel Settings — Hotel admin | SPARK StaySphere 360',
};

export const dynamic = 'force-dynamic';

const card = 'rounded-[28px] bg-card p-5 shadow-soft sm:p-6';

export default async function HotelContentPage() {
  const [{ hotel, version }, assets] = await Promise.all([
    contentService.getHotelContent(),
    contentService.listMedia(),
  ]);

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Hotel Settings"
        actions={
          <a href="/" target="_blank" rel="noreferrer" className={pill('secondary')}>
            Preview
            <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <div className="mt-8">
        <ContentForm
          action={updateHotelAction}
          initialVersion={version}
          submitLabel="Save hotel details"
          versionKey="hotel"
          dock
        >
          <HotelSettingsTabs
            tabs={[
              {
                value: 'details',
                label: 'Details',
                content: (
                  <div className={card}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field id="hotel-name" name="name" label="Name">
                        <TextInput id="hotel-name" name="name" defaultValue={hotel.name} required />
                      </Field>
                      <Field id="hotel-tagline" name="tagline" label="Tagline">
                        <TextInput id="hotel-tagline" name="tagline" defaultValue={hotel.tagline} required />
                      </Field>
                      <Field id="hotel-location" name="location" label="Location">
                        <TextInput id="hotel-location" name="location" defaultValue={hotel.location} required />
                      </Field>
                      <Field id="hotel-starRating" name="starRating" label="Star rating">
                        <StarRatingField id="hotel-starRating" name="starRating" defaultValue={hotel.starRating} />
                      </Field>
                    </div>

                    {/* The "About" section on the arrival page — the one paragraph and
                        photograph below the building, the guest-facing counterpart to
                        a room's own description and gallery. */}
                    <div role="group" aria-labelledby="hotel-about-heading" className="mt-8">
                      <h3 id="hotel-about-heading" className="text-base font-medium">
                        About the hotel
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The paragraph and photograph on the arrival page, below the building.
                      </p>
                      <div className="mt-4 grid gap-4">
                        <Field
                          id="hotel-description"
                          name="description"
                          label="Description"
                          hint="Plain text, no formatting."
                        >
                          <TextArea
                            id="hotel-description"
                            name="description"
                            defaultValue={hotel.description}
                            required
                          />
                        </Field>
                        <div>
                          <label className="mb-1.5 block text-sm text-muted-foreground">Photo</label>
                          <PhotoField name="aboutPhoto" initial={hotel.aboutPhoto.url} assets={assets} />
                        </div>
                      </div>
                    </div>

                    <p className="mt-8 text-xs text-muted-foreground">
                      Currency ({hotel.currency}) and timezone ({hotel.timezone}) are set when the property is
                      onboarded. The hotel&apos;s hero photographs come with the property&apos;s own photography;
                      their words are under Photos.
                    </p>
                  </div>
                ),
              },
              {
                value: 'photos',
                label: 'Photos',
                content: (
                  <div className="grid gap-6">
                    {hotel.areas.map((area) => (
                      <div
                        key={area.id}
                        role="group"
                        aria-labelledby={`area-${area.id}-heading`}
                        className={`${card} grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]`}
                      >
                        <div>
                          <img
                            src={area.photo.url}
                            alt={area.photo.alt}
                            width={area.photo.width}
                            height={area.photo.height}
                            loading="lazy"
                            className="aspect-[4/3] w-full rounded-[20px] bg-stone object-cover"
                          />
                          <p className="mt-2 text-xs text-muted-foreground">
                            {area.hotspots.length === 1 ? '1 point' : `${area.hotspots.length} points`} to tap on this
                            photograph. Where a point sits comes with the photograph; only its words are edited here.
                          </p>
                        </div>

                        <div className="min-w-0">
                          <h3 id={`area-${area.id}-heading`} className="text-base font-medium">
                            {area.name}
                          </h3>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Field id={`area-${area.id}-name`} name={`areas.${area.id}.name`} label="Name">
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
                              label="Photo description for screen readers"
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
                              label="Description"
                              hint="Plain text, no formatting."
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
                              <h4 className="text-sm font-medium">Points on the photo</h4>
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
                                        <Field id={`hotspot-${hotspot.id}-label`} name={`${path}.label`} label="Label">
                                          <TextInput
                                            id={`hotspot-${hotspot.id}-label`}
                                            name={`${path}.label`}
                                            defaultValue={hotspot.label}
                                            required
                                          />
                                        </Field>
                                        <Field id={`hotspot-${hotspot.id}-cta`} name={`${path}.cta`} label="Button text">
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
                                        label="Description"
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
                                          The button opens /rooms/{hotspot.roomSlug}
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
                label: 'Facilities',
                content: (
                  <div role="group" aria-labelledby="hotel-facilities-heading" className={card}>
                    <h3 id="hotel-facilities-heading" className="text-base font-medium">
                      Facilities
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      What the property offers as a whole — the pool, the spa, parking. Shown on every room&apos;s page,
                      after what is in the room, in this order. A room&apos;s own amenities live on the room type.
                    </p>
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
