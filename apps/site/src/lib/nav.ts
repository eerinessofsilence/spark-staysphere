/** Product page anchors, rendered by the floating nav (desktop track and mobile menu). */
export const NAV_LINKS = [
  { href: '#intro', label: 'About' },
  { href: '#experience', label: 'Experience' },
  { href: '#room', label: 'Rooms' },
  { href: '#pricing', label: 'Pricing' },
] as const

export const PRICING_PAGE = '/pricing/'

/**
 * A product-page section anchor stays local on the product page and points
 * back there from the standalone pricing page.
 */
export function sectionHref(hash: string): string {
  if (typeof window === 'undefined') return hash
  const onHome = window.location.pathname === '/' || window.location.pathname === '/index.html'
  if (onHome) return hash
  return `/${hash}`
}
