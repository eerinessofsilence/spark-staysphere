import type { AutomationSettingsStore, EmailAutomationKind, HotelRepository } from '../domain/ports';
import { EMAIL_AUTOMATION_KINDS } from '../domain/ports';
import type { Booking } from '../domain/schemas';
import type { CommunicationsService } from './communications-service';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

function formatMoney(amount: number, currency: Booking['currency']): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function guestFirstName(booking: Booking): string {
  return booking.guest.firstName;
}

const TEMPLATES: Record<EmailAutomationKind, (booking: Booking, hotelName: string) => { subject: string; body: string }> = {
  booking_confirmed: (booking, hotelName) => ({
    subject: `Booking confirmed — ${hotelName}`,
    body: [
      `Hi ${guestFirstName(booking)},`,
      '',
      `Your stay at ${hotelName} is confirmed.`,
      '',
      `Reference: ${booking.reference}`,
      `Check-in: ${formatDate(booking.checkIn)}`,
      `Check-out: ${formatDate(booking.checkOut)}`,
      `Total: ${formatMoney(booking.total, booking.currency)}`,
      '',
      `See you soon,`,
      hotelName,
    ].join('\n'),
  }),
  arrival_reminder: (booking, hotelName) => ({
    subject: `See you tomorrow — ${hotelName}`,
    body: [
      `Hi ${guestFirstName(booking)},`,
      '',
      `A quick reminder that your stay at ${hotelName} begins tomorrow, ${formatDate(booking.checkIn)}.`,
      '',
      `Reference: ${booking.reference}`,
      `Check-out: ${formatDate(booking.checkOut)}`,
      '',
      `Safe travels,`,
      hotelName,
    ].join('\n'),
  }),
  booking_cancelled: (booking, hotelName) => ({
    subject: `Booking cancelled — ${hotelName}`,
    body: [
      `Hi ${guestFirstName(booking)},`,
      '',
      `Your booking at ${hotelName} has been cancelled, and the room is back on sale.`,
      '',
      `Reference: ${booking.reference}`,
      `Dates: ${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}`,
      '',
      `If this wasn't you, please reply to this email.`,
      hotelName,
    ].join('\n'),
  }),
  checked_out: (booking, hotelName) => ({
    subject: `Thank you for staying with us — ${hotelName}`,
    body: [
      `Hi ${guestFirstName(booking)},`,
      '',
      `Thank you for staying at ${hotelName}. We hope you had a wonderful time.`,
      '',
      `Reference: ${booking.reference}`,
      '',
      `We'd love to see you again,`,
      hotelName,
    ].join('\n'),
  }),
};

/**
 * Booking-lifecycle emails that leave with no desk member involved:
 * confirmation, an arrival reminder the day before check-in, a cancellation
 * notice, and a thank-you after check-out. Each is a per-hotel on/off switch
 * (`/admin/settings/automations`), defaulting to on so a hotel that never
 * visited the screen still gets them. Delivery reuses `CommunicationsService`
 * so a sent automation shows up in the guest's own thread — the desk sees
 * what went out and when, the same as a reply it typed itself.
 */
export class EmailAutomationsService {
  constructor(
    private readonly settings: AutomationSettingsStore,
    private readonly repository: HotelRepository,
    private readonly communications: CommunicationsService,
    /** A booking carries a hotel *id*; `getHotel` only takes a *slug*. Identity is seed-fixed (see CLAUDE.md), so a static map is enough — never a CMS-edited field. */
    private readonly hotelSlugById: ReadonlyMap<string, string>,
  ) {}

  async listSettings(hotelSlug: string): Promise<Record<EmailAutomationKind, boolean>> {
    const hotel = await this.repository.getHotel(hotelSlug);
    const stored = hotel ? await this.settings.list(hotel.id) : {};
    const settings = {} as Record<EmailAutomationKind, boolean>;
    for (const kind of EMAIL_AUTOMATION_KINDS) settings[kind] = stored[kind] ?? true;
    return settings;
  }

  async setEnabled(hotelSlug: string, kind: EmailAutomationKind, enabled: boolean): Promise<boolean> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return false;
    await this.settings.set(hotel.id, kind, enabled);
    return true;
  }

  private async notify(booking: Booking, kind: EmailAutomationKind): Promise<void> {
    const hotelSlug = this.hotelSlugById.get(booking.hotelId);
    if (!hotelSlug) return;
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return;
    const stored = await this.settings.list(hotel.id);
    if (!(stored[kind] ?? true)) return;
    const { subject, body } = TEMPLATES[kind](booking, hotel.name);
    await this.communications.sendSystemEmail(hotelSlug, booking.reference, subject, body, 'Automations');
  }

  /** After `BookingService.confirm()` persists a paid, confirmed stay. */
  notifyConfirmed(booking: Booking): Promise<void> {
    return this.notify(booking, 'booking_confirmed');
  }

  /** After a guest or the desk cancels a still-upcoming stay. */
  notifyCancelled(booking: Booking): Promise<void> {
    return this.notify(booking, 'booking_cancelled');
  }

  /** After the desk marks a stay checked out. */
  notifyCheckedOut(booking: Booking): Promise<void> {
    return this.notify(booking, 'checked_out');
  }

  /**
   * The daily cron's own entry point (`/api/internal/arrival-reminders`):
   * every confirmed, still-booked stay whose check-in is exactly `tomorrow`
   * gets one reminder. Firing once for the single day that equality holds
   * is what keeps this idempotent without a separate "already sent" marker.
   */
  async sendArrivalReminders(bookings: Booking[], tomorrow: string): Promise<number> {
    const due = bookings.filter((booking) => booking.status === 'confirmed' && booking.stayState === 'booked' && booking.checkIn === tomorrow);
    for (const booking of due) await this.notify(booking, 'arrival_reminder');
    return due.length;
  }
}
