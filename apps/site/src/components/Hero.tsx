import { motion, useReducedMotion } from 'motion/react'
import { useMenu } from '../lib/menu'
import { AnimatedHeading } from './AnimatedHeading'
import { HeroBento } from './HeroBento'
import { ease } from './motion'
import { ArrowRight, ArrowUpRight, Button } from './ui'

/**
 * The hero, laid out like a product landing: the pitch centred on top —
 * headline, lede, pricing, demo-request and trial actions — and below it the
 * product itself as a curved bento of real captures (`HeroBento`). No card,
 * no surface: it all sits straight on the page canvas. Intro: headline
 * rises word by word, lede and buttons follow, then the bento settles in
 * from the middle outwards. Every offset collapses under
 * `prefers-reduced-motion`.
 */
export function Hero() {
  const reduce = useReducedMotion()
  const { openDemoRequest, openDemoAccess } = useMenu()
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { duration: 0.8, ease, delay },
  })

  return (
    <section id="top" className="hero-shell" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <AnimatedHeading as="h1" id="hero-heading" className="hero-title" text="Own every direct booking." delay={reduce ? 0 : 200} />
        <motion.p className="mx-auto mt-6 max-w-[36rem] text-lg leading-relaxed text-muted-foreground" {...rise(0.45)}>
          StaySphere is a white-label booking front end for independent hotels: search, room, services and payment on the hotel’s own domain — no redirects, no commission.
        </motion.p>
        <motion.div className="mt-8 flex flex-wrap justify-center gap-2.5" {...rise(0.6)}>
          <Button onClick={openDemoAccess} variant="primary" size="lg">
            Start free trial <ArrowUpRight />
          </Button>
          <Button onClick={() => openDemoRequest()} variant="secondary" size="lg">
            Request a demo <ArrowUpRight />
          </Button>
          <Button href="#pricing" variant="ghost" size="lg">
            View pricing <ArrowRight />
          </Button>
        </motion.div>
      </div>

      <HeroBento />
    </section>
  )
}
