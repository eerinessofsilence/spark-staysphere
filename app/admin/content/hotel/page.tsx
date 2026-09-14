import type { Metadata } from 'next';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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
        description="The hotel's name, and the words on its arrival page: what each photograph of the property says, and the points guests can tap on it."
        actions={
          <a href="/" target="_blank" rel="noreferrer" className={pill('secondary')}>
            Open the arrival page
            <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <nav aria-label="Sections of this page" className="mt-6 flex gap-2 overflow-x-auto pb-1 contain-inline-size sm:flex-wrap sm:overflow-visible">
        <a href="#hotel-basics" className={pill('secondary', 'shrink-0')}>
          Basics
        </a>
        {hotel.areas.map((area) => (
          <a key={area.id} href={`#area-${area.id}`} className={pill('secondary', 'shrink-0')}>
            {area.name}
          </a>
        ))}
      </nav>

      <div className="mt-6">
        <ContentForm action={updateHotelAction} initialVersion={version} submitLabel="Save hotel details" versionKey="hotel">
          <div className="grid gap-6">
            <div
              id="hotel-basics"
              role="group"
              aria-labelledby="hotel-basics-heading"
              className="scroll-mt-6 rounded-[28px] bg-card p-5 shadow-soft sm:p-6"
            >
              <h2 id="hotel-basics-heading" className="text-display text-2xl">
                Basics
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <HotelBasics hotel={hotel} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Currency ({hotel.currency}) and timezone ({hotel.timezone}) are set when the property is
                onboarded. Where a point sits on its photograph comes with the property&apos;s own
                photography, so only its words are edited here.
              </p>
            </div>

            {hotel.areas.map((area) => (
              <div
                key={area.id}
                id={`area-${area.id}`}
                role="group"
                aria-labelledby={`area-${area.id}-heading`}
                className="grid scroll-mt-6 gap-5 rounded-[28px] bg-card p-5 shadow-soft sm:p-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
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
                    {area.hotspots.length === 1 ? '1 point' : `${area.hotspots.length} points`} to tap on this photograph
                  </p>
                </div>

                <div className="min-w-0">
                  <h2 id={`area-${area.id}-heading`} className="text-display text-2xl">
                    {area.name}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field id={`area-${area.id}-name`} name={`areas.${area.id}.name`} label="Name">
                      <TextInput id={`area-${area.id}-name`} name={`area-${area.id}-name`} defaultValue={area.name} required />
                    </Field>
                    <Field
                      id={`area-${area.id}-photoAlt`}
                      name={`areas.${area.id}.photoAlt`}
                      label="Photo description for screen readers"
                    >
                      <TextInput
                        id={`area-${area.id}-photoAlt`}
                        name={`area-${area.id}-photoAlt`}
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
                        name={`area-${area.id}-description`}
                        defaultValue={area.description}
                        required
                      />
                    </Field>
                  </div>

                  {area.hotspots.length > 0 ? (
                    <div className="mt-6 grid gap-3 border-t border-border pt-6">
                      <h3 className="text-sm font-medium">Points on the photo</h3>
                      {area.hotspots.map((hotspot) => (
                        <details key={hotspot.id} className="group rounded-2xl border border-border">
                          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                            <span id={`hotspot-${hotspot.id}-heading`}>{hotspot.label}</span>
                            <ChevronDownIcon
                              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                              aria-hidden="true"
                            />
                          </summary>
                          <div role="group" aria-labelledby={`hotspot-${hotspot.id}-heading`} className="grid gap-3 px-4 pb-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field
                                id={`hotspot-${hotspot.id}-label`}
                                name={`areas.${area.id}.hotspots.${hotspot.id}.label`}
                                label="Label"
                              >
                                <TextInput
                                  id={`hotspot-${hotspot.id}-label`}
                                  name={`hotspot-${hotspot.id}-label`}
                                  defaultValue={hotspot.label}
                                  required
                                />
                              </Field>
                              <Field
                                id={`hotspot-${hotspot.id}-cta`}
                                name={`areas.${area.id}.hotspots.${hotspot.id}.cta`}
                                label="Button text"
                              >
                                <TextInput
                                  id={`hotspot-${hotspot.id}-cta`}
                                  name={`hotspot-${hotspot.id}-cta`}
                                  defaultValue={hotspot.cta}
                                  required
                                />
                              </Field>
                            </div>
                            <Field
                              id={`hotspot-${hotspot.id}-description`}
                              name={`areas.${area.id}.hotspots.${hotspot.id}.description`}
                              label="Description"
                            >
                              <TextArea
                                id={`hotspot-${hotspot.id}-description`}
                                name={`hotspot-${hotspot.id}-description`}
                                defaultValue={hotspot.description}
                                required
                              />
                            </Field>
                            {hotspot.roomSlug ? (
                              <p className="text-xs text-muted-foreground">The button opens /rooms/{hotspot.roomSlug}</p>
                            ) : null}
                          </div>
                        </details>
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
