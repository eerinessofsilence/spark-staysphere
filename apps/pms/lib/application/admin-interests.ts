/**
 * What a team member can say they are here for, in the second step of
 * sign-in — and where each answer opens. Kept apart from `admin-session.ts`
 * on purpose: the picker on `/admin/welcome` is a client component, and
 * this is the one piece of the session it needs that must not drag the
 * session's own server-only imports (`next/headers`, the container) into the
 * browser bundle.
 */
export const ADMIN_INTERESTS = ['front-desk', 'reservations', 'rates', 'content', 'orbit', 'accounting', 'channels'] as const;
export type AdminInterest = (typeof ADMIN_INTERESTS)[number];

/** Each interest is a screen: the first one picked is where sign-in lands. */
export const INTEREST_ROUTES: Record<AdminInterest, string> = {
  'front-desk': '/admin/front-desk',
  reservations: '/admin/bookings',
  rates: '/admin/rates',
  content: '/admin/content',
  orbit: '/admin/content/spinner',
  accounting: '/admin/accounting',
  channels: '/admin/channel-manager',
};

export function isAdminInterest(value: unknown): value is AdminInterest {
  return typeof value === 'string' && (ADMIN_INTERESTS as readonly string[]).includes(value);
}
