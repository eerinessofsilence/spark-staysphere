import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { SPARK_URL, STAYSPHERE_URL } from '../lib/links'
import { AnimatedHeading } from './AnimatedHeading'
import { FadeIn } from './motion'
import { ArrowRight, ArrowUpRight, Button } from './ui'

export function FinalCTA() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const bgY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.15, 1])
  return (
    <section id="cta" className="container-site pt-24 sm:pt-32 lg:pt-40" aria-labelledby="cta-heading">
      <div ref={ref} className="relative overflow-hidden rounded-card bg-ink text-[#F7F5F0]">
        <motion.img style={{ y: bgY, scale: bgScale }} src="/photos/rooms-asteria-penthouse-terrace.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/10" />
        <div className="relative flex min-h-[34rem] flex-col items-center justify-center p-6 text-center sm:p-12 lg:min-h-[42rem] lg:p-16">
          <AnimatedHeading id="cta-heading" className="text-display mx-auto max-w-[12ch] text-4xl sm:text-5xl lg:text-7xl" text="Own the booking experience." />
          <FadeIn delay={0.2}><p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-white/70">StaySphere brings the entire direct-booking journey into one elegant, hotel-branded experience.</p></FadeIn>
          <FadeIn delay={0.3} className="mt-8 flex flex-wrap justify-center gap-2.5">
            <Button href={STAYSPHERE_URL} external variant="inverse" size="lg">Explore StaySphere <ArrowUpRight /></Button>
            <Button href={SPARK_URL} variant="ghost-inverse" size="lg">Back to Spark <ArrowRight /></Button>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
