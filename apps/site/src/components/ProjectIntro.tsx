import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import { AnimatedHeading } from './AnimatedHeading'
import { ease } from './motion'

/**
 * Framed as a drop, not a raw total: `from` is what a typical OTA flow
 * looks like, `to` is StaySphere. The count runs from one to the other so
 * the bad number is what the guest actually sees fall away on screen.
 */
const stats: { from: number; to: number; suffix?: string; label: string; text: string }[] = [
  { from: 0, to: 360, suffix: '°', label: 'Explore the hotel', text: 'An interactive orbit outside the building and panoramas inside the rooms.' },
  { from: 0, to: 1, label: 'Content workspace', text: 'Hotel details, room descriptions, media and services managed in one CMS.' },
  { from: 0, to: 2, label: 'Connected applications', text: 'CMS for the hotel team and Guest for visitors, connected through a content API.' },
  { from: 0, to: 0, label: 'PMS modules required', text: 'Present the property and connect an existing booking provider without operating a PMS.' },
]

/**
 * One spring drives the count-down and a scale-in; underdamped so the figure
 * overshoots and settles while the digits are clamped at the target. The
 * numeral matches the "hero stat" level of the type scale (`text-display`,
 * 32 → 48 → 56) — bold and on-token, same voice as every other section
 * heading. The suffix (%) is the only coloured thing in the card, in the
 * accent clay.
 */
function Stat({ from, to, suffix = '', label, text, start, delay }: (typeof stats)[number] & { start: boolean; delay: number }) {
  const reduce = useReducedMotion()
  const progress = useMotionValue(0)
  const spring = useSpring(progress, { stiffness: 70, damping: 11, mass: 1 })

  useEffect(() => {
    if (!start) return
    const t = window.setTimeout(() => progress.set(1), delay * 1000)
    return () => window.clearTimeout(t)
  }, [start, delay, progress])

  const value = useTransform(spring, (v) => String(Math.round(from + (to - from) * Math.min(1, Math.max(0, v)))))
  const scale = useTransform(spring, [0, 1], [0.8, 1], { clamp: false })

  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.9, ease, delay }}
      className="flex flex-col rounded-tile bg-stone/50 p-7 sm:p-8"
    >
      <p className="flex items-baseline text-display text-4xl tabular-nums sm:text-5xl lg:text-6xl">
        {reduce ? (
          <span>{to}</span>
        ) : (
          <motion.span className="inline-block origin-bottom-left will-change-transform" style={{ scale }}>
            {value}
          </motion.span>
        )}
        {suffix && <span className="ml-0.5 text-2xl font-normal text-accent sm:text-3xl lg:text-4xl">{suffix}</span>}
      </p>
      <p className="mt-8 text-lg font-semibold tracking-tight text-ink lg:mt-10">{label}</p>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">{text}</p>
    </motion.li>
  )
}

export function ProjectIntro() {
  const ref = useRef<HTMLUListElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })

  return (
    <section id="intro" className="container-site pt-24 sm:pt-32 lg:pt-40" aria-labelledby="intro-heading">
      <AnimatedHeading id="intro-heading" className="text-display max-w-[16ch] text-4xl sm:text-5xl lg:text-6xl" text="The hotel, from every angle." />
      <ul ref={ref} className="mt-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <Stat key={s.label} {...s} start={inView} delay={0.2 + i * 0.1} />
        ))}
      </ul>
    </section>
  )
}
