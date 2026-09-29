import type { AutomationTrigger, AutomationTriggerKind } from '@/lib/domain/ports';
import type { AdminT } from './translate';

/**
 * The trigger-kind picker's own options — every kind, in the order the form
 * offers them. The two calendar-relative kinds have no `days` yet to show
 * here (that's the field right below the picker), so their option text
 * stays generic; `triggerLabel` below is what fills in the number once a
 * rule actually has one.
 */
export const TRIGGER_KIND_OPTION_LABEL_KEY = {
  booking_confirmed: 'automations.triggerBookingConfirmed',
  booking_cancelled: 'automations.triggerBookingCancelled',
  checked_out: 'automations.triggerCheckedOut',
  before_check_in: 'automations.triggerOptionBeforeCheckIn',
  after_check_out: 'automations.triggerOptionAfterCheckOut',
} as const satisfies Record<AutomationTriggerKind, string>;

const TRIGGER_KIND_LABEL_KEY = {
  booking_confirmed: 'automations.triggerBookingConfirmed',
  booking_cancelled: 'automations.triggerBookingCancelled',
  checked_out: 'automations.triggerCheckedOut',
  before_check_in: 'automations.triggerBeforeCheckIn',
  after_check_out: 'automations.triggerAfterCheckOut',
} as const satisfies Record<AutomationTriggerKind, string>;

/** A trigger kind that carries a day offset — the form shows a "days" field only for these. */
export function isTimeBasedTrigger(kind: AutomationTriggerKind): boolean {
  return kind === 'before_check_in' || kind === 'after_check_out';
}

/** "1 day before check-in", "When a booking is confirmed" — a custom rule's row subtitle and the trigger select's own option labels. */
export function triggerLabel(trigger: AutomationTrigger, t: AdminT): string {
  const key = TRIGGER_KIND_LABEL_KEY[trigger.kind] as Parameters<AdminT>[0];
  return isTimeBasedTrigger(trigger.kind) ? t(key, { days: trigger.days ?? 0 }) : t(key);
}
