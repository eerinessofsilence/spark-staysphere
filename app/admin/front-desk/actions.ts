'use server';

import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { confirmForSlug, quoteForSlug } from '@/lib/application/booking-intake';
import type { BookingErrorCode } from '@/lib/application/booking-service';
import { getAdminT } from '@/lib/i18n/admin/server';
import { guestSchema, paymentMethodSchema, ROOM_NUMBER, stayCriteriaFieldsSchema, type Currency } from '@/lib/domain/schemas';
import { mapBookingError } from '@/app/api/_lib/http';
import { bookingService, catalogService, guestDocumentService, hotelRepository } from '@/lib/application/container';
import { identitySchema, identityKey, documentImageType, MAX_DOCUMENT_BYTES } from '@/lib/domain/guest-document';

/**
 * Turns either a drag across a room's empty nights on the front desk
 * (`FrontDeskGrid`) or the toolbar's own "Add booking" (`AddBookingButton`,
 * room type and dates picked by hand, no specific room) into a booking — the
 * desk's equivalent of the guest's own multi-step flow, collapsed into one
 * form since a team member is trusted the way `BookingService.cancelAsHotel`
 * already trusts it (no email check). It goes through the same
 * `booking-intake.ts` used by the guest server actions and the HTTP routes:
 * price and availability are always re-derived on the server. A drag pins
 * the exact room with `unitNumber`, the same field a guest's own floor-plan
 * pick sets; the toolbar's own form leaves it unset, the same as a guest who
 * books a room type without choosing one — any free room of that type is
 * assigned the way it always is.
 *
 * Payment method is picked on the form, defaulting to "pay at the hotel" —
 * the desk's own most common case, since a team member booking a stay
 * directly has not taken a card number over the phone, and this demo has no
 * real card capture to hand them one — see CLAUDE.md's "Live payment is out
 * of scope". Card and the two wallets still run through the same simulated
 * authorization every guest checkout does (`AUTHORIZING_METHODS` in
 * `booking-service.ts`); a transfer or paying at the desk records a pending
 * attempt instead. The stay itself is always created `confirmed` regardless
 * of method — only the payment attempt's own status differs.
 */

const quoteSchema = z.object({
  roomSlug: z.string().min(1),
  checkIn: stayCriteriaFieldsSchema.shape.checkIn,
  checkOut: stayCriteriaFieldsSchema.shape.checkOut,
  adults: stayCriteriaFieldsSchema.shape.adults,
  children: stayCriteriaFieldsSchema.shape.children,
});

const createSchema = quoteSchema.extend({
  requestId: z.string().uuid().optional(),
  identity: identitySchema.optional(),
  /** Set by a drag onto a specific room's row; omitted by the toolbar's own form. */
  unitNumber: z.string().regex(ROOM_NUMBER).optional(),
  guest: guestSchema,
  /** Picked on the form; defaults to the desk's own most common case — see this file's doc comment. */
  paymentMethod: paymentMethodSchema.default('pay_at_hotel'),
});

export type FrontDeskQuoteResult =
  | { ok: true; total: number; currency: Currency; nights: number; nightlyPrice: number }
  | { ok: false; message: string };

export type FrontDeskBookingResult =
  | { ok: true; reference: string; message: string }
  | { ok: false; code: BookingErrorCode | 'invalid_request'; message: string; fieldErrors?: Record<string, string[]>; createdReference?: string };

/** The price line the create-booking form shows before anything is written — informational, not trusted at submit time. */
export async function quoteFrontDeskBookingAction(input: unknown): Promise<FrontDeskQuoteResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t('frontDesk.bookingInvalidStay') };

  try {
    const hotelSlug = await getSelectedHotelSlug();
    const quote = await quoteForSlug({ ...parsed.data, addOnIds: [] }, hotelSlug);
    if (!quote.available) return { ok: false, message: t('frontDesk.bookingUnavailable') };
    return { ok: true, total: quote.price.total, currency: quote.price.currency, nights: quote.price.nights, nightlyPrice: quote.price.nightlyPrice };
  } catch (error) {
    const mapped = mapBookingError(error);
    return { ok: false, message: mapped.kind === 'unknown' ? t('frontDesk.bookingQuoteFailed') : mapped.message };
  }
}

