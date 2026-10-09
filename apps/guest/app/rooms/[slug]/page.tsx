import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEMO_HOTEL_SLUG } from '@/lib/application/guest-config';
import { getPublicHotel, getPublicRoomDetail, PmsApiError } from '@/lib/application/pms-api';
import { parseAddOnIds, parseCriteria } from '@/lib/application/search-params';
import { RoomDetailView } from '@/components/rooms/room-detail-view';

export async function generateMetadata({ params }: PageProps<'/rooms/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug.replace(/-/g, ' ')} — Asteria Cove | SPARK StaySphere 360` };
}

export default async function RoomDetailPage({ params, searchParams }: PageProps<'/rooms/[slug]'>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const criteria = parseCriteria(query);
  const addOnIds = parseAddOnIds(query);

  const [detail, hotel] = await Promise.all([
    getPublicRoomDetail(DEMO_HOTEL_SLUG, slug, criteria, addOnIds).catch((error: unknown) => {
      if (error instanceof PmsApiError && error.status === 404) notFound();
      throw error;
    }),
    getPublicHotel(DEMO_HOTEL_SLUG),
  ]);

  const { offer, addOns, quote } = detail;

  return <RoomDetailView offer={offer} hotel={hotel} addOns={addOns} quote={quote} criteria={criteria} />;
}
