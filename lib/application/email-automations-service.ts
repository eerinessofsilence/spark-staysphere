import type { AutomationRuleStore, AutomationSendLogStore, AutomationTrigger, EmailAutomationRule, HotelRepository } from '../domain/ports';
import type { Booking, Currency } from '../domain/schemas';
import type { CommunicationsService } from './communications-service';
import { renderAutomationEmailHtml } from './email-html';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

/** `addDays(iso, -3)` steps back; `addDays(iso, 3)` steps forward — both across month and year boundaries, in UTC so a date never shifts with the server's own timezone. */
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The tokens a subject or body can carry, and what each resolves to for a
 * given booking — the whole of what a hotel team can put in an
 * automation's text, shown next to the editor on `/admin/settings/automations`.
 */
export const AUTOMATION_PLACEHOLDERS = ['guestFirstName', 'guestLastName', 'reference', 'checkIn', 'checkOut', 'total', 'hotelName'] as const;
export type AutomationPlaceholder = (typeof AUTOMATION_PLACEHOLDERS)[number];

function placeholderValues(booking: Booking, hotelName: string): Record<AutomationPlaceholder, string> {
  return {
    guestFirstName: booking.guest.firstName,
    guestLastName: booking.guest.lastName,
    reference: booking.reference,
    checkIn: formatDate(booking.checkIn),
    checkOut: formatDate(booking.checkOut),
    total: formatMoney(booking.total, booking.currency),
    hotelName,
  };
}

/** `{{guestFirstName}}` → the guest's first name, and so on for every key in `values`; an unknown token is left as-is rather than silently dropped. */
function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * A stand-in stay for the "what will guests get" preview
 * (`/admin/settings/automations`) — never persisted, never sent. Dates sit a
 * fixed distance from `today` so the preview is stable within a day rather
 * than reading differently on every render.
 */
function sampleBooking(hotelId: string, currency: Currency): Booking {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: 'preview',
    reference: 'SC-PREVIEW',
    idempotencyKey: 'preview',
    hotelId,
    roomTypeId: 'preview',
    ratePlanId: 'preview',
    checkIn: addDays(today, 7),
    checkOut: addDays(today, 10),
    adults: 2,
    children: 0,
    guest: { firstName: 'Alex', lastName: 'Morgan', email: 'alex.morgan@example.com', phone: '+1 555 0100' },
    addOnIds: [],
    total: 480,
    currency,
    status: 'confirmed',
    stayState: 'booked',
    createdAt: new Date().toISOString(),
  };
}

/** The four automations the product ships with — always present for a hotel, even one that never visited the settings screen. */
function builtInDefaults(hotelId: string): EmailAutomationRule[] {
  const now = new Date(0).toISOString();
  const rule = (id: string, trigger: AutomationTrigger, subject: string, body: string): EmailAutomationRule => ({
    id,
    hotelId,
    trigger,
    enabled: true,
    subject,
    body,
    builtIn: true,
    updatedAt: now,
  });
  return [
    rule(
      'builtin_booking_confirmed',
      { kind: 'booking_confirmed' },
      'Booking confirmed — {{hotelName}}',
      'Hi {{guestFirstName}},\n\nYour stay at {{hotelName}} is confirmed.\n\nReference: {{reference}}\nCheck-in: {{checkIn}}\nCheck-out: {{checkOut}}\nTotal: {{total}}\n\nSee you soon,\n{{hotelName}}',
    ),
    rule(
      'builtin_arrival_reminder',
      { kind: 'before_check_in', days: 1 },
      'See you tomorrow — {{hotelName}}',
      'Hi {{guestFirstName}},\n\nA quick reminder that your stay at {{hotelName}} begins tomorrow, {{checkIn}}.\n\nReference: {{reference}}\nCheck-out: {{checkOut}}\n\nSafe travels,\n{{hotelName}}',
    ),
    rule(
      'builtin_booking_cancelled',
      { kind: 'booking_cancelled' },
      'Booking cancelled — {{hotelName}}',
      "Hi {{guestFirstName}},\n\nYour booking at {{hotelName}} has been cancelled, and the room is back on sale.\n\nReference: {{reference}}\nDates: {{checkIn}} → {{checkOut}}\n\nIf this wasn't you, please reply to this email.\n{{hotelName}}",
    ),
    rule(
      'builtin_checked_out',
      { kind: 'checked_out' },
      'Thank you for staying with us — {{hotelName}}',
      "Hi {{guestFirstName}},\n\nThank you for staying at {{hotelName}}. We hope you had a wonderful time.\n\nReference: {{reference}}\n\nWe'd love to see you again,\n{{hotelName}}",
    ),
  ];
}

