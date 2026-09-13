import type { Metadata } from 'next';
import Link from 'next/link';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { Field, TextArea, TextInput } from '@/components/admin/content/fields';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { updateHotelAction } from './actions';

export const metadata: Metadata = {
  title: 'Hotel details — Content | SPARK StaySphere 360',
};

export const dynamic = 'force-dynamic';

export default async function HotelContentPage() {
  const { hotel, version } = await contentService.getHotelContent();

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[900px] px-3 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin/content" className="hover:text-accent-strong">
                Content
              </Link>
              {' / '}Hotel
            </p>
            <h1 className="text-display mt-2 text-4xl sm:text-5xl">{hotel.name}</h1>
          </div>
          <a href="/" target="_blank" rel="noreferrer" className={pill('secondary')}>
            Open on site
          </a>
        </div>

        <ContentForm action={updateHotelAction} initialVersion={version} submitLabel="Save hotel details">
          <div role="group" aria-labelledby="hotel-basics-heading" className="mt-8 grid gap-4">
            <h2 id="hotel-basics-heading" className="text-display text-xl">
              Basics
            </h2>
            <HotelBasics hotel={hotel} />
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Currency ({hotel.currency}), timezone ({hotel.timezone}), the slug, and every coordinate
            below (hotspot position, the building model, the spinner) are shown for reference and
            are not editable here.
          </p>

          <div className="mt-8 grid gap-8">
            {hotel.areas.map((area) => (
              <div key={area.id} role="group" aria-labelledby={`area-${area.id}-heading`} className="rounded-[28px] bg-card p-6 shadow-soft">
                <h2 id={`area-${area.id}-heading`} className="text-display text-xl">
                  {area.name}
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field id={`area-${area.id}-name`} label="Name">
                    <TextInput id={`area-${area.id}-name`} name={`area-${area.id}-name`} defaultValue={area.name} required />
                  </Field>
                  <Field id={`area-${area.id}-photoAlt`} label="Photo alt text">
                    <TextInput
                      id={`area-${area.id}-photoAlt`}
                      name={`area-${area.id}-photoAlt`}
                      defaultValue={area.photo.alt}
                      required
                    />
                  </Field>
                </div>
                <Field id={`area-${area.id}-description`} label="Description" hint="Plain text, no formatting.">
                  <TextArea
                    id={`area-${area.id}-description`}
                    name={`area-${area.id}-description`}
                    defaultValue={area.description}
                    required
                    className="mt-4"
                  />
                </Field>

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
                        <Field id={`hotspot-${hotspot.id}-description`} label="Description">
                          <TextArea
                            id={`hotspot-${hotspot.id}-description`}
                            name={`hotspot-${hotspot.id}-description`}
                            defaultValue={hotspot.description}
                            required
                            className="mt-3"
                          />
                        </Field>
                        {hotspot.roomSlug ? (
                          <p className="mt-2 text-xs text-muted-foreground">Links to room: {hotspot.roomSlug}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </ContentForm>
      </main>
      <SiteFooter />
    </>
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
