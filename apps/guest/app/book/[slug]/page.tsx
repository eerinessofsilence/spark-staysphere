import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEMO_HOTEL_SLUG } from '@/lib/application/guest-config';
import { getPublicRoomDetail, isPublicUnitAvailable, PmsApiError } from '@/lib/application/pms-api';
import {
  buildQuery,
  parseAddOnIds,
  parseCriteria,
  parseRoomNumber,
  toIsoDate,
} from '@/lib/application/search-params';
import { BookView } from '@/components/booking/book-view';

export const metadata: Metadata = {
  title: 'Book your stay — Asteria Cove | SPARK StaySphere 360',
  description: 'Complete a booking at Asteria Cove — payment is simulated and nothing is charged.',
};

export default async function BookPage({ params, searchParams }: PageProps<'/book/[slug]'>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const criteria = parseCriteria(query);
  const addOnIds = parseAddOnIds(query);

  const detail = await getPublicRoomDetail(DEMO_HOTEL_SLUG, slug, criteria, addOnIds)
    .catch((error: unknown) => {
      if (error instanceof PmsApiError && error.status === 404) notFound();
      throw error;
    });

  const stayQuery = buildQuery({ criteria, addOnIds: detail.quote.addOnIds });
  const requestedRoom = parseRoomNumber(query);
  const roomIsFree = requestedRoom
    ? await isPublicUnitAvailable(
        DEMO_HOTEL_SLUG,
        detail.offer.room.id,
        requestedRoom,
        criteria.checkIn,
        criteria.checkOut,
      )
    : false;
  const roomNumber = requestedRoom && roomIsFree ? requestedRoom : null;

  return (
    <BookView
      hotel={detail.hotel}
      room={detail.offer.room}
      ratePlan={detail.offer.ratePlan}
      addOns={detail.addOns}
      criteria={criteria}
      initialQuote={detail.quote}
      initialAddOnIds={detail.quote.addOnIds}
      minDate={toIsoDate(new Date())}
      roomNumber={roomNumber}
      requestedRoom={requestedRoom}
      stayQuery={stayQuery}
    />
  );
}
