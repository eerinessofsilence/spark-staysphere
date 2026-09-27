import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { catalogService, communicationsService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT } from '@/lib/i18n/admin/translate';
import { lDateRange, lDateShort } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { ConversationList } from './conversation-list';
import { NewConversationButton, type BookingOption } from './new-conversation-button';
import { Thread, type ThreadStay } from './thread';

/**
 * The inbox, shared by `/admin/communications` and `/admin/communications/[id]`.
 * It is the one admin screen without the page header and the page's own
 * scroll: like a messenger, the thread list and the open thread fill the
 * viewport edge to edge, each scrolling inside its own column — a desk sees
 * both, a phone sees the list at the index and the thread on its own
 * route with an arrow back. Same data either way, so the two pages are
 * one component.
 */
export async function Inbox({ currentId }: { currentId: string | null }) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const hotelSlug = await getSelectedHotelSlug();
  const [conversations, thread, hotel] = await Promise.all([
    communicationsService.listConversations(hotelSlug),
    currentId ? communicationsService.openThread(hotelSlug, currentId) : Promise.resolve(null),
    catalogService.getHotel(hotelSlug),
  ]);
  const [allBookings, rooms] = await Promise.all([hotelRepository.listBookings(), hotelRepository.listRooms(hotel.id)]);
  const roomName = new Map(rooms.map((room) => [room.id, room.name]));
  const hotelBookings = allBookings.filter((booking) => booking.hotelId === hotel.id);

  const bookings: BookingOption[] = hotelBookings
    .filter((booking) => booking.status === 'confirmed')
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
    .slice(0, 60)
    .map((booking) => ({
      reference: booking.reference,
      label: `${booking.guest.firstName} ${booking.guest.lastName} · ${booking.reference} · ${lDateShort(booking.checkIn, locale)}`,
    }));

  const stayBooking = thread?.conversation.bookingReference
    ? hotelBookings.find((booking) => booking.reference === thread.conversation.bookingReference)
    : undefined;
  const stay: ThreadStay | null = stayBooking
    ? {
        reference: stayBooking.reference,
        roomName: roomName.get(stayBooking.roomTypeId) ?? stayBooking.roomTypeId,
        dates: lDateRange(stayBooking.checkIn, stayBooking.checkOut, locale),
      }
    : null;
  const unread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    // The shell's phone top bar is 3.5rem tall in 0.75rem of padding, so 5rem
    // is what sits above this on a phone; the desk's sidebar column has only
    // the 0.75rem gutter, matched here so the two cards align.
    <main id="main" className="p-3 lg:pl-0">
      <div className="grid h-[calc(100dvh-6.5rem)] grid-cols-1 overflow-hidden rounded-[18px] bg-card shadow-soft lg:h-[calc(100dvh-1.5rem)] lg:grid-cols-sidebar-start">
        <aside className={cn('min-h-0 min-w-0 overflow-hidden border-border lg:border-r', currentId ? 'hidden lg:flex lg:flex-col' : 'flex flex-col')}>
          <ConversationList conversations={conversations} currentId={currentId} action={<NewConversationButton bookings={bookings} compact />} />
        </aside>
        <section className={cn('min-h-0 min-w-0', currentId ? 'flex flex-col' : 'hidden lg:flex lg:flex-col')} aria-label={thread?.conversation.guestName ?? t('comms.pick')}>
          {thread ? (
            <Thread conversation={thread.conversation} messages={thread.messages} stay={stay} />
          ) : (
            <div className="grid flex-1 place-content-center bg-stone/30 p-8 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-base font-medium">{currentId ? t('comms.errorNotFound') : t('comms.pick')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentId ? '' : unread > 0 ? t('comms.unread', { count: String(unread) }) : t('comms.pickBody')}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