/** The four built-ins merged with whatever is stored: a stored row wins over its default, and a hotel that never touched the screen still gets all four, on. */
function withBuiltIns(hotelId: string, stored: EmailAutomationRule[]): EmailAutomationRule[] {
  const byId = new Map(stored.map((rule) => [rule.id, rule]));
  const merged = builtInDefaults(hotelId).map((fallback) => byId.get(fallback.id) ?? fallback);
  const custom = stored.filter((rule) => !rule.builtIn);
  return [...merged, ...custom];
}

export interface SaveRuleInput {
  /** Present when editing; absent when creating a new custom rule. */
  id?: string;
  trigger: AutomationTrigger;
  subject: string;
  body: string;
  enabled: boolean;
}

export type SaveRuleResult = { ok: true; rule: EmailAutomationRule } | { ok: false; message: 'hotelNotFound' | 'notFound' | 'triggerLocked' | 'invalid' };

/**
 * Booking-lifecycle emails that leave with no desk member involved: the four
 * the product ships with, plus whatever a hotel team builds on
 * `/admin/settings/automations` — a custom rule off the same five triggers,
 * with its own subject and body. Delivery reuses `CommunicationsService` so
 * a sent automation shows up in the guest's own thread — the desk sees what
 * went out and when, the same as a reply it typed itself.
 */
export class EmailAutomationsService {
  constructor(
    private readonly rules: AutomationRuleStore,
    private readonly sendLog: AutomationSendLogStore,
    private readonly repository: HotelRepository,
    private readonly communications: CommunicationsService,
    /** A booking carries a hotel *id*; `getHotel` only takes a *slug*. Identity is seed-fixed (see CLAUDE.md), so a static map is enough — never a CMS-edited field. */
    private readonly hotelSlugById: ReadonlyMap<string, string>,
  ) {}

