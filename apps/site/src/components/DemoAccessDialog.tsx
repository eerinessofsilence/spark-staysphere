import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { DEMO_ADMIN_URL, PMS_ONBOARDING_URL, STAYSPHERE_URL } from '../lib/links'
import { useMenu } from '../lib/menu'
import { ArrowUpRight, Button } from './ui'

const steps = [
  { title: 'Create your account', body: 'Choose Create account, then enter your hotel name, location, currency and time zone.' },
  { title: 'Start your hotel trial', body: 'Your private hotel workspace and seven-day trial begin when the hotel is created. Asteria Cove remains available separately as a demo.' },
]

/** Shared trial entry: explains the sample hotel before opening the PMS. */
export function DemoAccessDialog() {
  const { demoAccessOpen, closeDemoAccess } = useMenu()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!demoAccessOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // The menu trigger disappears after its exit animation; restore to the header instead.
    const returnFocus = previousFocus?.closest('#mobile-menu')
      ? document.querySelector<HTMLElement>('button[aria-controls="mobile-menu"]')
      : previousFocus
    const root = document.getElementById('root')
    const previousInert = root?.inert ?? false
    const htmlOverflow = document.documentElement.style.overflow
    const bodyOverflow = document.body.style.overflow
    // The portal is outside the app root, so the background can be inert.
    if (root) root.inert = true
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDemoAccess()
      }
      if (event.key !== 'Tab') return
      const controls = panelRef.current?.querySelectorAll<HTMLElement>('button, a[href]')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = htmlOverflow
      document.body.style.overflow = bodyOverflow
      if (root) root.inert = previousInert
      if (returnFocus?.isConnected) returnFocus.focus()
      else document.querySelector<HTMLElement>('button[aria-controls="mobile-menu"]')?.focus()
    }
  }, [demoAccessOpen, closeDemoAccess])

  if (!demoAccessOpen) return null

  return createPortal(
    <div role="presentation" onClick={closeDemoAccess} className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-access-heading"
        aria-describedby="demo-access-description"
        data-lenis-prevent
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100svh-2rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-card bg-card p-6 text-ink shadow-soft-xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="demo-access-heading" className="text-2xl font-semibold tracking-tight">Try StaySphere for yourself.</h2>
          <button ref={closeRef} type="button" onClick={closeDemoAccess} aria-label="Close demo guide" className="-mt-2 -mr-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p id="demo-access-description" className="mt-3 text-base leading-relaxed text-muted-foreground">Create your own hotel to start a 7-day free trial, or explore Asteria Cove with demo rooms and bookings.</p>

        <ol className="mt-6 divide-y divide-border border-y border-border">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4 py-5">
              <span aria-hidden className="pt-0.5 text-sm font-semibold text-accent-strong">{index + 1}.</span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Button href={PMS_ONBOARDING_URL} external size="lg" className="mt-6 w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Create a hotel and start free trial <ArrowUpRight /></Button>
        <Button href={DEMO_ADMIN_URL} external variant="ghost" size="lg" className="mt-2 w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Sign in to demo <ArrowUpRight /></Button>
        <Button href={STAYSPHERE_URL} external variant="ghost" size="lg" className="mt-2 w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Try guest booking <ArrowUpRight /></Button>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Guest booking needs no admin login. If the hotel admin or demo login option is unavailable, explore the guest experience instead. Use sample guest details; payments are simulated.</p>
      </div>
    </div>,
    document.body,
  )
}
