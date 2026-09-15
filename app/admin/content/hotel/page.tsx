import type { Metadata } from 'next';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
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
            Open the arrival page
            <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <div className="mt-8">
        <ContentForm action={updateHotelAction} initialVersion={version} submitLabel="Save hotel details" dock>
          <HotelSettingsTabs
            details={
              <div className="rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
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
                      <TextArea id="hotel-description" name="description" defaultValue={hotel.description} required />
                    </Field>
                    <div>
                      <label className="mb-1.5 block text-sm text-muted-foreground">Photo</label>
                      <PhotoField name="aboutPhoto" initial={hotel.aboutPhoto.url} assets={assets} />
                    </div>
                  </div>
                </div>

                <p className="mt-8 text-xs text-muted-foreground">
                  Currency ({hotel.currency}) and timezone ({hotel.timezone}) are set when the property is
                  onboarded. The hotel&apos;s hero photographs and their hotspots come with the property&apos;s own
                  photography.
                </p>
              </div>
            }
            facilities={
              <div role="group" aria-labelledby="hotel-facilities-heading" className="rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
                <h3 id="hotel-facilities-heading" className="text-base font-medium">
                  Facilities
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  What the property offers as a whole — the pool, the spa, parking. Shown on the arrival page
                  under the description, in this order. A room&apos;s own amenities live on the room type.
                </p>
                <div className="mt-4">
                  <FacilitiesEditor name="facilities" initial={hotel.facilities ?? []} />
                </div>
              </div>
            }
          />
        </ContentForm>
      </div>
    </AdminPage>
  );
}
