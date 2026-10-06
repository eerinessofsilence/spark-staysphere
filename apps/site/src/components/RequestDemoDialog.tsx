import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CONTACT_EMAIL } from '../lib/links'
import { useMenu } from '../lib/menu'
import { ease } from './motion'
import { ArrowUpRight } from './ui'

/** Common calling codes — enough coverage for a concept product's demo form, not the full ITU list. */
const COUNTRIES = [
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
  { code: 'CY', name: 'Cyprus', dial: '+357', flag: '🇨🇾' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
] as const

function buildMailto(title: string, fields: { name: string; property: string; email: string; phone: string; message: string }) {
  const lines = [
    fields.message.trim(),
    fields.message.trim() ? '' : null,
    `Name: ${fields.name}`,
    fields.property.trim() ? `Property / portfolio: ${fields.property}` : null,
    `Email: ${fields.email}`,
    `Phone: ${fields.phone}`,
  ].filter((l): l is string => l !== null)
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(lines.join('\n'))}`
}

/**
 * The one "Request a demo" / "Talk to us" form on the site, opened from any
 * CTA through `useMenu().openDemoRequest()`. There is no backend behind this
 * page (booking and payment are simulated inside the StaySphere demo
 * itself), so submitting hands off to the visitor's own mail client with
 * everything filled in — honest about what actually happens, rather than a
 * fake "message sent" screen. `demoRequest.message` seeds the message field
 * (e.g. the calculator's chosen rooms/channels/billing) and stays editable.
 */
export function RequestDemoDialog() {
  const reduce = useReducedMotion()
  const { demoRequest, closeDemoRequest } = useMenu()
  const [name, setName] = useState('')
  const [property, setProperty] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>(COUNTRIES[0])
  const [countryOpen, setCountryOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const countryRef = useRef<HTMLDivElement>(null)

  // The seed message resyncs when a fresh request comes in — adjusted during
  // render (React's own pattern for this) rather than an effect, so the
  // field never flashes the previous request's text first.
  if (demoRequest && demoRequest.message !== lastMessage) {
    setLastMessage(demoRequest.message)
    setMessage(demoRequest.message)
  }

  useEffect(() => {
    if (!demoRequest) return
    firstFieldRef.current?.focus()
    // `<html>`, not `<body>`, is what `window.scrollY` actually moves —
    // locking only `body` leaves the page free to scroll behind the dialog.
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Closes the country list first, if it's the thing actually open on top.
        if (countryOpen) setCountryOpen(false)
        else closeDemoRequest()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('input, textarea, button, a[href]')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [demoRequest, closeDemoRequest, countryOpen])

  // Outside-click for the country list only — the backdrop's own onClick
  // already closes the whole dialog, so this must stop short of that.
  useEffect(() => {
    if (!countryOpen) return
    const onClick = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setCountryOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [countryOpen])

  if (!demoRequest) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    window.location.href = buildMailto(demoRequest.title, { name, property, email, phone: `${country.dial} ${phone}`.trim(), message })
    closeDemoRequest()
    setName('')
    setProperty('')
    setEmail('')
    setPhone('')
  }

  return (
    <AnimatePresence>
      <motion.div
        role="presentation"
        onClick={closeDemoRequest}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm sm:p-6"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease }}
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-request-heading"
          data-lenis-prevent
          onClick={(e) => e.stopPropagation()}
          className="max-h-[calc(100svh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-card border border-ink/[0.07] bg-card p-7 text-ink shadow-soft-xl sm:p-8"
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.3, ease }}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id="demo-request-heading" className="text-2xl font-semibold tracking-tight">
              {demoRequest.title}
            </h2>
            <button
              type="button"
              onClick={closeDemoRequest}
              aria-label="Close"
              className="-mt-1 -mr-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-stone hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Add your contact details to the request. Your email app will open with everything ready to send.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="demo-name" className="text-sm font-medium text-ink/80">
                  Name
                </label>
                <input
                  ref={firstFieldRef}
                  id="demo-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 block w-full rounded-tile border border-border bg-canvas px-4 py-2.5 text-sm text-ink transition-colors focus:border-ink focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="demo-property" className="text-sm font-medium text-ink/80">
                  Property / portfolio
                </label>
                <input
                  id="demo-property"
                  type="text"
                  autoComplete="organization"
                  value={property}
                  onChange={(e) => setProperty(e.target.value)}
                  className="mt-1.5 block w-full rounded-tile border border-border bg-canvas px-4 py-2.5 text-sm text-ink transition-colors focus:border-ink focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="demo-email" className="text-sm font-medium text-ink/80">
                  Email
                </label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-tile border border-border bg-canvas px-4 py-2.5 text-sm text-ink transition-colors focus:border-ink focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="demo-phone" className="text-sm font-medium text-ink/80">
                  Phone
                </label>
                <div className="mt-1.5 flex items-stretch rounded-tile border border-border bg-canvas transition-colors focus-within:border-ink">
                  <div ref={countryRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setCountryOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={countryOpen}
                      aria-label={`Country code: ${country.name}, ${country.dial}`}
                      className="flex h-full cursor-pointer items-center gap-1.5 rounded-l-tile py-2.5 pl-4 pr-2.5 text-sm text-ink transition-colors hover:bg-stone/60"
                    >
                      <span aria-hidden>{country.flag}</span>
                      <span className="tabular-nums">{country.dial}</span>
                      <svg viewBox="0 0 20 20" className={`size-3 text-ink/50 transition-transform duration-200 ${countryOpen ? 'rotate-180' : ''}`} fill="none" aria-hidden>
                        <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {countryOpen && (
                      <ul
                        role="listbox"
                        aria-label="Country code"
                        className="absolute top-full left-0 z-10 mt-1.5 max-h-60 w-56 overflow-y-auto rounded-tile border border-ink/[0.07] bg-white p-1 text-ink shadow-soft-lg"
                      >
                        {COUNTRIES.map((c) => (
                          <li key={c.code}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={c.code === country.code}
                              onClick={() => {
                                setCountry(c)
                                setCountryOpen(false)
                              }}
                              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-left text-sm transition-colors hover:bg-stone/60 ${c.code === country.code ? 'font-semibold' : ''}`}
                            >
                              <span aria-hidden>{c.flag}</span>
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="text-ink/50 tabular-nums">{c.dial}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span aria-hidden className="my-2 w-px shrink-0 bg-border" />
                  <input
                    id="demo-phone"
                    type="tel"
                    required
                    autoComplete="tel-national"
                    placeholder="555 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="min-w-0 flex-1 rounded-r-tile bg-transparent py-2.5 pr-4 pl-2.5 text-sm text-ink focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="demo-message" className="text-sm font-medium text-ink/80">
                Message
              </label>
              <textarea
                id="demo-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1.5 block w-full resize-none rounded-tile border border-border bg-canvas px-4 py-3 text-sm leading-relaxed text-ink transition-colors focus:border-ink focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="group inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-6 text-base font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary-hover"
            >
              Send request <ArrowUpRight className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" />
            </button>
            <p className="text-xs leading-relaxed text-muted-foreground">Opens your email client with these details — this concept product has no backend to send it from directly.</p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
