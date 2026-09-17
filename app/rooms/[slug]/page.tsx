import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RoomNotFoundError } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
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
    catalogService.getRoomDetail(DEMO_HOTEL_SLUG, slug, criteria, addOnIds).catch((error: unknown) => {
      if (error instanceof RoomNotFoundError) notFound();
      throw error;
    }),
    catalogService.getHotel(DEMO_HOTEL_SLUG),
  ]);

  const { offer, addOns, quote } = detail;

  return <RoomDetailView offer={offer} hotel={hotel} addOns={addOns} quote={quote} criteria={criteria} />;
}
