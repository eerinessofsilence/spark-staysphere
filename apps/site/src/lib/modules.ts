import type { PlanSlug } from './plans'

/** Mirrored from apps/pms/lib/infrastructure/subscription-catalog.ts (2026-10-06). */
export type ModuleOption = {
  id: string
  category: 'operations' | 'distribution' | 'guest'
  name: string
  detail: string
  price: number
  includedIn: Array<'starter' | 'growth' | 'scale'>
}

export const PMS_MODULES: ModuleOption[] = [
  { id: 'pms', category: 'operations', name: 'Property management', detail: 'Reservations, guest records and room assignments in one place.', price: 39, includedIn: ['starter', 'growth', 'scale'] },
  { id: 'front-desk', category: 'operations', name: 'Front desk', detail: 'Plan arrivals and departures on the room calendar.', price: 29, includedIn: ['growth', 'scale'] },
  { id: 'accounting', category: 'operations', name: 'Accounting and reporting', detail: 'Review payments, invoices and financial statistics.', price: 29, includedIn: [] },
  { id: 'housekeeping', category: 'operations', name: 'Housekeeping', detail: 'Track cleaning status and assign room tasks.', price: 19, includedIn: [] },
  { id: 'orders', category: 'operations', name: 'Services and food orders', detail: 'Link service and food orders to reservations.', price: 15, includedIn: [] },
  { id: 'booking-engine', category: 'distribution', name: 'Direct booking engine', detail: 'Let guests book directly on the hotel website.', price: 29, includedIn: ['starter', 'growth', 'scale'] },
  { id: 'channels', category: 'distribution', name: 'Channel manager', detail: 'Manage distribution channel settings in one place.', price: 39, includedIn: ['scale'] },
  { id: 'rates', category: 'distribution', name: 'Rate management', detail: 'Manage room rates and availability by date.', price: 25, includedIn: [] },
  { id: 'communications', category: 'guest', name: 'Guest communications', detail: 'Read and reply to guest conversations.', price: 19, includedIn: [] },
  { id: 'assistant', category: 'guest', name: 'AI room finder', detail: 'Help guests find rooms that fit their preferences.', price: 25, includedIn: ['growth', 'scale'] },
]

/** The marketing plans are presented in the same order as the PMS subscription tiers. */
export const pmsTierForPlan: Record<PlanSlug, ModuleOption['includedIn'][number]> = {
  independent: 'starter',
  boutique: 'growth',
  group: 'scale',
}

export const includedModules = (plan: PlanSlug) => PMS_MODULES.filter((module) => module.includedIn.includes(pmsTierForPlan[plan]))
export const optionalModules = (plan: PlanSlug) => PMS_MODULES.filter((module) => !module.includedIn.includes(pmsTierForPlan[plan]))
