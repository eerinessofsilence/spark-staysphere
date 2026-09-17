/**
 * The hotel's own subscription to StaySphere — a different account than the
 * guest's demo booking, and a different kind of money than `Accounting`'s
 * room revenue. Everything here is fixed demo data: no billing provider is
 * wired up yet (see CLAUDE.md's roadmap), so a plan change or a card update
 * is a local, unsaved preview like the rest of `/admin/account`.
 */

export type PlanId = 'starter' | 'growth' | 'scale';

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  /** Per room, per month — the metric a hotel actually budgets against. */
  priceUnit: string;
  roomLimit: number | null;
  seatLimit: number | null;
  tagline: string;
  features: string[];
}

export const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 39,
    priceUnit: 'per month',
    roomLimit: 25,
    seatLimit: 3,
    tagline: 'One property, the essentials.',
    features: ['Up to 25 rooms', '3 team seats', 'Direct booking site', 'Email support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 129,
    priceUnit: 'per month',
    roomLimit: 150,
    seatLimit: 10,
    tagline: 'For a property running its own front desk.',
    features: [
      'Up to 150 rooms',
      '10 team seats',
      'Front desk & tape chart',
      'AI room-finder concierge',
      'Priority support',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 349,
    priceUnit: 'per month',
    roomLimit: null,
    seatLimit: null,
    tagline: 'Multiple properties, channel manager included.',
    features: [
      'Unlimited rooms',
      'Unlimited team seats',
      'Multi-property support',
      'PMS & channel manager sync',
      'Dedicated account manager',
    ],
  },
];

export const currentPlanId: PlanId = 'growth';

export const usage = {
  /** Matches `mock-data.ts`'s 96-room seed, so the meter reads true against the rest of the demo. */
  roomsUsed: 96,
  seatsUsed: 5,
  bookingsThisMonth: 43,
};

export const paymentMethod = {
  brand: 'Visa',
  last4: '4242',
  expiry: '09/28',
};

export interface Invoice {
  id: string;
  issuedOn: string;
  amount: number;
  status: 'paid' | 'upcoming';
}

export const invoices: Invoice[] = [
  { id: 'INV-2026-0009', issuedOn: '2026-09-01', amount: 129, status: 'paid' },
  { id: 'INV-2026-0008', issuedOn: '2026-08-01', amount: 129, status: 'paid' },
  { id: 'INV-2026-0007', issuedOn: '2026-07-01', amount: 129, status: 'paid' },
  { id: 'INV-2026-0006', issuedOn: '2026-06-01', amount: 129, status: 'paid' },
  { id: 'INV-2026-0005', issuedOn: '2026-05-01', amount: 39, status: 'paid' },
];

export const nextBillingDate = '2026-10-01';
