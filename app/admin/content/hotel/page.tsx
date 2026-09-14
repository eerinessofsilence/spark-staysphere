import type { Metadata } from 'next';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { Field, TextInput } from '@/components/admin/content/fields';
import { StarRatingField } from '@/components/admin/content/star-rating-field';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { updateHotelAction } from './actions';

export const metadata: Metadata = {
  title: 'Hotel Settings — Hotel admin | SPARK StaySphere 360',
};

export const dynamic = 'force-dynamic';

export default async function HotelContentPage() {
  const { hotel, version } = await contentService.getHotelContent();

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Hotel Settings"
        compact
        actions={
          <a href="/" target="_blank" rel="noreferrer" className={pill('secondary')}>
            Open the arrival page
            <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <div className="mt-8 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm action={updateHotelAction} initialVersion={version} submitLabel="Save hotel details" dock>
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
          <p className="mt-4 text-xs text-muted-foreground">
            Currency ({hotel.currency}) and timezone ({hotel.timezone}) are set when the property is onboarded. The
            hotel&apos;s hero photographs and their hotspots come with the property&apos;s own photography.
          </p>
        </ContentForm>
      </div>
    </AdminPage>
  );
}
