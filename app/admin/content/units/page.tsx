import type { Metadata } from 'next';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import { EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { contentService } from '@/lib/application/container';
import { byRoomNumber, facadeOf } from '@/lib/domain/room-units';
import { facadeLabels, formatFloor } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { CatalogTabs } from '@/components/admin/content/catalog-tabs';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Rooms — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default async function PhysicalRoomsPage() {
  const [types, rooms, addOns] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.listPhysicalRoomsContent(),
    contentService.listAddOnsContent(),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Rooms & add‑ons"
        actions={
          types.length > 0 ? (
            <Link href="/admin/content/units/new" className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              New room
            </Link>
          ) : null
        }
      />

      <CatalogTabs current="rooms" counts={{ types: types.length, rooms: rooms.length, addons: addOns.length }} />

      {types.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
          <div>
            <h2 className="text-display text-2xl">Start with a room type</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Every room belongs to a room type — its size, bed, view, photos and rates. Create the type, then
              add its rooms here.
            </p>
          </div>
          <Link href="/admin/content/rooms/new" className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            New room type
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {types.map((type) => {
            const own = rooms.filter((room) => room.roomTypeId === type.id).sort(byRoomNumber);
            const anchor = `type-${type.id}`;
            return (
              <section
                key={type.id}
                id={anchor}
                aria-labelledby={`${anchor}-heading`}
                className="scroll-mt-24 rounded-[28px] bg-card p-5 shadow-soft sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id={`${anchor}-heading`} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                      <Link href={`/admin/content/rooms/${type.id}`} className="hover:text-accent-strong">
                        {type.name}
                      </Link>
                      <span className="font-normal text-muted-foreground">
                        · {own.length === 1 ? '1 room' : `${own.length} rooms`}
                      </span>
                      {type.hidden ? (
                        <span className={tag('py-0.5')}>
                          <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                          Hidden
                        </span>
                      ) : null}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatFloor(type.floor)} · {facadeLabels[facadeOf(type.view)]}
                    </p>
                  </div>
                  <Link href={`/admin/content/units/new?type=${type.id}`} className={pill('secondary')}>
                    <PlusIcon className="size-4" aria-hidden="true" />
                    Add room<span className="sr-only"> to {type.name}</span>
                  </Link>
                </div>

                {own.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No rooms yet, so guests can&apos;t book {type.name}.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {own.map((room) => (
                      <li key={room.id}>
                        <Link
                          href={`/admin/content/units/${room.id}`}
                          aria-label={`Room ${room.number}`}
                          className={pill('secondary', 'min-w-18 px-4 tabular-nums')}
                        >
                          {room.number}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
