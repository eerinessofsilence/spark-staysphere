import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contentService } from '@/lib/application/container';
import { bedLabels, formatMoney, viewLabels } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { DeleteEntityButton } from '@/components/admin/content/delete-entity-button';
import { Field, Select, TextArea, TextInput } from '@/components/admin/content/fields';
import { MediaListEditor } from '@/components/admin/content/media-list-editor';
import { OrderedStringList } from '@/components/admin/content/ordered-string-list';
import { RateForm } from '@/components/admin/content/rate-form';
import { RoomNameField } from '@/components/admin/content/room-name-field';
import { RoomVisibilityToggle } from '@/components/admin/content/room-visibility-toggle';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import {
  createRateAction,
  deleteRateAction,
  setRoomHiddenAction,
  updateRateAction,
  updateRoomAction,
} from './actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const room = await contentService.getRoomContent(id);
  return { title: `${room?.name ?? id} — Content | SPARK StaySphere 360` };
}

export const dynamic = 'force-dynamic';

export default async function RoomContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [room, rates, { hotel }, assets] = await Promise.all([
    contentService.getRoomContent(id),
    contentService.listRatesContent(id),
    contentService.getHotelContent(),
    Promise.resolve(contentService.listMedia()),
  ]);
  if (!room) notFound();

  const boundUpdateRoom = updateRoomAction.bind(null, id);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[900px] px-3 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin/content" className="hover:text-accent-strong">
                Content
              </Link>
              {' / '}
              {room.name}
            </p>
            <h1 className="text-display mt-2 text-4xl sm:text-5xl">{room.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">/rooms/{room.slug}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <a href={`/rooms/${room.slug}`} target="_blank" rel="noreferrer" className={pill('secondary')}>
              Open on site
            </a>
            {room.hidden ? <span className={tag()}>Hidden from the site</span> : <span className={tag('bg-tint-sage text-tint-sage-ink')}>On the site</span>}
          </div>
        </div>

        <div className="mt-6">
          <RoomVisibilityToggle roomId={room.id} hidden={Boolean(room.hidden)} version={room.version} action={setRoomHiddenAction} />
        </div>

        <ContentForm action={boundUpdateRoom} initialVersion={room.version} submitLabel="Save room">
          <div className="mt-8 grid gap-8">
            <div role="group" aria-labelledby="room-details-heading">
              <h2 id="room-details-heading" className="text-display text-xl">
                Details
              </h2>
              <div className="mt-4 grid gap-4">
                <RoomNameField initial={room.name} />
                <Field id="room-description" name="description" label="Description" hint="Plain text, no formatting.">
                  <TextArea id="room-description" name="description" defaultValue={room.description} required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field id="room-areaM2" name="areaM2" label="Size (m²)">
                    <TextInput id="room-areaM2" name="areaM2" type="number" min={1} step="0.1" defaultValue={room.areaM2} required />
                  </Field>
                  <Field id="room-floor" name="floor" label="Floor">
                    <TextInput id="room-floor" name="floor" type="number" min={0} step="1" defaultValue={room.floor} required />
                  </Field>
                  <Field id="room-capacity" name="capacity" label="Sleeps">
                    <TextInput id="room-capacity" name="capacity" type="number" min={1} step="1" defaultValue={room.capacity} required />
                  </Field>
                  <Field id="room-bedType" name="bedType" label="Bed">
                    <Select id="room-bedType" name="bedType" defaultValue={room.bedType} required>
                      {Object.entries(bedLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field id="room-view" name="view" label="View">
                  <Select id="room-view" name="view" defaultValue={room.view} required className="sm:w-56">
                    {Object.entries(viewLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <div role="group" aria-labelledby="room-amenities-heading">
              <h2 id="room-amenities-heading" className="text-display text-xl">
                Amenities
              </h2>
              <div className="mt-4">
                <OrderedStringList name="amenities" initial={room.amenities} addPlaceholder="Add an amenity" />
              </div>
            </div>

            <div role="group" aria-labelledby="room-media-heading">
              <h2 id="room-media-heading" className="text-display text-xl">
                Photos and views
              </h2>
              <div className="mt-4">
                <MediaListEditor
                  name="media"
                  initial={room.media.map((item) => ({ type: item.type as 'image' | '360', url: item.url, label: item.label }))}
                  assets={assets}
                />
              </div>
            </div>
          </div>
        </ContentForm>

        <section aria-labelledby="rates-heading" className="mt-12">
          <h2 id="rates-heading" className="text-display text-3xl">
            Rates
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A room stays off the site until it has at least one rate and one photo.
          </p>

          <div className="mt-5 grid gap-6">
            {rates.map((rate) => (
              <div key={rate.id} className="rounded-[28px] bg-card p-6 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-display text-lg">
                    {rate.name} · {formatMoney(rate.nightlyPrice, rate.currency)}/night
                  </h3>
                  <DeleteEntityButton
                    id={rate.id}
                    label={rate.name}
                    confirmMessage={`Remove the rate "${rate.name}"? This cannot be undone.`}
                    action={deleteRateAction}
                  />
                </div>
                <div className="mt-4">
                  <RateForm
                    idPrefix={`rate-${rate.id}`}
                    formAction={updateRateAction.bind(null, rate.id)}
                    initialVersion={rate.version}
                    currency={hotel.currency}
                    submitLabel="Save rate"
                    initial={{
                      name: rate.name,
                      nightlyPrice: rate.nightlyPrice,
                      otaComparisonPrice: rate.otaComparisonPrice,
                      breakfastIncluded: rate.breakfastIncluded,
                      includedServices: rate.includedServices,
                      cancellationPolicy: rate.cancellationPolicy,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="rounded-[28px] border border-dashed border-border p-6">
              <h3 className="text-display text-lg">Add a rate</h3>
              <div className="mt-4">
                <RateForm
                  idPrefix="rate-new"
                  formAction={createRateAction.bind(null, room.id)}
                  initialVersion={0}
                  currency={hotel.currency}
                  submitLabel="Add rate"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
