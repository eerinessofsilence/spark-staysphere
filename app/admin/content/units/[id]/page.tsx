import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TableCellsIcon } from '@heroicons/react/24/outline';
import { contentService } from '@/lib/application/container';
import { facadeOf } from '@/lib/domain/room-units';
import { facadeLabels, formatFloor } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { ContentForm } from '@/components/admin/content/content-form';
import { DeleteEntityButton } from '@/components/admin/content/delete-entity-button';
import { Field, TextInput } from '@/components/admin/content/fields';
import { NUMBER_HINT } from '@/components/admin/content/new-physical-room-fields';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { deletePhysicalRoomAction, updatePhysicalRoomAction } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const room = await contentService.getPhysicalRoomContent(id);
  return { title: `${room ? `Room ${room.number}` : id} — Rooms | SPARK StaySphere 360` };
}

export const dynamic = 'force-dynamic';

export default async function PhysicalRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await contentService.getPhysicalRoomContent(id);
  if (!room) notFound();

  const type = await contentService.getRoomContent(room.roomTypeId);
  const seed = contentService.isSeedEntry('unit', room.id);
  const backHref = `/admin/content/units#type-${room.roomTypeId}`;
  const side = type ? facadeLabels[facadeOf(type.view)] : null;

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Content' }, { label: 'Rooms', href: backHref }]}
        title={`Room ${room.number}`}
        description={[type?.name ?? room.roomTypeId, formatFloor(room.floor), side].filter(Boolean).join(' · ')}
      />

      <div className="mt-8 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
        <ContentForm
          action={updatePhysicalRoomAction.bind(null, room.id)}
          initialVersion={room.version}
          submitLabel="Save room"
          dock
          extraActions={
            seed ? (
              <p className="text-sm text-muted-foreground">Came with the demo building, so it can be renumbered but not removed.</p>
            ) : (
              <DeleteEntityButton
                id={room.id}
                label={`Room ${room.number}`}
                confirmMessage={`Remove room ${room.number}? ${type?.name ?? 'Its room type'} will have one room fewer on sale.`}
                action={deletePhysicalRoomAction}
                redirectTo={backHref}
              />
            )
          }
        >
          <Field id="unit-number" name="number" label="Room number" hint={NUMBER_HINT}>
            <TextInput
              id="unit-number"
              name="number"
              defaultValue={room.number}
              required
              autoComplete="off"
              spellCheck={false}
              maxLength={4}
              className="uppercase sm:w-40"
            />
          </Field>

          <dl className="mt-6 grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Room type</dt>
              <dd className="mt-0.5 font-medium">
                {type ? (
                  <Link href={`/admin/content/rooms/${type.id}`} className="hover:text-accent-strong">
                    {type.name}
                  </Link>
                ) : (
                  room.roomTypeId
                )}
              </dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                A room keeps its type. To move it, remove it and add it under the other type.
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Side of the building</dt>
              <dd className="mt-0.5 font-medium">{side ?? '—'}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">Follows the room type&apos;s view.</dd>
            </div>
          </dl>
        </ContentForm>
      </div>

      <Link href={`/admin/tape-chart?type=${room.roomTypeId}`} className={pill('ghost', 'mt-4')}>
        <TableCellsIcon className="size-4" aria-hidden="true" />
        See it on the tape chart
      </Link>
    </AdminPage>
  );
}
