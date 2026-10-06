import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useRef, useState } from 'react'
import { AnimatedHeading } from './AnimatedHeading'
import { ease, FadeIn } from './motion'

const steps = [
  { n: '01', title: 'Search', text: 'Dates and guests first. Nothing else stands between the guest and the rooms.', src: '/ui/t-search-form.webp', fit: 'object-contain p-8 lg:p-14', alt: 'Search form' },
  { n: '02', title: 'Explore rooms', text: 'A grid of real rooms with size, bed and nightly rate, filterable by budget, view and amenities.', src: '/ui/d-rooms-full.webp', fit: 'object-cover object-[center_17%]', alt: 'Rooms grid' },
  { n: '03', title: 'Choose a stay', text: 'Photography, amenities, rate conditions and a running total, all on one page.', src: '/ui/d-room-full.webp', fit: 'object-cover object-[center_11%]', alt: 'Room page' },
  { n: '04', title: 'Add services', text: 'Transfers, breakfast, spa and more, priced by the booking engine and added to the total instantly.', src: '/ui/d-step-3.webp', fit: 'object-cover object-top', alt: 'Extras step' },
  { n: '05', title: 'Review', text: 'Every decision on one screen before anything is created. Price and availability are rechecked on confirm.', src: '/ui/d-step-6.webp', fit: 'object-cover object-top', alt: 'Review step' },
  { n: '06', title: 'Confirm', text: 'A reference, the room, the services and what was paid. The guest is booked in, directly with the hotel.', src: '/ui/d-confirmation.webp', fit: 'object-cover object-top', alt: 'Confirmation' },
]

/** Sticky showcase: the panel on the right stays pinned while the steps scroll past on the left. */
export function BookingFlow() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 60%', 'end 60%'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length)))))

  return (
    <section id="experience" className="container-site pt-24 sm:pt-32 lg:pt-40" aria-labelledby="experience-heading">
      <AnimatedHeading id="experience-heading" className="text-display max-w-[13ch] text-4xl sm:text-5xl lg:text-6xl" text="One journey, start to finish." />
      <FadeIn delay={0.15}>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Six steps, one continuous screen. The guest sees the room, the services and the running total before committing to anything, and the panel updates in place instead of jumping between pages.
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