  async listRules(hotelSlug: string): Promise<EmailAutomationRule[]> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return [];
    const stored = await this.rules.list(hotel.id);
    return withBuiltIns(hotel.id, stored);
  }

  async setEnabled(hotelSlug: string, id: string, enabled: boolean): Promise<boolean> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return false;
    const existing = (await this.listRules(hotelSlug)).find((rule) => rule.id === id);
    if (!existing) return false;
    await this.rules.upsert({ ...existing, enabled, updatedAt: new Date().toISOString() });
    return true;
  }

  /** Creates a custom rule (no `id`) or updates an existing one — a built-in's trigger *kind* can't move, only its `days`, subject, body and switch. */
  async saveRule(hotelSlug: string, input: SaveRuleInput): Promise<SaveRuleResult> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return { ok: false, message: 'hotelNotFound' };
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (!subject || !body) return { ok: false, message: 'invalid' };
    if ((input.trigger.kind === 'before_check_in' || input.trigger.kind === 'after_check_out') && !(input.trigger.days && input.trigger.days > 0)) {
      return { ok: false, message: 'invalid' };
    }

    if (input.id) {
      const existing = (await this.listRules(hotelSlug)).find((rule) => rule.id === input.id);
      if (!existing) return { ok: false, message: 'notFound' };
      if (existing.builtIn && existing.trigger.kind !== input.trigger.kind) return { ok: false, message: 'triggerLocked' };
      const rule: EmailAutomationRule = { ...existing, trigger: input.trigger, subject, body, enabled: input.enabled, updatedAt: new Date().toISOString() };
      await this.rules.upsert(rule);
      return { ok: true, rule };
    }

    const rule: EmailAutomationRule = {
      id: `auto_${crypto.randomUUID()}`,
      hotelId: hotel.id,
      trigger: input.trigger,
      enabled: input.enabled,
      subject,
      body,
      builtIn: false,
      updatedAt: new Date().toISOString(),
    };
    await this.rules.upsert(rule);
    return { ok: true, rule };
  }

  /** Built-in rules ship with the product and can't be removed — only a custom rule can. */
  async deleteRule(hotelSlug: string, id: string): Promise<boolean> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return false;
    const existing = (await this.listRules(hotelSlug)).find((rule) => rule.id === id);
    if (!existing || existing.builtIn) return false;
    await this.rules.delete(hotel.id, id);
    return true;
  }

  /**
   * Subject and body a guest would actually receive for `id`, rendered
   * against a fabricated stay — never persisted, never sent — so the
   * settings screen can show the team what they're switching on before a
   * real booking ever triggers it.
   */
  async preview(hotelSlug: string, ruleOrTemplate: string | { trigger: AutomationTrigger; subject: string; body: string }): Promise<{ subject: string; body: string; html: string } | null> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return null;
    const template = typeof ruleOrTemplate === 'string' ? (await this.listRules(hotelSlug)).find((rule) => rule.id === ruleOrTemplate) : ruleOrTemplate;
    if (!template) return null;
    const values = placeholderValues(sampleBooking(hotel.id, hotel.currency), hotel.name);
    const subject = render(template.subject, values);
    const body = render(template.body, values);
    return { subject, body, html: renderAutomationEmailHtml({ hotelName: hotel.name, subject, body }) };
  }

  private async fireEvent(booking: Booking, kind: 'booking_confirmed' | 'booking_cancelled' | 'checked_out'): Promise<void> {
    const hotelSlug = this.hotelSlugById.get(booking.hotelId);
    if (!hotelSlug) return;
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return;
    const rules = (await this.listRules(hotelSlug)).filter((rule) => rule.enabled && rule.trigger.kind === kind);
    const values = placeholderValues(booking, hotel.name);
    for (const rule of rules) {
      const subject = render(rule.subject, values);
      const body = render(rule.body, values);
      await this.communications.sendSystemEmail(hotelSlug, booking.reference, subject, body, 'Automations', renderAutomationEmailHtml({ hotelName: hotel.name, subject, body }));
    }
  }

  /** After `BookingService.confirm()` persists a paid, confirmed stay. */
  notifyConfirmed(booking: Booking): Promise<void> {
    return this.fireEvent(booking, 'booking_confirmed');
  }

  /** After a guest or the desk cancels a still-upcoming stay. */
  notifyCancelled(booking: Booking): Promise<void> {
    return this.fireEvent(booking, 'booking_cancelled');
  }

  /** After the desk marks a stay checked out. */
  notifyCheckedOut(booking: Booking): Promise<void> {
    return this.fireEvent(booking, 'checked_out');
  }

  /**
   * The daily cron's entry point (`/api/internal/scheduled-automations`,
   * and the Cloudflare Worker's own `scheduled()`): every enabled
   * `before_check_in`/`after_check_out` rule, matched against every booking
   * whose check-in or check-out lands exactly `days` from `today`. The send
   * log is what keeps this idempotent — unlike the single fixed "exactly
   * tomorrow" the old arrival reminder relied on, several rules can now
   * share a booking, and Cloudflare's ten-minute tick would otherwise refire
   * the same email all day.
   */
  async sendScheduled(bookings: Booking[], today: string): Promise<number> {
    let sent = 0;
    const rulesByHotel = new Map<string, EmailAutomationRule[]>();
    for (const booking of bookings) {
      if (booking.status !== 'confirmed') continue;
      const hotelSlug = this.hotelSlugById.get(booking.hotelId);
      if (!hotelSlug) continue;
      let rules = rulesByHotel.get(booking.hotelId);
      if (!rules) {
        rules = (await this.listRules(hotelSlug)).filter((rule) => rule.enabled && (rule.trigger.kind === 'before_check_in' || rule.trigger.kind === 'after_check_out'));
        rulesByHotel.set(booking.hotelId, rules);
      }
      for (const rule of rules) {
        const due =
          rule.trigger.kind === 'before_check_in'
            ? booking.stayState === 'booked' && addDays(booking.checkIn, -(rule.trigger.days ?? 0)) === today
            : addDays(booking.checkOut, rule.trigger.days ?? 0) === today;
        if (!due) continue;
        if (await this.sendLog.wasSent(rule.id, booking.id)) continue;
        const hotel = await this.repository.getHotel(hotelSlug);
        if (!hotel) continue;
        const values = placeholderValues(booking, hotel.name);
        const subject = render(rule.subject, values);
        const body = render(rule.body, values);
        await this.communications.sendSystemEmail(hotelSlug, booking.reference, subject, body, 'Automations', renderAutomationEmailHtml({ hotelName: hotel.name, subject, body }));
        await this.sendLog.markSent(booking.hotelId, rule.id, booking.id);
        sent += 1;
      }
    }
    return sent;
  }
}
