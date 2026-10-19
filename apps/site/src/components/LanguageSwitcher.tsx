import { useEffect, useRef, useState } from 'react'
import { Globe } from './ui'

const trigger = 'bg-ink/5 text-ink hover:bg-ink/10'

const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'ES', label: 'Español' },
  { code: 'FR', label: 'Français' },
  { code: 'DE', label: 'Deutsch' },
]

/**
 * Icon-only language picker for the header. This is a single-language demo,
 * so picking an option just swaps the checkmark — there's no translated
 * copy behind it yet.
 */
export function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('EN')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className={`inline-flex size-10 cursor-pointer items-center justify-center rounded-full transition-colors ${trigger}`}
      >
        <Globe className="size-[18px]" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Choose language"
          className="absolute top-12 right-0 z-10 w-36 overflow-hidden rounded-card border border-ink/[0.07] bg-white/95 p-1 text-ink shadow-soft-lg backdrop-blur-xl"
        >
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={current === l.code}
                onClick={() => {
                  setCurrent(l.code)
                  setOpen(false)
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-full px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-black/5 ${current === l.code ? 'text-ink' : 'text-ink/70'}`}
              >
                {l.label}
                {current === l.code && (
                  <svg viewBox="0 0 20 20" fill="none" className="size-3.5 shrink-0" aria-hidden>
                    <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