export async function createFrontDeskBookingAction(input: unknown, documentUpload?: FormData): Promise<FrontDeskBookingResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permViewBookings');
  } catch (error) {
    if (error instanceof AdminPermissionError) {
      return { ok: false, code: 'invalid_request', message: t('team.permissionDenied') };
    }
    throw error;
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path.at(-1) ?? 'form');
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { ok: false, code: 'invalid_request', message: t('frontDesk.bookingCheckFields'), fieldErrors };
  }

  try {
    const hotelSlug = await getSelectedHotelSlug();
    const hotel = await catalogService.getHotel(hotelSlug);
    const key = `frontdesk_${hotel.id}_${parsed.data.requestId ?? crypto.randomUUID()}`;
    const existing = await bookingService.findByIdempotencyKey(key);
    if (existing && (existing.hotelId !== hotel.id || existing.guest.email.trim().toLowerCase() !== parsed.data.guest.email.trim().toLowerCase())) {
      return { ok: false, code: 'invalid_request', message: 'This booking request belongs to another guest.' };
    }
    let documentBytes: ArrayBuffer | undefined;
    if (parsed.data.identity) {
      const profile = (await hotelRepository.listGuestProfiles(hotel.id)).find((guest) => guest.email.trim().toLowerCase() === parsed.data.guest.email.trim().toLowerCase());
      if (!profile?.identity || identityKey(profile.identity) !== identityKey(parsed.data.identity)) return { ok: false, code: 'invalid_request', message: 'Review and confirm this document for the selected guest first.' };
      const file = documentUpload?.get('photo');
      if (!(file instanceof File) || file.size > MAX_DOCUMENT_BYTES || file.size === 0) return { ok: false, code: 'invalid_request', message: 'Attach a JPEG or PNG document up to 8 MB.' };
      documentBytes = await file.arrayBuffer();
      if (!documentImageType(new Uint8Array(documentBytes))) return { ok: false, code: 'invalid_request', message: 'Use a JPEG or PNG document.' };
    }
    // Quoted and confirmed in the same request: the total shown a moment ago
    // in the form is never trusted back — see `booking-intake.ts`.
    const quote = existing ? null : await quoteForSlug({ ...parsed.data, addOnIds: [] }, hotelSlug);
    if (quote && !quote.available) {
      return { ok: false, code: 'unavailable', message: t('frontDesk.bookingUnavailable') };
    }

    const booking = existing ?? await confirmForSlug(
      {
        roomSlug: parsed.data.roomSlug,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        adults: parsed.data.adults,
        children: parsed.data.children,
        addOnIds: [],
        guest: parsed.data.guest,
        unitNumber: parsed.data.unitNumber,
        expectedTotal: quote!.price.total,
        paymentMethod: parsed.data.paymentMethod,
      },
      key,
      hotelSlug,
    );

    if (parsed.data.identity && documentBytes) {
      try { await guestDocumentService.attach(booking, parsed.data.identity, documentBytes); }
      catch { return { ok: false, code: 'invalid_request', createdReference: booking.reference, message: `Booking ${booking.reference} is created, but the document could not be saved. Retry with this form to attach it without creating another booking.` }; }
    }

    revalidatePath('/admin');
    revalidatePath('/admin/front-desk');
    revalidatePath('/admin/bookings');
    revalidatePath('/admin/guests');
    revalidatePath('/admin/guests/[id]', 'page');
    revalidatePath('/admin/bookings/[reference]', 'page');
    revalidatePath('/admin/rates');
    revalidatePath('/admin/accounting');
    revalidatePath('/rooms');

    return { ok: true, reference: booking.reference, message: t('frontDesk.bookingCreated', { reference: booking.reference }) };
  } catch (error) {
    const mapped = mapBookingError(error);
    if (mapped.kind === 'booking') {
      return { ok: false, code: mapped.code, message: mapped.message, fieldErrors: mapped.fieldErrors };
    }
    if (mapped.kind === 'not_found') return { ok: false, code: 'not_found', message: mapped.message };
    // This request may contain identity data: never log input or provider errors.
    return { ok: false, code: 'invalid_request', message: t('frontDesk.bookingFailed') };
  }
}
