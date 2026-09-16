import type { Metadata } from 'next';
import { contentService } from '@/lib/application/container';
import { bedLabels, viewLabels } from '@/lib/formatting';
import { ContentForm } from '@/components/admin/content/content-form';
import { Field, Select, TextArea, TextInput } from '@/components/admin/content/fields';
import { labelOptions } from '@/components/admin/content/label-options';
import { MediaListEditor } from '@/components/admin/content/media-list-editor';
import { NewRoomIdentityFields } from '@/components/admin/content/new-room-identity-fields';
import { OrderedStringList } from '@/components/admin/content/ordered-string-list';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { createRoomAction } from './actions';

export const metadata: Metadata = { title: 'New room type — Room types | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function NewRoomPage() {
  const assets = contentService.listMedia();

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Content' }, { label: 'Room types', href: '/admin/content' }]}
        title="New room type"
        description="A new room type starts hidden from the site. Add its rooms under Rooms, give it a rate and a photo, then show it from its own page."
      />

      <div className="mt-8 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm action={createRoomAction} initialVersion={0} submitLabel="Create room type" dock>
          <div className="grid gap-6">
            <div role="group" aria-labelledby="identity-heading">
              <h2 id="identity-heading" className="text-base font-medium">
                Identity
              </h2>
              <div className="mt-4">
                <NewRoomIdentityFields />
              </div>
            </div>

            <div role="group" aria-labelledby="details-heading">
              <h2 id="details-heading" className="text-base font-medium">
                Details
              </h2>
              <div className="mt-4 grid gap-4">
                <Field id="room-description" name="description" label="Description" hint="Plain text, no formatting.">
                  <TextArea id="room-description" name="description" required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field id="room-areaM2" name="areaM2" label="Size (m²)">
                    <TextInput id="room-areaM2" name="areaM2" type="number" min={1} step="0.1" required />
                  </Field>
                  <Field id="room-floor" name="floor" label="Floor">
                    <TextInput id="room-floor" name="floor" type="number" min={0} step="1" required />
                  </Field>
                  <Field id="room-capacity" name="capacity" label="Sleeps">
                    <TextInput id="room-capacity" name="capacity" type="number" min={1} step="1" required />
                  </Field>
                  <Field id="room-bedType" name="bedType" label="Bed">
                    <Select id="room-bedType" name="bedType" defaultValue="king" required>
                      {labelOptions(bedLabels)}
                    </Select>
                  </Field>
                </div>
                <Field id="room-view" name="view" label="View">
                  <Select id="room-view" name="view" defaultValue="sea" required className="sm:w-56">
                    {labelOptions(viewLabels)}
                  </Select>
                </Field>
              </div>
            </div>

            <div role="group" aria-labelledby="amenities-heading">
              <h2 id="amenities-heading" className="text-base font-medium">
                Amenities
              </h2>
              <div className="mt-4">
                <OrderedStringList name="amenities" initial={[]} addPlaceholder="Add an amenity" itemNoun="amenity" />
              </div>
            </div>

            <div role="group" aria-labelledby="media-heading">
              <h2 id="media-heading" className="text-base font-medium">
                Photos
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
