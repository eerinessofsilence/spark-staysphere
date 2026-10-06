import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { CONTACT_EMAIL } from '../lib/links'
import { useMenu } from '../lib/menu'
import { NAV_LINKS, sectionHref } from '../lib/nav'
import { useActiveSection } from '../lib/useActiveSection'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ease } from './motion'
import { NavLinks } from './NavLinks'
import { SolutionRow, SolutionsMenu, SOLUTIONS } from './SolutionsMenu'
import { ArrowRight, ArrowUpRight, Button } from './ui'

const HREFS = NAV_LINKS.map((l) => l.href)

/**
 * The page's one header: a floating frosted pill, fixed above the hero and
 * every section after it — wordmark left, section links and the Solutions
 * dropdown centred, language picker and CTA right. It drops in on load; a
 * full-screen section with its own top row can hide it through `navHidden`.
 * The link for the section in view is brightened. Full-bleed, flat `px-8` —
 * no max-width — so it lines up with the same `container-site` padding used
 * everywhere else, and `.hero-shell` reserves its height above the card.
 */
export function Nav() {
  const reduce = useReducedMotion()
  const { open, setOpen, navHidden, openDemoRequest, openDemoAccess } = useMenu()
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const active = useActiveSection(HREFS)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  // Without this, the page stays scrollable underneath the fixed panel —
  // touch/wheel input lands on whichever of the two is listening, and it's
  // usually the (much taller) page behind it, not the menu itself. `<html>`,
  // not `<body>`, is the element `window.scrollY` actually moves — locking
  // only `body` leaves the page free to scroll regardless.
  useEffect(() => {
    if (!open) return
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [open])

  const visible = !navHidden
  const t = (delay: number) => (reduce ? { duration: 0 } : { duration: 0.5, ease, delay })
  const rowClass = 'flex w-full cursor-pointer items-center justify-between border-b border-ink/[0.07] py-4 text-left text-4xl font-semibold tracking-tight text-ink transition-colors hover:text-ink/70'

  return (
    <>
      {/* Full-screen menu below lg. It lives outside the header on purpose:
          the header animates with a transform, which would make a `fixed`
          child position against the header instead of the viewport. It sits
          under the pill (z-30 vs z-40) so the pill's own × still closes it. */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            data-lenis-prevent
            className="fixed inset-0 z-30 flex flex-col bg-canvas px-8 pt-24 pb-8 text-ink sm:pt-28 lg:hidden"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <nav className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2" aria-label="Product page, mobile">
              {NAV_LINKS.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={sectionHref(l.href)}
                  onClick={() => setOpen(false)}
                  className={rowClass}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={t(0.05 + i * 0.05)}
                >
                  {l.label}
                  <ArrowRight className="size-6 text-ink/30" />
                </motion.a>
              ))}
              <motion.button
                type="button"
                onClick={() => setSolutionsOpen((v) => !v)}
                aria-expanded={solutionsOpen}
                aria-controls="mobile-solutions"
                className={rowClass}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={t(0.05 + NAV_LINKS.length * 0.05)}
              >
                Solutions
                <svg viewBox="0 0 20 20" className={`size-6 text-ink/30 transition-transform duration-300 ${solutionsOpen ? 'rotate-180' : ''}`} fill="none" aria-hidden>
                  <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.button>
              <div id="mobile-solutions" hidden={!solutionsOpen} className="flex flex-col py-3">
                {SOLUTIONS.map((s) => (
                  <SolutionRow key={s.name} solution={s} onClick={() => setOpen(false)} />
                ))}
              </div>
            </nav>

            <motion.div className="pt-6" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={t(0.35)}>
              <Button onClick={() => {
                setOpen(false)
                openDemoAccess()
              }} size="lg" className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Start free trial <ArrowUpRight />
              </Button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  openDemoRequest()
                }}
                className="mt-2 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-card px-6 text-base font-semibold text-ink shadow-soft transition-colors duration-200 hover:bg-stone"
              >
                Request a demo <ArrowUpRight />
              </button>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                or write to{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <motion.header
      initial={reduce ? false : { y: -24, opacity: 0 }}
      animate={{ y: visible ? 0 : -32, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.45, ease }}
      inert={!visible}
      className={`fixed inset-x-0 top-0 z-40 px-8 pt-3 sm:pt-5 ${visible ? '' : 'pointer-events-none'}`}
    >
      <div className="relative flex h-14 items-center gap-3 rounded-full border border-ink/[0.07] bg-white/85 pr-2 pl-5 text-ink shadow-soft-lg backdrop-blur-2xl backdrop-saturate-150 lg:h-16 lg:pr-2.5 lg:pl-6">
        <motion.a href={sectionHref('#top')} className="flex shrink-0 items-center gap-3" aria-label="Spark StaySphere, back to top" whileHover={reduce ? undefined : { scale: 1.04, rotate: -2 }}>
          <img src="/brand/spark-logo-on-light.svg" alt="Spark" className="h-6 w-auto lg:h-7" />
          {/* The product name shows on phones/tablets and from xl; at lg the
              centred links plus the Solutions trigger need that room. */}
          <span aria-hidden className="hidden h-4 w-px bg-ink/15 sm:block lg:hidden xl:block" />
          <span className="hidden text-base font-medium tracking-tight text-ink/60 sm:inline lg:hidden xl:inline">StaySphere</span>
        </motion.a>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          <NavLinks label="Product page, floating" active={active} className="xl:gap-4" />
          <SolutionsMenu />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openDemoRequest()}
            className="hidden min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent 2xl:inline-flex"
          >
            Request a demo <ArrowUpRight className="size-4" />
          </button>
          {/* Hidden below 460px: most phones don't have room for it next to the menu
              button, which must stay reachable — that one's never hidden. */}
          <button
            type="button"
            onClick={() => { setOpen(false); openDemoAccess() }}
            className="hidden min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent min-[460px]:inline-flex lg:px-5"
          >
            Start free trial <ArrowUpRight className="size-4" />
          </button>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-ink/5 text-ink transition-colors hover:bg-ink/10 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
              {open ? <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>

    </motion.header>
    </>
  )
}
