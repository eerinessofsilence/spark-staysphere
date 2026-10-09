import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useRef, type PointerEvent } from 'react'
import { ease } from './motion'

type Shot = { src: string; width: number; height: number; alt: string; size: 'tall' | 'mid' | 'strip' }

/**
 * Five columns, outer ones tall and the middle one low, so the row reads
 * as a shallow bowl. Every capture is a real Playwright shot of the live
 * demo except the last, which is the property's own photography. Order is
 * the booking journey, left to right.
 */
const COLUMNS: Shot[][] = [
  [
    { src: '/ui/m-home-vp.webp', width: 900, height: 1948, alt: 'StaySphere on a phone: the hotel’s home page with the 360° view', size: 'tall' },
    { src: '/ui/d-hero-scene.webp', width: 2000, height: 1250, alt: 'The 360° view of the hotel with room pins and prices', size: 'strip' },
  ],
  [{ src: '/ui/m-rooms-vp.webp', width: 900, height: 1948, alt: 'Choosing a room for the stay', size: 'tall' }],
  [{ src: '/ui/d-roomcard-1.webp', width: 498, height: 572, alt: 'A room card: Corner Suite, 70 m², king bed, €560 a night', size: 'mid' }],
  [{ src: '/ui/m-confirmation-vp.webp', width: 900, height: 1948, alt: 'The confirmation: you are booked in', size: 'tall' }],
  [
    { src: '/ui/d-book-summary.webp', width: 800, height: 1437, alt: 'The stay summary with the running total', size: 'tall' },
    { src: '/photos/hotel-pool.webp', width: 2000, height: 1334, alt: 'The infinity pool above the sea at Asteria Cove', size: 'strip' },
  ],
]

/** Entrance order: the middle first, then outwards, strips last. */
const DELAY: Record<string, number> = { '2-0': 0.45, '1-0': 0.55, '3-0': 0.55, '0-0': 0.65, '4-0': 0.65, '0-1': 0.8, '4-1': 0.8 }

const TILT = 9 // degrees at the card's own edge
const clamp = (v: number) => Math.max(-1.25, Math.min(1.25, v))

type Pointer = { x: MotionValue<number>; y: MotionValue<number>; active: MotionValue<number> }

/**
 * A card leans to face the pointer: the pointer's offset from the card's
 * centre, in half-card units, becomes a rotation, sprung so it glides.
 * Cards further from the pointer lean less, and `active` zeroes everything
 * when the pointer leaves the stage so the whole row settles flat again.
 */
function Card({ shot, delay, pointer, reduce }: { shot: Shot; delay: number; pointer: Pointer; reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const offset = (axis: 'x' | 'y') => (values: number[]) => {
    const [x, y, active] = values
    const el = ref.current
    if (!active || !el) return 0
    const r = el.getBoundingClientRect()
    return axis === 'x' ? clamp((x - (r.left + r.width / 2)) / (r.width / 2)) : clamp((y - (r.top + r.height / 2)) / (r.height / 2))
  }
  // rotateY(+) turns the right edge away, rotateX(+) turns the top away —
  // the signs below make the near edge come forward instead.
  const rotateY = useSpring(useTransform([pointer.x, pointer.y, pointer.active], (v) => offset('x')(v as number[]) * TILT), { stiffness: 160, damping: 22, mass: 0.6 })
  const rotateX = useSpring(useTransform([pointer.x, pointer.y, pointer.active], (v) => -offset('y')(v as number[]) * TILT), { stiffness: 160, damping: 22, mass: 0.6 })

  return (
    <motion.div
      ref={ref}
      className={`hero-card hero-card--${shot.size}`}
      style={reduce ? undefined : { rotateX, rotateY }}
      initial={reduce ? false : { opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0 } : { duration: 0.9, ease, delay }}
    >
      <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} loading={delay < 0.6 ? 'eager' : 'lazy'} decoding="async" />
    </motion.div>
  )
}

/**
 * The stage under the pitch: a curved bento of the product, with a warm
 * pool of light that follows the pointer across it and cards that lean
 * towards it. Mouse only — touch just scrolls the row. Under reduced motion
 * the light sits still in the middle and nothing leans.
 */
export function HeroBento() {
  const reduce = useReducedMotion() ?? false
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const active = useMotionValue(0)
  const lightX = useSpring(useMotionValue(0), { stiffness: 120, damping: 24 })
  const lightY = useSpring(useMotionValue(0), { stiffness: 120, damping: 24 })
  const lightOpacity = useSpring(useMotionValue(0), { stiffness: 120, damping: 24 })
  const light = useMotionTemplate`radial-gradient(clamp(200px, 30cqw, 380px) circle at ${lightX}px ${lightY}px, var(--border) 0%, transparent 70%)`
  const pointer: Pointer = { x, y, active }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set(e.clientX)
    y.set(e.clientY)
    active.set(1)
    lightX.set(e.clientX - r.left)
    lightY.set(e.clientY - r.top)
    lightOpacity.set(1)
  }
  const onLeave = () => {
    active.set(0)
    lightOpacity.set(0)
  }

  return (
    <div ref={ref} className="hero-bento" onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div className="hero-bento-glow" aria-hidden initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={reduce ? { duration: 0 } : { duration: 1.2, ease, delay: 0.3 }} />
      {!reduce && <motion.div className="hero-bento-light" aria-hidden style={{ backgroundImage: light, opacity: lightOpacity }} />}
      <div className="hero-bento-scroll">
        <div className="hero-bento-row">
          {COLUMNS.map((col, c) => (
            <div key={c} className="hero-col">
              {col.map((shot, i) => (
                <Card key={shot.src} shot={shot} delay={DELAY[`${c}-${i}`] ?? 0.7} pointer={pointer} reduce={reduce} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span aria-hidden className="hero-bento-fade hero-bento-fade--l" />
      <span aria-hidden className="hero-bento-fade hero-bento-fade--r" />
    </div>
  )
}
