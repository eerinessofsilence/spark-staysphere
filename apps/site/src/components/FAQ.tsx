import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'

type Tone = 'sage' | 'sand' | 'clay' | 'rose'
const TONES: Tone[] = ['sage', 'sand', 'clay', 'rose']
const badge: Record<Tone, string> = {
  sage: 'bg-tint-sage text-tint-sage-ink',
  sand: 'bg-tint-sand text-tint-sand-ink',
  clay: 'bg-tint-clay text-tint-clay-ink',
  rose: 'bg-tint-rose text-tint-rose-ink',
}

export function FAQ({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <dl className="divide-y divide-border border-y border-border">
      {items.map(([q, a], i) => {
        const isOpen = open === i
        const tone = TONES[i % TONES.length]
        return (
          <div key={q}>
            <dt>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="-mx-4 flex w-full cursor-pointer items-center gap-4 rounded-tile px-4 py-5 text-left transition-colors duration-200 hover:bg-stone/50"
              >
                <span aria-hidden className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${badge[tone]}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-lg font-semibold tracking-tight">{q}</span>
                <motion.span
                  aria-hidden
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${isOpen ? 'bg-ink text-primary-foreground' : 'bg-stone text-ink'}`}
                >
                  <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
                    <path d="m5.5 7.5 4.5 5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
              </button>
            </dt>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.dd
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <motion.p
                    initial={{ y: -6 }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="max-w-2xl pb-6 pl-12 text-base leading-relaxed text-muted-foreground"
                  >
                    {a}
                  </motion.p>
                </motion.dd>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </dl>
  )
}
