/**
 * The three plans, shared by the pricing cards on the product page and the
 * calculator on /pricing/. Prices are per property per month, in euros,
 * excluding VAT; `yearly` is the per-month figure when billed yearly (−20%).
 *
 * The calculator model on top of the flat fee: each plan includes a number
 * of rooms and connected channels; rooms and channels above that are priced
 * per unit per month, up to the plan's ceiling. Independent is direct-only
 * (one channel, no add-on). Group is quoted, so its figure is an estimate.
 */
export type PlanSlug = 'independent' | 'boutique' | 'group'

export type Plan = {
  slug: PlanSlug
  name: string
  tagline: string
  monthly: number | null
  yearly: number | null
  note: string
  cta: string
  featured?: boolean
  features: string[]
  rooms: { min: number; included: number; max: number; perExtra: number }
  channels: { min: number; included: number; max: number; perExtra: number }
}

export const YEARLY_DISCOUNT = 0.2

export const plans: Plan[] = [
  {
    slug: 'independent',
    name: 'Independent',
    tagline: 'For a single property that wants to book direct.',
    monthly: 149,
    yearly: 119,
    note: 'per property, per month',
    cta: 'Start with Independent',
    features: [
      'Full booking journey, search to confirmation',
      'Up to 40 rooms',
      'Room galleries and 360° views',
      'Services and upsells',
      'Hotel-branded colours, type and imagery',
      'Free cancellation rules',
      'Email support',
    ],
    rooms: { min: 1, included: 20, max: 40, perExtra: 2 },
    channels: { min: 1, included: 1, max: 1, perExtra: 0 },
  },
  {
    slug: 'boutique',
    name: 'Boutique',
    tagline: 'For hotels that live on their direct channel.',
    monthly: 349,
    yearly: 279,
    note: 'per property, per month',
    cta: 'Start with Boutique',
    featured: true,
    features: [
      'Everything in Independent',
      'Unlimited rooms and rate plans',
      'Multi-language and multi-currency',
      'Rate comparison against partner sites',
      'Hotel admin with live bookings',
      'Custom domain and white-label emails',
      'Priority support, same-day replies',
    ],
    rooms: { min: 1, included: 60, max: 200, perExtra: 1.5 },
    channels: { min: 1, included: 2, max: 6, perExtra: 39 },
  },
  {
    slug: 'group',
    name: 'Group',
    tagline: 'For groups and collections with several properties.',
    monthly: null,
    yearly: null,
    note: 'tailored to the portfolio',
    cta: 'Talk to us',
    features: [
      'Everything in Boutique',
      'Multiple properties, one account',
      'Shared guest profiles across the group',
      'PMS and channel-manager integrations',
      'Custom checkout steps and policies',
      'SLA, onboarding and dedicated contact',
    ],
    rooms: { min: 10, included: 60, max: 1000, perExtra: 1.5 },
    channels: { min: 1, included: 2, max: 10, perExtra: 39 },
  },
]

export const planBySlug = (slug: string | null | undefined): Plan => plans.find((p) => p.slug === slug) ?? plans[1]

/** Group estimates are built from the Boutique rate per property, less a portfolio discount. */
export const GROUP_DISCOUNT = 0.15

export type Quote = {
  /** Flat fee per property per month at the chosen billing period. */
  base: number
  extraRooms: number
  roomsCost: number
  extraChannels: number
  channelsCost: number
  properties: number
  /** Per month, all properties, at the chosen billing period. */
  monthly: number
  /** What is actually billed over a year at the chosen period. */
  yearly: number
}

export function quote(plan: Plan, opts: { rooms: number; channels: number; yearly: boolean; properties?: number }): Quote {
  const properties = plan.slug === 'group' ? Math.max(2, opts.properties ?? 2) : 1
  const rate = plan.slug === 'group' ? plans[1] : plan
  const baseMonthly = rate.monthly ?? 0
  const period = opts.yearly ? 1 - YEARLY_DISCOUNT : 1
  // Rooms are spread across the portfolio for Group: each property brings
  // its own included allowance, so the overage is on the total.
  const extraRooms = Math.max(0, opts.rooms - plan.rooms.included * properties)
  const extraChannels = Math.max(0, opts.channels - plan.channels.included)
  // Each line is rounded on its own and the total is the sum of the lines,
  // so the breakdown always adds up to the figure shown.
  const base = Math.round(baseMonthly * period * (plan.slug === 'group' ? 1 - GROUP_DISCOUNT : 1))
  const roomsCost = Math.round(extraRooms * plan.rooms.perExtra * period)
  const channelsCost = Math.round(extraChannels * plan.channels.perExtra * period * properties)
  const monthly = base * properties + roomsCost + channelsCost
  return { base, extraRooms, roomsCost, extraChannels, channelsCost, properties, monthly, yearly: monthly * 12 }
}

export const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const eurUnit = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
