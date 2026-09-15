import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowTopRightOnSquareIcon,
  KeyIcon,
  PlusIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { CheckCircle, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { coverPhoto } from '@/lib/domain/room-attributes';
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
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
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
  return { title: `${room?.name ?? id} — Room types | SPARK StaySphere 360` };
}

export const dynamic = 'force-dynamic';

export default async function RoomContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [room, rates, { hotel }, assets, physicalRooms] = await Promise.all([
    contentService.getRoomContent(id),
    contentService.listRatesContent(id),
    contentService.getHotelContent(),
    Promise.resolve(contentService.listMedia()),
    contentService.listPhysicalRoomsContent(),
  ]);
  if (!room) notFound();

  const boundUpdateRoom = updateRoomAction.bind(null, id);
  const cover = coverPhoto(room);
  const cheapest = [...rates].sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0];
  const roomCount = physicalRooms.filter((unit) => unit.roomTypeId === room.id).length;

  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumbs={[{ label: 'Content' }, { label: 'Room types', href: '/admin/content' }]}
        title={room.name}
        actions={
          <>
            <RoomVisibilityToggle
              roomId={room.id}
              hidden={Boolean(room.hidden)}
              version={room.version}
              action={setRoomHiddenAction}
            />
            <a href={`/rooms/${room.slug}`} target="_blank" rel="noreferrer" className={pill('secondary')}>
              Open on site
              <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
            </a>
          </>
        }
      />

      <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-sidebar">
        <div className="grid min-w-0 grid-cols-1 gap-12">
          {/* A card from `sm` up. On a phone its padding would squeeze the photo rows past the screen edge. */}
          <section
            aria-labelledby="room-form-heading"
            className="sm:rounded-[28px] sm:bg-card sm:p-6 sm:shadow-soft"
          >
            <h2 id="room-form-heading" className="text-display text-2xl">
              The room
            </h2>
            <ContentForm action={boundUpdateRoom} initialVersion={room.version} submitLabel="Save room" dock>
              <div className="mt-6 grid gap-8">
                <div role="group" aria-labelledby="room-details-heading">
                  <h3 id="room-details-heading" className="text-base font-medium">
                    Details
                  </h3>
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
                  <h3 id="room-amenities-heading" className="text-base font-medium">
                    Amenities
                  </h3>
                  <div className="mt-4">
                    <OrderedStringList name="amenities" initial={room.amenities} addPlaceholder="Add an amenity" />
                  </div>
                </div>

                <div role="group" aria-labelledby="room-media-heading">
                  <h3 id="room-media-heading" className="text-base font-medium">
                    Photos and views
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">The first photo is the room&apos;s cover everywhere on the site.</p>
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
          </section>

          <section aria-labelledby="rates-heading">
            <h2 id="rates-heading" className="text-display text-3xl">
              Rates
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A room stays off the site until it has at least one rate and one photo.
            </p>

            <div className="mt-5 grid gap-6">
              {rates.map((rate) => (
                <div key={rate.id} className="rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
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

              {/* Folded away until asked for: an empty form open on every room read as unfinished. */}
              <details className="rounded-[28px] border border-dashed border-border open:border-solid open:bg-card open:shadow-soft">
                <summary
                  className={pill('secondary', 'm-4 w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden')}
                >
                  <PlusIcon className="size-4" aria-hidden="true" />
                  Add a rate
                </summary>
                <div className="px-5 pb-6 sm:px-6">
                  <RateForm
                    idPrefix="rate-new"
                    formAction={createRateAction.bind(null, room.id)}
                    initialVersion={0}
                    currency={hotel.currency}
                    submitLabel="Add rate"
                  />
                </div>
              </details>
            </div>
          </section>
        </div>

        <aside aria-label="How the room reads on the site" className="hidden lg:sticky lg:top-6 lg:block">
          <div className="overflow-hidden rounded-[28px] bg-card p-3 shadow-soft">
            {cover ? (
              <img
                src={cover.url}
                alt=""
                width={cover.width}
                height={cover.height}
                className="aspect-[4/3] w-full rounded-[20px] bg-stone object-cover"
              />
            ) : (
              <div className="grid aspect-[4/3] place-items-center rounded-[20px] bg-stone text-sm text-muted-foreground">
                No photo yet
              </div>
            )}
            <div className="px-2 pt-4 pb-2">
              {room.hidden ? (
                <span className={tag()}>
                  <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                  Hidden from the site
                </span>
              ) : (
                <span className={tag('bg-tint-sage text-tint-sage-ink')}>
                  <CheckCircle weight="fill" className="size-3.5" aria-hidden="true" />
                  On the site
                </span>
              )}
              <p className="text-display mt-3 text-2xl">{room.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {room.areaM2} m² · sleeps {room.capacity} · {viewLabels[room.view]}
              </p>
              {cheapest ? (
                <p className="text-display mt-3 text-3xl">
                  {formatMoney(cheapest.nightlyPrice, cheapest.currency)}
                  <span className="ml-1 font-sans text-sm font-normal tracking-normal text-muted-foreground">/ night</span>
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No rate yet, so guests can&apos;t book it.</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-1 px-2 text-sm">
            <p className="text-muted-foreground">
              {roomCount === 1 ? '1 room' : `${roomCount} rooms`} of this type in the building.
            </p>
            <Link
              href={`/admin/chessboard?type=${room.id}`}
              className="inline-flex min-h-11 items-center gap-2 font-medium hover:text-accent-strong"
            >
              <TableCellsIcon className="size-4" aria-hidden="true" />
              See them on the Property Desk
            </Link>
            <Link
              href={`/admin/content/units#type-${room.id}`}
              className="inline-flex min-h-11 items-center gap-2 font-medium hover:text-accent-strong"
            >
              <KeyIcon className="size-4" aria-hidden="true" />
              {roomCount === 0 ? 'Add its first room' : 'Manage its rooms'}
            </Link>
            <p className="text-xs text-muted-foreground">The card shows what is saved and updates with each save.</p>
          </div>
        </aside>
      </div>
    </AdminPage>
  );
}
