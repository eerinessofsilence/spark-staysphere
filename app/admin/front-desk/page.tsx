import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { contentService, DEMO_HOTEL_SLUG, inventoryService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { isIsoDate, toIsoDate } from '@/lib/application/search-params';
import { addIsoDays } from '@/lib/domain/dates';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateShort, lNights } from '@/lib/i18n/format';
import { iconButton, pill } from '@/lib/ui';
import { AddRoomTypeButton } from '@/components/admin/content/add-room-type-button';
import { AddBookingButton } from '@/components/admin/front-desk/add-booking-button';
import { FrontDeskGrid } from '@/components/admin/front-desk/front-desk-grid';
import { FrontDeskLegend } from '@/components/admin/front-desk/front-desk-legend';
import { FrontDeskMobileFilters } from '@/components/admin/front-desk/front-desk-mobile-filters';
import { frontDeskHref, DEFAULT_WINDOW, MAX_CUSTOM_WINDOW } from '@/components/admin/front-desk/front-desk-shared';
import { FrontDeskWindowFilter } from '@/components/admin/front-desk/front-desk-window-filter';
import { RoomTypeSelect } from '@/components/admin/front-desk/room-type-select';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.frontDesk')) };
}

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FrontDeskPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const params = await searchParams;
  const today = toIsoDate(new Date());
  const rawFrom = first(params.from);
  const from = isIsoDate(rawFrom) ? rawFrom : today;
  const rawDays = Number(first(params.days));
  const days = Number.isInteger(rawDays) && rawDays >= 1 && rawDays <= MAX_CUSTOM_WINDOW ? rawDays : DEFAULT_WINDOW;

  const selectedSlug = await getSelectedHotelSlug();
  const board = await inventoryService.getFrontDesk(selectedSlug, from, days);
  const rawType = first(params.type);
  const type = rawType && board.groups.some((group) => group.roomTypeId === rawType) ? rawType : null;
  const groups = type ? board.groups.filter((group) => group.roomTypeId === type) : board.groups;

  const lastNight = board.dates.at(-1) ?? from;
  // The CMS only ever writes against the default hotel — see content-service.ts's
  // single bound `hotelSlug` — so the shortcut to add a room type only appears there.
  const canAddProperty = selectedSlug === DEMO_HOTEL_SLUG;
  const roomTypes = canAddProperty ? await contentService.listRoomsContent() : [];
  // Hidden room types can't actually be booked (`catalogService.getRoomDetail`
  // refuses them the same as it would a guest), so they aren't offered here.
  const bookableRoomTypes = board.groups.filter((group) => !group.hidden).map((group) => ({ id: group.roomTypeId, slug: group.roomSlug, name: group.roomName }));

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.frontDesk')}
        actions={
          <>
            {canAddProperty ? <AddRoomTypeButton roomTypes={roomTypes} /> : null}
            <AddBookingButton roomTypes={bookableRoomTypes} today={today} />
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Link
            href={frontDeskHref({ from: addIsoDays(from, -days), days, type })}
            aria-label={t('frontDesk.previousNights', { nights: lNights(days, locale) })}
            className={iconButton('light')}
          >
            <ChevronLeftIcon className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href={frontDeskHref({ from: today, days, type })}
            aria-current={from === today ? 'true' : undefined}
            className={pill('secondary')}
          >
            {t('frontDesk.today')}
          </Link>
          <Link
            href={frontDeskHref({ from: addIsoDays(from, days), days, type })}
            aria-label={t('frontDesk.nextNights', { nights: lNights(days, locale) })}
            className={iconButton('light')}
          >
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </Link>
          <div className="ml-auto sm:hidden">
            <FrontDeskMobileFilters
              from={from}
              days={days}
              type={type}
              roomTypes={board.groups.map((group) => ({ id: group.roomTypeId, name: group.roomName }))}
            />
          </div>
        </div>
        <p className="text-sm font-medium">
          {lDateShort(from, locale)} – {lDateShort(lastNight, locale)}
          <span className="font-normal text-muted-foreground"> · {lNights(board.dates.length, locale)}</span>
        </p>

        <div className="hidden flex-wrap items-center gap-2 sm:ml-auto sm:flex">
          <FrontDeskWindowFilter from={from} days={days} type={type} />
          <RoomTypeSelect
            options={board.groups.map((group) => ({ id: group.roomTypeId, name: group.roomName }))}
            value={type}
            from={from}
            days={days}
          />
        </div>
      </div>

      <div className="mt-5">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
            <h2 className="text-display text-3xl">{t('frontDesk.noRooms')}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {type ? t('frontDesk.noRoomsForType') : t('frontDesk.noRoomsYet')}
            </p>
            <Link
              href={type ? frontDeskHref({ from, days, type: null }) : '/admin/content/rooms/new'}
              className={pill('primary')}
            >
              {type ? t('frontDesk.showAllTypes') : t('frontDesk.addRoomType')}
            </Link>
          </div>
        ) : (
          <FrontDeskGrid
            dates={board.dates}
            days={board.days}
            groups={groups}
            totalRooms={board.totalRooms}
            today={today}
          />
        )}
      </div>

      <div className="mt-5 hidden sm:block">
        <FrontDeskLegend />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{t('frontDesk.footnote')}</p>
    </AdminPage>
  );
}
