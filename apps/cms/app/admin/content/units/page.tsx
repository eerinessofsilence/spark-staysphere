import type { Metadata } from 'next';
import Link from 'next/link';
import { Bed, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import { EmptyStateIcon } from '@/components/ui/empty-state-icon';
import { contentService } from '@/lib/application/container';
import { byRoomNumber, facadeOf } from '@/lib/domain/room-units';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lFacade, lFloor, lRoomCount, lRoomNumber } from '@/lib/i18n/format';
import { tag } from '@/lib/ui';
import { CatalogTabs } from '@/components/admin/content/catalog-tabs';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { AddActionButton } from '@/components/admin/add-action-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.rooms')) };
}

export const dynamic = 'force-dynamic';

export default async function PhysicalRoomsPage() {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const [types, rooms] = await Promise.all([
    contentService.listRoomsContent(),
    contentService.listPhysicalRoomsContent(),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.rooms')}
        actions={
          types.length > 0 ? (
            <AddActionButton href="/admin/content/units/new">{t('units.newRoom')}</AddActionButton>
          ) : null
        }
      />

      <CatalogTabs current="rooms" counts={{ types: types.length, rooms: rooms.length }} />

      {types.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
          <EmptyStateIcon>
            <Bed weight="fill" className="size-6 text-muted-foreground" aria-hidden="true" />
          </EmptyStateIcon>
          <div>
            <h2 className="text-display text-2xl">{t('units.startWithType')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('units.startBody')}</p>
          </div>
          <AddActionButton href="/admin/content/rooms/new">{t('rooms.newType')}</AddActionButton>
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
                className="scroll-mt-24 rounded-[18px] bg-card p-5 shadow-soft sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id={`${anchor}-heading`} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                      <Link href={`/admin/content/rooms/${type.id}`} className="hover:text-accent-strong">
                        {type.name}
                      </Link>
                      <span className="font-normal text-muted-foreground">· {lRoomCount(own.length, locale)}</span>
                      {type.hidden ? (
                        <span className={tag('py-0.5')}>
                          <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
                          {t('units.hidden')}
                        </span>
                      ) : null}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {lFloor(type.floor, locale)} · {lFacade(facadeOf(type.view), locale)}
                    </p>
                  </div>
                  <AddActionButton href={`/admin/content/units/new?type=${type.id}`} variant="secondary">
                    <span aria-hidden="true">{t('units.addRoom')}</span>
                    <span className="sr-only">{t('units.addRoomTo', { name: type.name })}</span>
                  </AddActionButton>
                </div>

                {own.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {t('units.noneForType', { name: type.name })}
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {own.map((room) => (
                      <li key={room.id}>
                        <Link
                          href={`/admin/content/units/${room.id}`}
                          aria-label={`${t('form.edit')} ${lRoomNumber(room.number, locale)}`}
                          className="group flex min-h-20 w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 transition-colors hover:border-accent hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <span className="text-lg font-semibold tabular-nums group-hover:text-accent-strong">
                            {room.number}
                          </span>
                          <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground">
                            {t('form.edit')}
                          </span>
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
