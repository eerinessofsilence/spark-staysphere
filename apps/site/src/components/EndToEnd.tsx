import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useMenu } from '../lib/menu'
import { AnimatedHeading } from './AnimatedHeading'
import { ease, FadeIn } from './motion'

type Frame = { src: string; caption: string; pos?: string }
type Stage = { label: string; frames: Frame[] }

/**
 * Each stage is two moments on the phone, so a card shows the step happening
 * rather than a single screen: dates picked, then rooms searched; a room
 * chosen from the grid; a service added; payment, then the review; the
 * confirmation, then what was paid.
 */
const stages: Stage[] = [
  { label: 'Search', frames: [
    { src: '/ui/m-home-vp.webp', caption: 'Discover the hotel' },
    { src: '/ui/m-home-search-vp.webp', caption: 'Dates and guests' },
  ] },
  { label: 'Room', frames: [
    { src: '/ui/m-rooms-vp.webp', caption: 'Choose a room' },
    { src: '/ui/m-room-vp.webp', caption: 'Corner Suite, 360° view' },
  ] },
  { label: 'Services', frames: [
    { src: '/ui/m-book-3-vp.webp', caption: 'Add services' },
    { src: '/ui/m-book-3-card-vp.webp', caption: 'Airport transfer added' },
  ] },
  { label: 'Review', frames: [
    { src: '/ui/m-book-5-card-vp.webp', caption: 'Payment method' },
    { src: '/ui/m-book-6-card-vp.webp', caption: 'Everything on one screen' },
  ] },
  { label: 'Confirmation', frames: [
    { src: '/ui/m-confirmation-vp.webp', caption: 'You are booked in' },
    { src: '/ui/m-confirmation-full.webp', caption: 'Services and what was paid', pos: 'object-[50%_38%]' },
  ] },
]
const VISIBLE = 3
const TICK = 1600 // ms; a card advances every 3 ticks, cards are offset by one tick

/** One tall card that cross-fades between its stage's moments. */
function StageCard({ stage, index, tick }: { stage: Stage; index: number; tick: number }) {
  const reduce = useReducedMotion()
  const n = stage.frames.length
  const frame = reduce ? 0 : Math.floor(Math.max(0, tick - index) / 3) % n
  const f = stage.frames[frame]
  return (
    <li className="relative h-full shrink-0 snap-start overflow-hidden rounded-tile bg-card">
      <AnimatePresence initial={false}>
        <motion.img
          key={f.src}
          src={f.src}
          alt={`${stage.label}: ${f.caption}`}
          width={900}
          height={1948}
          loading="lazy"
          decoding="async"
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease }}
          className={`absolute inset-0 h-full w-full object-cover ${f.pos ?? 'object-top'}`}
        />
      </AnimatePresence>
      <span className="absolute bottom-4 left-4 inline-flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-ink/75 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
        <span className="tabular-nums text-white/55">0{index + 1}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={f.caption} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.45 }} className="truncate">
            {f.caption}
          </motion.span>
        </AnimatePresence>
      </span>
    </li>
  )
}

/**
 * A full-screen stage in ink, edge to edge. Three phone-shaped cards fill the
 * frame; from lg the stage is pinned and the page's scroll slides the five
 * stages through it. Below lg it is one screen you swipe. While the stage
 * covers the screen the floating nav steps aside and the stage's own label
 * row takes its place, and each card plays its two moments in turn.
 */
export function EndToEnd() {
  const { setNavHidden } = useMenu()
  const ref = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLUListElement>(null)
  const [step, setStep] = useState(0) // width of one card plus gap, in px
  const [pinned, setPinned] = useState(false)
  const [from, setFrom] = useState(0) // index of the first card in the window, when pinned
  const [active, setActive] = useState(0) // the swiped-to card, below lg
  const [live, setLive] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ul = track.current
    if (!ul) return
    const calc = () => {
      const [first, second] = [ul.children[0], ul.children[1]] as (HTMLElement | undefined)[]
      if (first && second) setStep(second.offsetLeft - first.offsetLeft)
      setPinned(window.matchMedia('(min-width: 64rem)').matches)
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(ul)
    return () => ro.disconnect()
  }, [])

  // The cards play only while the stage is on screen.
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setTick((v) => v + 1), TICK)
    return () => clearInterval(t)
  }, [live])

  useEffect(() => () => setNavHidden(false), [setNavHidden])

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const line = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  // Pinned: the window always holds three whole cards. Scroll picks which
  // three, and the rail eases to that position, so nothing sits half cut.
  const x = useMotionValue(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!pinned) return
    const t = Math.min(1, Math.max(0, (v - 0.12) / 0.76))
    setFrom(Math.round(t * (stages.length - VISIBLE)))
  })
  useEffect(() => {
    animate(x, pinned ? -from * step : 0, { type: 'spring', stiffness: 90, damping: 22, mass: 1.1 })
  }, [from, step, pinned, x])
  const onRailScroll = () => {
    const ul = track.current
    if (!ul || pinned || !step) return
    setActive(Math.min(stages.length - 1, Math.round(ul.scrollLeft / step)))
  }

  const enter = () => {
    setNavHidden(true)
    setLive(true)
  }
  const leave = () => {
    setNavHidden(false)
    setLive(false)
  }

  return (
    <section id="flow" className="pt-24 sm:pt-32 lg:pt-40" aria-labelledby="flow-heading">
      <div className="container-site">
        <AnimatedHeading id="flow-heading" className="text-display max-w-[20ch] text-4xl sm:text-5xl lg:text-6xl" text="Search. Room. Services. Review. Confirmation." />
        <FadeIn delay={0.15}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            One uninterrupted scroll. Follow the guest from the first search to the confirmation screen without a single page reload.
          </p>
        </FadeIn>
      </div>

      <div ref={ref} className="relative mt-12 lg:h-[300vh]">
        <div className="lg:sticky lg:top-0">
          <motion.div
            onViewportEnter={enter}
            onViewportLeave={leave}
            viewport={{ amount: 0.9 }}
            className="flex h-svh flex-col bg-ink px-4 pt-9 pb-5 text-[#F7F5F0] sm:px-6 lg:px-8 lg:pt-10 lg:pb-8"
          >
            {/* Sits where the floating nav would be: that nav hides while this stage is on screen. */}
            <ol className="flex justify-around gap-1.5 text-xs font-medium tracking-[0.05em] uppercase sm:gap-2 sm:tracking-[0.12em]">
              {stages.map((s, i) => {
                const lit = pinned ? i >= from && i < from + VISIBLE : i === active
                return (
                  <li key={s.label} className={`transition-colors duration-700 ${lit ? 'text-white' : 'text-white/45'}`} aria-current={lit ? 'step' : undefined}>
                    {s.label}
                  </li>
                )
              })}
            </ol>
            <div className="mt-4 h-px w-full bg-white/12">
              <motion.div style={{ width: line }} className="h-px bg-white/70" />
            </div>

            {/* The window is as wide as the label row; from lg it holds exactly three cards, below it swipes. */}
            <div className="mt-5 min-h-0 flex-1 overflow-hidden lg:mt-7">
              <motion.ul
                ref={track}
                onScroll={onRailScroll}
                style={pinned ? { x } : undefined}
                className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto sm:gap-5 lg:gap-7 lg:snap-none lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:w-[78%] sm:[&>li]:w-[calc((100%-1.25rem)/2)] lg:[&>li]:w-[calc((100%-3.5rem)/3)]"
              >
                {stages.map((s, i) => (
                  <StageCard key={s.label} stage={s} index={i} tick={tick} />
                ))}
              </motion.ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
