import type { Metadata } from 'next';
import { IdentificationIcon } from '@heroicons/react/24/outline';
import { catalogService, guestDocumentService, hotelRepository } from '@/lib/application/container';
import { requirePermission } from '@/lib/application/admin-session';
import { buildGuestDirectory } from '@/lib/application/guest-directory';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { DocumentsGrid, type DocumentTile } from '@/components/admin/operations/documents-grid';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.documents')) };
}

export default async function DocumentsPage() {
  await requirePermission('team.permViewBookings');
  const locale = await getAdminLocale();
  const t = adminT(locale);

  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const [documents, allBookings, profiles] = await Promise.all([
    guestDocumentService.listAll(hotel.id),
    hotelRepository.listBookings(),
    hotelRepository.listGuestProfiles(hotel.id),
  ]);
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const directory = buildGuestDirectory(bookings, profiles, hotel.currency);
  const nameById = new Map(directory.map((guest) => [guest.id, `${guest.firstName} ${guest.lastName}`.trim()]));

  const tiles: DocumentTile[] = documents.map(({ objectKeys: _keys, hotelId: _hotel, ...document }) => ({
    ...document,
    guestName: nameById.get(document.guestId) ?? document.guestId,
  }));

  return (
    <AdminPage>
      <AdminPageHeader title={t('nav.documents')} />

      {tiles.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
          <IdentificationIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-display text-2xl">{t('documents.emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('documents.emptyBody')}</p>
          </div>
        </div>
      ) : (
        <DocumentsGrid documents={tiles} />
      )}
    </AdminPage>
  );
}
