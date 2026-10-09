import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { AnimatedHeading } from './AnimatedHeading'

type Tone = 'sage' | 'sand' | 'clay' | 'rose'
/** Same light-tint-on-dark-ink pairing as the amenity icons in RoomDetails,
    just on the dark card instead of the canvas — one colour language either way. */
const badge: Record<Tone, string> = {
  sage: 'bg-tint-sage text-tint-sage-ink',
  sand: 'bg-tint-sand text-tint-sand-ink',
  clay: 'bg-tint-clay text-tint-clay-ink',
  rose: 'bg-tint-rose text-tint-rose-ink',
}

/** Filled marks on a 24-grid: solid shapes, holes cut with even-odd. */
const icons: Record<string, ReactNode> = {
  direct: (
    <>
      <path fillRule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 3.2a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6Z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  clear: <path fillRule="evenodd" d="M7 4h10a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Zm1.5 6.6a1.4 1.4 0 0 0 0 2.8h7a1.4 1.4 0 0 0 0-2.8h-7Z" />,
  flexible: (
    <>
      <rect x="2.5" y="6.4" width="19" height="3.2" rx="1.6" />
      <rect x="2.5" y="14.4" width="19" height="3.2" rx="1.6" />
      <circle cx="9" cy="8" r="3" />
      <circle cx="15" cy="16" r="3" />
    </>
  ),
  conversion: (
    <>
      <path d="M3.3 16.3 9.4 9.7a1.6 1.6 0 0 1 2.3 0l2.6 2.7 4.4-4.9 2.3 2.2-5.5 6.1a1.6 1.6 0 0 1-2.3.1l-2.6-2.7-4.9 5.3-2.4-2.2Z" />
      <path d="M14.6 6h5.9v5.9l-2.6-.4v-2.9h-2.9L14.6 6Z" />
    </>
  ),
}

const principles: { title: string; text: string; tone: Tone; icon: keyof typeof icons }[] = [
  { title: 'Direct', text: 'The hotel owns the guest journey. No redirect, no marketplace, no commission between the guest and the property.', tone: 'sage', icon: 'direct' },
  { title: 'Clear', text: 'Every step is designed around confident decisions: one question per screen, the total always in view.', tone: 'sand', icon: 'clear' },
  { title: 'Flexible', text: 'A white-label experience that adapts to different hotel brands through tokens for colour, type and imagery.', tone: 'clay', icon: 'flexible' },
  { title: 'Conversion-focused', text: 'Less friction between discovering a room and confirming a stay. Six steps, no account, no card form in the demo.', tone: 'rose', icon: 'conversion' },
]

/**
 * The page's one dark beat outside the hero and the flow demo: a case-for-us
 * panel, not another product screen. Heading and lede sit fixed on the left;
 * the four principles run as an icon-led list on the right, in the site's own
 * tint pairs so it still reads as StaySphere even in negative.
 */
export function ProductPrinciples() {
  return (
    <section id="principles" className="container-site pt-24 sm:pt-32 lg:pt-40" aria-labelledby="principles-heading">
      <div className="rounded-card bg-ink px-6 py-14 text-[#F7F5F0] sm:px-10 sm:py-20 lg:px-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <AnimatedHeading id="principles-heading" className="text-display max-w-[12ch] text-4xl text-white sm:text-5xl" text="Why choose StaySphere." />
            <p className="mt-5 max-w-xs text-base leading-relaxed text-white/55">
              Four things every screen in the product has to be, whichever hotel it is wearing.
            </p>
          </div>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:col-span-8">
            {principles.map((p, i) => (
              <motion.li
                key={p.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className={`inline-flex size-12 items-center justify-center rounded-full ${badge[p.tone]}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-6">
                    {icons[p.icon]}
                  </svg>
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{p.text}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
