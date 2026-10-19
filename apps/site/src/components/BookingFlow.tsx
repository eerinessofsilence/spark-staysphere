import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useRef, useState } from 'react'
import { AnimatedHeading } from './AnimatedHeading'
import { ease, FadeIn } from './motion'

const steps = [
  { n: '01', title: 'Explore the hotel', text: 'Turn the building through 360° and follow its interactive room zones.', src: '/ui/d-hero-scene.webp', fit: 'object-cover object-center', alt: 'Interactive hotel orbit' },
  { n: '02', title: 'Find a room', text: 'Browse rooms by view, size, bed and capacity.', src: '/ui/d-rooms-full.webp', fit: 'object-cover object-top', alt: 'Room catalog' },
  { n: '03', title: 'Look inside', text: 'Explore photographs and interior panoramas.', src: '/ui/d-room-gallery.webp', fit: 'object-cover object-top', alt: 'Room gallery and panorama' },
  { n: '04', title: 'Discover services', text: 'Read about dining, transfers and hotel experiences.', src: '/ui/d-room-services.webp', fit: 'object-contain', alt: 'Hotel services' },
  { n: '05', title: 'Read the details', text: 'Check room features, reference prices and hotel policies.', src: '/ui/d-room-full.webp', fit: 'object-cover object-top', alt: 'Room details' },
  { n: '06', title: 'Continue to booking', text: 'The connected booking provider handles dates, availability and payment.', src: '/ui/d-hero-scene.webp', fit: 'object-cover object-center', alt: 'Hotel showcase' },
]

/** Sticky showcase: the panel on the right stays pinned while the steps scroll past on the left. */
export function BookingFlow() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 60%', 'end 60%'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length)))))

  return (
    <section id="experience" className="container-site pt-24 sm:pt-32 lg:pt-40" aria-labelledby="experience-heading">
      <AnimatedHeading id="experience-heading" className="text-display max-w-[13ch] text-4xl sm:text-5xl lg:text-6xl" text="Discover before you book." />
      <FadeIn delay={0.15}>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Explore the property and rooms in Guest. CMS keeps the content current, while the hotel’s booking provider confirms availability and reservations.
        </p>
      </FadeIn>

      <div ref={ref} className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <ol className="order-2 lg:order-1 lg:col-span-4">
          {steps.map((s, i) => (
            <li key={s.n} className="flex items-center py-8 lg:min-h-[40vh] lg:py-0">
              {/* Below lg every step carries its own capture, so nothing is dimmed: a
                  faded image reads as broken, not inactive. From lg the sticky panel
                  shows the active step and the list fades the rest. */}
              <motion.div animate={{ opacity: i === active ? 1 : 0.28 }} transition={{ duration: 0.4 }} className="w-full max-lg:!opacity-100">
                <div className="flex items-end justify-between gap-6">
                  <h3 className="text-2xl font-semibold tracking-tight">{s.title}</h3>
                  {/* Bottom-aligned with the title, at the end of the row */}
                  <motion.span
                    aria-hidden
                    className="step-number text-display block shrink-0 text-4xl leading-none tabular-nums text-ink sm:text-5xl"
                    initial={{ opacity: 0, scale: 0.4, rotate: -10, y: 16 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                    viewport={{ once: true, amount: 0.7 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 13, mass: 0.7 }}
                  >
                    {s.n}
                  </motion.span>
                </div>
                <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">{s.text}</p>
                <div className="mt-6 overflow-hidden rounded-tile shadow-soft lg:hidden">
                  <img src={s.src} alt={s.alt} loading="lazy" className={`aspect-[4/3] w-full bg-card ${s.fit}`} />
                </div>
              </motion.div>
            </li>
          ))}
        </ol>
        <div className="order-1 hidden lg:order-2 lg:col-span-8 lg:block">
          <div className="sticky top-[14vh]">
            <div className="device-desktop">
              <div className="screen relative aspect-[16/10]">
                <AnimatePresence mode="sync">
                  <motion.img
                    key={steps[active].src}
                    src={steps[active].src}
                    alt={steps[active].alt}
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.7, ease }}
                    className={`absolute inset-0 h-full w-full bg-card ${steps[active].fit}`}
                  />
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
