import type { GuestIdentity } from '../domain/guest-document';
import type { HotelRepository } from '../domain/ports';
import type { Booking } from '../domain/schemas';
import type { GuestDocumentService } from './guest-document-service';
import { sampleDocumentImage } from './sample-document-image';
import type { SampleBookingService } from './sample-bookings';

const COUNTRIES = ['CYP', 'GBR', 'DEU', 'ESP', 'ITA', 'FRA', 'NLD', 'SWE'];
const GENDERS = ['M', 'F', 'X'] as const;
/** Enough to fill the grid's first row and show both document types, not every stay on the books. */
const PER_HOTEL = 6;

function hash(input: string): number {
  let h = 2166136261;
  for (const ch of input) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Obviously synthetic passport fields for a sample stay's guest, derived
 * from the booking id so the same stay always gets the same document and
 * nothing here resembles a real one: `SAMPLE…` numbers, a made-up but
 * valid date of birth, a country drawn from a short list.
 */
export function sampleIdentity(booking: Booking): GuestIdentity {
  const h = hash(booking.id);
  const country = COUNTRIES[h % COUNTRIES.length]!;
  const month = pad(1 + (h % 12));
  const day = pad(1 + (h % 28));
  const issueYear = Number(booking.checkIn.slice(0, 4)) - 1 - (h % 6);
  return {
    firstName: booking.guest.firstName.toUpperCase(),
    lastName: booking.guest.lastName.toUpperCase(),
    dateOfBirth: `${1962 + (h % 36)}-${month}-${day}`,
    nationality: country,
    gender: GENDERS[h % GENDERS.length]!,
    documentNumber: `SAMPLE${100000 + (h % 900000)}`,
    documentType: h % 4 === 0 ? 'id' : 'passport',
    issueDate: `${issueYear}-${month}-${day}`,
    expirationDate: `${issueYear + 10}-${month}-${day}`,
    issuingCountry: country,
  };
}

/**
 * Fills `/admin/documents` the way `SampleBookingService` fills the desk:
 * a synthetic passport on a handful of each hotel's current and upcoming
 * stays, through the same `attach` the front desk's scanner uses, so the
 * result obeys every rule a real scan does — private storage, the
 * check-out erasure, the per-property scope. Seeds the sample stays first
 * so a hotel nobody has booked yet still gets something to show.
 */
export class SampleDocumentService {
  constructor(
    private readonly repository: HotelRepository,
    private readonly documents: GuestDocumentService,
    private readonly sampleBookings: SampleBookingService,
  ) {}

  /** Idempotent: a stay with any document record already — live, pending deletion or retired — is left alone. */
  async seed(hotelSlug: string, today: string): Promise<{ created: number }> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return { created: 0 };
    await this.sampleBookings.seed(hotelSlug, today);
    const documented = new Set((await this.documents.listAll(hotel.id)).map((document) => document.reservationId));
    // Current and upcoming stays first, then stays that were never checked
    // out (a sample seeded weeks ago is mostly those by now), newest first —
    // `attach` refuses only a checked-out stay, and the grid should not be
    // one lonely card on a hotel whose samples have aged past today.
    const upcoming = (booking: Booking) => (booking.checkOut > today ? 0 : 1);
    const stays = (await this.repository.listBookings())
      .filter(
        (booking) =>
          booking.hotelId === hotel.id &&
          booking.status === 'confirmed' &&
          (booking.stayState === 'booked' || booking.stayState === 'checked_in') &&
          !documented.has(booking.id),
      )
      .sort((a, b) => upcoming(a) - upcoming(b) || (upcoming(a) === 0 ? a.checkIn.localeCompare(b.checkIn) : b.checkOut.localeCompare(a.checkOut)))
      .slice(0, PER_HOTEL);

    for (const booking of stays) {
      await this.documents.attach(booking, sampleIdentity(booking), sampleDocumentImage());
    }
    return { created: stays.length };
  }

  /** Every property at once — the switcher shouldn't land on an empty grid anywhere. */
  async seedAll(hotelSlugs: string[], today: string): Promise<{ created: number }> {
    let created = 0;
    for (const slug of hotelSlugs) created += (await this.seed(slug, today)).created;
    return { created };
  }
}
