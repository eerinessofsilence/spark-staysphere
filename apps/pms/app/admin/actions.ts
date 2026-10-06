'use server';

import { requireBackOfficeSession, requirePermission } from '@/lib/application/admin-session';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { availableHotels, contentService, DEMO_HOTEL_SLUG, demoControl, sampleBookingService, sampleDocumentService } from '@/lib/application/container';
import { getSelectedHotelSlug, SELECTED_HOTEL_COOKIE } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { roomStatusSchema } from '@/lib/domain/schemas';
import { ADMIN_LOCALE_COOKIE, isAdminLocale } from '@/lib/i18n/admin/locale';
import { z } from 'zod';

/**
 * Demo inventory controls. `setRoomStatus`/`resetDemoState` write to the
 * DemoControlPort only; a production admin writes through the PMS adapter
 * and never touches availability directly. The add-on on-sale switch lives
 * in `app/admin/content/add-ons/[id]/actions.ts` (`setAddOnOnSaleAction`)
 * instead — both the add-on's own page and the list here pass it into the
 * same `AddOnToggle`/`AddOnSaleToggle` components, so there is one save path
 * and one way to report a conflict, not two that could disagree.
 */

const overrideSchema = z.object({
  roomTypeId: z.string().min(1),
  status: z.union([roomStatusSchema, z.literal('auto')]),
});

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/admin/content');
  revalidatePath('/admin/rates');
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/front-desk');
  revalidatePath('/admin/accounting');
  revalidatePath('/');
}

export async function setRoomStatus(input: z.infer<typeof overrideSchema>): Promise<void> {
  await requirePermission('team.permEditRates');
  const parsed = overrideSchema.parse(input);
  await demoControl.setRoomStatusOverride(
    parsed.roomTypeId,
    parsed.status === 'auto' ? null : parsed.status,
  );
  refresh();
}

/** A dozen past, in-house, upcoming and cancelled stays, so an empty demo has something to show. */
export async function addSampleBookings(): Promise<{ created: number }> {
  await requireBackOfficeSession();
  const hotelSlug = await getSelectedHotelSlug();
  const result = await sampleBookingService.seed(hotelSlug, toIsoDate(new Date()));
  refresh();
  return result;
}

/** Provisions the public Guest showcase only in the fixed demo hotel. */
export async function provisionGuestShowcase(): Promise<{ available: number }> {
  await requirePermission('team.permViewBookings');
  const bookings = await sampleBookingService.seedShowcase(DEMO_HOTEL_SLUG, toIsoDate(new Date()));
  revalidatePath('/admin/bookings');
  return { available: bookings.length };
}

/** Every property at once, not just the selected one: the switcher shouldn't land on an empty documents grid anywhere. */
export async function addSampleDocuments(): Promise<{ created: number }> {
  await requirePermission('team.permViewBookings');
  const result = await sampleDocumentService.seedAll(
    availableHotels.map((hotel) => hotel.slug),
    toIsoDate(new Date()),
  );
  revalidatePath('/admin/documents');
  revalidatePath('/admin/guests');
  refresh();
  return result;
}

export async function resetDemoState(): Promise<void> {
  await requirePermission('team.permBrandDomain');
  await demoControl.reset();
  await contentService.resetContent();
  refresh();
}

/** Switches which seed hotel `/admin` reads and writes through — see `hotel-context.ts`. */
export async function setSelectedHotelAction(slug: string): Promise<void> {
  await requireBackOfficeSession();
  if (!availableHotels.some((hotel) => hotel.slug === slug)) return;
  const store = await cookies();
  store.set(SELECTED_HOTEL_COOKIE, slug, { path: '/admin', maxAge: 60 * 60 * 24 * 365 });
  // The sidebar's own hotel name/location come from app/admin/layout.tsx, which
  // sits above every page `refresh()` revalidates — without this, the pages
  // below picked up the new hotel but the shell around them kept showing the old one.
  revalidatePath('/admin', 'layout');
  refresh();
}

/** The team member's language for the back office — see `lib/i18n/admin/locale.ts`. Picked on `/admin/account`. */
export async function setAdminLocaleAction(locale: string): Promise<void> {
  if (!isAdminLocale(locale)) return;
  const store = await cookies();
  store.set(ADMIN_LOCALE_COOKIE, locale, { path: '/admin', maxAge: 60 * 60 * 24 * 365 });
  // The shell's own words come from the layout; every screen below re-renders with it.
  revalidatePath('/admin', 'layout');
}
