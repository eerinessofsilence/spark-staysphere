import { motion } from 'motion/react'
import { useState } from 'react'
import { NAV_LINKS, sectionHref } from '../lib/nav'

const styles = { track: 'bg-stone/60 p-1', link: 'text-ink/70', lit: 'text-ink', glider: 'bg-white shadow-soft' }

/**
 * The section links inside the floating nav. A pill glides between links as
 * the pointer moves (and rests on the section in view when `active` is
 * given); each label rolls up and is replaced from below on hover.
 */
export function NavLinks({
  active,
  className = '',
  label,
}: {
  /** href of the section currently in view; the highlight rests there. */
  active?: string
  className?: string
  label: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const current = hover ?? active ?? null
  const s = styles

  return (
    <nav className={`flex items-center gap-1 rounded-full ${s.track} ${className}`} aria-label={label} onMouseLeave={() => setHover(null)}>
      {NAV_LINKS.map((l) => {
        const lit = current === l.href
        return (
          <motion.a
            key={l.href}
            href={sectionHref(l.href)}
            aria-current={active === l.href ? 'location' : undefined}
            onHoverStart={() => setHover(l.href)}
            onFocus={() => setHover(l.href)}
            onBlur={() => setHover(null)}
            className={`group relative inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-base font-medium whitespace-nowrap transition-colors duration-300 ${lit ? s.lit : s.link}`}
          >
            {lit && (
              <motion.span
                layoutId={`nav-glider-${label}`}
                aria-hidden
                className={`absolute inset-0 rounded-full ${s.glider}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            {/* Text roll: the label slides up and its twin slides in from below */}
            {/* Slow ease-in-out roll with a fade, so the swap reads as a glide
                rather than a snap; reduced motion just keeps the label still. */}
            <span className="relative block overflow-hidden">
              <span className="block transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] motion-safe:group-hover:-translate-y-full motion-safe:group-hover:opacity-0">
                {l.label}
              </span>
              <span
                aria-hidden
                className="absolute inset-0 block translate-y-full opacity-0 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] motion-safe:group-hover:translate-y-0 motion-safe:group-hover:opacity-100"
              >
                {l.label}
              </span>
            </span>
          </motion.a>
        )
      })}
    </nav>
  )
}
