import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useMenu } from '../lib/menu'
import { PRICING_PAGE, sectionHref } from '../lib/nav'
import { plans } from '../lib/plans'
import { ease } from './motion'
import { ArrowRight, ArrowUpRight } from './ui'

/* Three hotel sizes on a 24-grid, the same 1.75 round stroke as the room-page
   tiles: a cosy two-storey house, a taller block with a canopy, a skyline. */
type IconProps = { className?: string }
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function IconSmall({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M3.5 20.5h17" />
      <path d="M5.5 20.5V10L12 4.5l6.5 5.5v10.5" />
      <path d="M10 20.5V16a2 2 0 0 1 4 0v4.5" />
      <path d="M8.25 12.5h1.5M14.25 12.5h1.5" />
    </svg>
  )
}
function IconMid({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M3.5 20.5h17" />
      <path d="M6 20.5V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5v15" />
      <path d="M9 8h1.5M13.5 8h1.5M9 11.5h1.5M13.5 11.5h1.5M9 15h1.5M13.5 15h1.5" />
      <path d="M10.25 20.5v-2.75h3.5v2.75" />
    </svg>
  )
}
function IconLarge({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...stroke}>
      <path d="M2.5 20.5h19" />
      <path d="M4.5 20.5V11a1 1 0 0 1 1-1h3.5" />
      <path d="M9 20.5V5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v15.5" />
      <path d="M16 20.5V8.5h2.5a1 1 0 0 1 1 1v11" />
      <path d="M11.5 7.5h2M11.5 10.5h2M11.5 13.5h2M6 13.5h1M6 16.5h1M18 12h.01M18 15h.01" />
    </svg>
  )
}

/**
 * The three Pricing plans reframed by hotel size, the way a hotel thinks of
 * itself. Names and room counts come straight from lib/plans.ts, so the
 * menu can never drift from what the pricing page says.
 */
const [independent, boutique, group] = plans
export const SOLUTIONS = [
  { slug: independent.slug, name: 'Small hotels', meta: `Up to ${independent.rooms.max} rooms`, tagline: 'One property that wants to book direct, live within a week.', Icon: IconSmall, featured: false },
  { slug: boutique.slug, name: 'Mid-size hotels', meta: `${independent.rooms.max}–${boutique.rooms.max}+ rooms`, tagline: 'Hotels that live on their direct channel: languages, currencies, rate comparison.', Icon: IconMid, featured: true },
  { slug: group.slug, name: 'Groups & collections', meta: 'Several properties', tagline: 'One account for the portfolio, shared guest profiles, PMS integrations.', Icon: IconLarge, featured: false },
] as const

/** One size row: icon chip, name + room range, tagline — shared by the
    desktop panel and the mobile accordion. Each lands on the calculator
    with its plan preselected, like the plan cards do. */
export function SolutionRow({ solution, onClick }: { solution: (typeof SOLUTIONS)[number]; onClick?: () => void }) {
  const { slug, name, meta, tagline, Icon, featured } = solution
  return (
    <a href={`${PRICING_PAGE}?plan=${slug}#calculator`} onClick={onClick} className="group flex items-start gap-3.5 rounded-tile p-3 transition-colors hover:bg-stone/60">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-stone text-ink transition-colors duration-200 group-hover:bg-ink group-hover:text-primary-foreground">
        <Icon />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-semibold tracking-tight text-ink">{name}</span>
          <span className="text-xs font-medium text-muted-foreground">{meta}</span>
          {featured && <span className="rounded-full bg-tint-clay px-2 py-0.5 text-xs font-semibold text-tint-clay-ink">Popular</span>}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{tagline}</span>
      </span>
    </a>
  )
}

/** A real capture of the live demo — the 360° view with room pins — as the panel's picture of the product. */
const PANEL_SHOT = { src: '/ui/d-hero-scene.webp', width: 2000, height: 1250, alt: 'StaySphere: the hotel’s 360° view with room pins and prices' }

/**
 * Desktop "Solutions" panel, in the shape of a mega menu: the product on
 * the left (a capture, one line, the demo CTA) and the three hotel sizes
 * on the right. Click-toggle with outside-click/Escape to close, same
 * pattern as `LanguageSwitcher`; the panel rises in, or simply appears under
 * reduced motion.
 */
export function SolutionsMenu() {
  const reduce = useReducedMotion()
  const { openDemoRequest } = useMenu()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full px-3.5 py-1.5 text-base font-medium text-ink/70 transition-colors hover:text-ink"
      >
        Solutions
        <svg viewBox="0 0 20 20" className={`size-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" aria-hidden>
          <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease }}
          className="absolute top-12 left-1/2 z-10 grid w-[42rem] -translate-x-1/2 grid-cols-[15rem_minmax(0,1fr)] gap-3 rounded-card border border-ink/[0.07] bg-white/98 p-3 text-ink shadow-soft-lg backdrop-blur-xl"
        >
          <div className="flex flex-col rounded-tile bg-stone/60 p-4">
            <img
              src={PANEL_SHOT.src}
              alt={PANEL_SHOT.alt}
              width={PANEL_SHOT.width}
              height={PANEL_SHOT.height}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-tile object-cover object-top shadow-soft"
            />
            <p className="mt-4 text-base font-semibold tracking-tight">One system, every size of hotel.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">No commission, your brand only, live in a week.</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openDemoRequest()
              }}
              className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary-hover"
            >
              Request a demo <ArrowUpRight />
            </button>
          </div>

          <div className="flex flex-col">
            <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">By hotel size</p>
            {SOLUTIONS.map((s) => (
              <SolutionRow key={s.slug} solution={s} onClick={() => setOpen(false)} />
            ))}
            <a href={sectionHref('#pricing')} onClick={() => setOpen(false)} className="mt-auto flex items-center gap-1.5 rounded-tile px-3 py-2.5 text-sm font-semibold text-accent-strong transition-colors hover:bg-stone/60">
              Compare all plans <ArrowRight className="size-3.5" />
            </a>
          </div>
        </motion.div>
      )}
    </div>
  )
}
