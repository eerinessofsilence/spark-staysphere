import type { Metadata } from 'next';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { Field, TextArea, TextInput } from '@/components/admin/content/fields';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { updateHotelAction } from './actions';

export const metadata: Metadata = {
  title: 'Hotel & areas — Hotel admin | SPARK StaySphere 360',
};

export const dynamic = 'force-dynamic';

export default async function HotelContentPage() {
  const { hotel, version } = await contentService.getHotelContent();

  return (
    <AdminPage>
      <AdminPageHeader
        title="Hotel & areas"
        description="The hotel's name, and the words on its arrival page: what each photograph of the property says, and the hotspots on it."
        actions={
          <a href="/" target="_blank" rel="noreferrer" className={pill('secondary')}>
            Open the arrival page
            <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <div className="mt-8">
        <ContentForm action={updateHotelAction} initialVersion={version} submitLabel="Save hotel details">
          <div className="grid gap-6">
            <div
              role="group"
              aria-labelledby="hotel-basics-heading"
              className="rounded-[28px] bg-card p-5 shadow-soft sm:p-6"
            >
              <h2 id="hotel-basics-heading" className="text-display text-2xl">
                Basics
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <HotelBasics hotel={hotel} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Currency ({hotel.currency}) and timezone ({hotel.timezone}) are set when the property is
                onboarded. Where a hotspot sits on its photograph comes with the property&apos;s own
                photography, so only its words are edited here.
              </p>
            </div>

            {hotel.areas.map((area) => (
              <div
                key={area.id}
                role="group"
                aria-labelledby={`area-${area.id}-heading`}
                className="grid gap-5 rounded-[28px] bg-card p-5 shadow-soft sm:p-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
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
                    {area.hotspots.length === 1 ? '1 hotspot' : `${area.hotspots.length} hotspots`} on this photograph
                  </p>
                </div>

                <div className="min-w-0">
                  <h2 id={`area-${area.id}-heading`} className="text-display text-2xl">
                    {area.name}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field id={`area-${area.id}-name`} label="Name">
                      <TextInput id={`area-${area.id}-name`} name={`area-${area.id}-name`} defaultValue={area.name} required />
                    </Field>
                    <Field id={`area-${area.id}-photoAlt`} label="Photo description for screen readers">
                      <TextInput
                        id={`area-${area.id}-photoAlt`}
                        name={`area-${area.id}-photoAlt`}
                        defaultValue={area.photo.alt}
                        required
                      />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field id={`area-${area.id}-description`} label="Description" hint="Plain text, no formatting.">
                      <TextArea
                        id={`area-${area.id}-description`}
                        name={`area-${area.id}-description`}
                        defaultValue={area.description}
                        required
                      />
                    </Field>
                  </div>

                  {area.hotspots.length > 0 ? (
                    <div className="mt-6 grid gap-4 border-t border-border pt-6">
                      {area.hotspots.map((hotspot) => (
                        <div
                          key={hotspot.id}
                          role="group"
                          aria-labelledby={`hotspot-${hotspot.id}-heading`}
                          className="rounded-2xl border border-border p-4"
                        >
                          <h3 id={`hotspot-${hotspot.id}-heading`} className="text-sm font-medium">
                            Hotspot: {hotspot.label}
                          </h3>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Field id={`hotspot-${hotspot.id}-label`} label="Label">
                              <TextInput
                                id={`hotspot-${hotspot.id}-label`}
                                name={`hotspot-${hotspot.id}-label`}
                                defaultValue={hotspot.label}
                                required
                              />
                            </Field>
                            <Field id={`hotspot-${hotspot.id}-cta`} label="Call to action">
                              <TextInput
                                id={`hotspot-${hotspot.id}-cta`}
                                name={`hotspot-${hotspot.id}-cta`}
                                defaultValue={hotspot.cta}
                                required
                              />
                            </Field>
                          </div>
                          <div className="mt-3">
                            <Field id={`hotspot-${hotspot.id}-description`} label="Description">
                              <TextArea
                                id={`hotspot-${hotspot.id}-description`}
                                name={`hotspot-${hotspot.id}-description`}
                                defaultValue={hotspot.description}
                                required
                              />
                            </Field>
                          </div>
                          {hotspot.roomSlug ? (
                            <p className="mt-2 text-xs text-muted-foreground">Opens the room: /rooms/{hotspot.roomSlug}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </ContentForm>
      </div>
    </AdminPage>
  );
}

function HotelBasics({ hotel }: { hotel: Awaited<ReturnType<typeof contentService.getHotelContent>>['hotel'] }) {
  return (
    <>
      <Field id="hotel-name" name="name" label="Name">
        <TextInput id="hotel-name" name="name" defaultValue={hotel.name} required />
      </Field>
      <Field id="hotel-tagline" name="tagline" label="Tagline">
        <TextInput id="hotel-tagline" name="tagline" defaultValue={hotel.tagline} required />
      </Field>
      <Field id="hotel-location" name="location" label="Location">
        <TextInput id="hotel-location" name="location" defaultValue={hotel.location} required />
      </Field>
    </>
  );
}
