import { useState } from 'react'
import { useMenu } from '../lib/menu'
import { PRICING_PAGE } from '../lib/nav'
import { plans } from '../lib/plans'
import { AnimatedHeading } from './AnimatedHeading'
import { SOLUTIONS } from './SolutionsMenu'
import { ArrowUpRight, Button, Reveal } from './ui'
import { FAQ } from './FAQ'

const faqs = [
  ['Can I try it for free?', 'Yes. Start with the Asteria Cove demo hotel to explore the PMS. Demo access is separate from a tailored plan or payment.'],
  ['Is there a commission on bookings?', 'No. Every plan is a flat monthly fee. Direct bookings stay with the hotel, at the hotel’s rate.'],
  ['What does white-label mean here?', 'Your brand only. Colours, type, imagery, domain and emails are yours; StaySphere is not mentioned to guests.'],
  ['How long does setup take?', 'A single property is usually live within a week: rooms, rates, photography and policies, then a review call.'],
  ['Can we cancel?', 'Monthly plans cancel any time. Yearly plans are billed up front and can be paused for seasonal closures.'],
]

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 size-4 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="9" className="fill-tint-sage" />
      <path d="m6.5 10.2 2.3 2.3 4.7-4.8" stroke="#4c6a4e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Pricing() {
  const { openDemoRequest, openDemoAccess } = useMenu()
  const [yearly, setYearly] = useState(true)

  return (
    <section id="pricing" className="container-site pt-24 sm:pt-32 lg:pt-40" aria-labelledby="pricing-heading">
      {/* Toggle sits on the heading's baseline row from lg; the heading is a single line
          there, so a flex row is safer than a 12-col grid that used to split at 1024. */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <AnimatedHeading id="pricing-heading" className="text-display text-4xl sm:text-5xl lg:text-6xl" text="One flat fee. No commission." />
        </div>
        <div className="shrink-0 lg:pb-2">
          <Reveal delay={140}>
            <div role="group" aria-label="Billing period" className="inline-flex items-center rounded-full bg-card p-1 shadow-soft">
              {[
                ['Monthly', false],
                ['Yearly', true],
              ].map(([label, val]) => (
                <button
                  key={String(label)}
                  type="button"
                  aria-pressed={yearly === val}
                  onClick={() => setYearly(val as boolean)}
                  className={`min-h-10 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors ${yearly === val ? 'bg-ink text-primary-foreground' : 'text-ink/70 hover:bg-stone/70'}`}
                >
                  {label}
                  {val && <span className="ml-2 rounded-full bg-tint-sage px-2 py-0.5 text-xs font-medium text-tint-sage-ink">−20%</span>}
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      <ul className="mt-14 grid gap-5 lg:grid-cols-3 lg:gap-6">
        {plans.map((p, i) => {
          const price = yearly ? p.yearly : p.monthly
          // Same hotel-size framing as the Solutions menu and the
          // calculator: the size is the headline, the plan name (still
          // what the CTA and feature list below call it) is the subtitle.
          const sol = SOLUTIONS.find((s) => s.slug === p.slug)!
          return (
            <Reveal as="li" key={p.name} delay={i * 90} className="flex">
              <article
                className={`flex w-full flex-col rounded-card p-7 sm:p-8 ${
                  p.featured ? 'bg-ink text-[#F7F5F0] shadow-soft-lg' : 'bg-card text-ink shadow-soft'
                }`}
                aria-label={`${sol.name}, the ${p.name} plan`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full ${p.featured ? 'bg-white/10 text-white' : 'bg-stone text-ink'}`}>
                      <sol.Icon />
                    </span>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">{sol.name}</h3>
                      <p className={`text-sm font-medium ${p.featured ? 'text-white/50' : 'text-muted-foreground'}`}>
                        {p.name} · {sol.meta}
                      </p>
                    </div>
                  </div>
                  {p.featured && (
                    <span className="rounded-full bg-[#F7F5F0] px-3 py-1 text-xs font-semibold text-[#161616]">Most chosen</span>
                  )}
                </div>
                <p className={`mt-5 text-base leading-relaxed ${p.featured ? 'text-white/60' : 'text-muted-foreground'}`}>{p.tagline}</p>

                <p className="mt-8 flex items-baseline gap-2">
                  {price !== null ? (
                    <>
                      <span className="text-display text-4xl tabular-nums sm:text-5xl">€{price}</span>
                      <span className={`text-sm ${p.featured ? 'text-white/55' : 'text-muted-foreground'}`}>/ month</span>
                    </>
                  ) : (
                    <span className="text-display text-4xl sm:text-5xl">Custom</span>
                  )}
                </p>
                <p className={`mt-2 text-xs ${p.featured ? 'text-white/50' : 'text-muted-foreground'}`}>
                  {p.note}
                  {price !== null && yearly ? ', billed yearly' : ''}
                </p>

                <div className="mt-8">
                  {p.slug === 'group' ? (
                    // Custom has no price to land on a calculator with — go straight to the form.
                    <Button onClick={() => openDemoRequest({ title: 'Talk to us about your portfolio' })} variant={p.featured ? 'inverse' : 'primary'} size="lg" className="w-full">
                      {p.cta} <ArrowUpRight />
                    </Button>
                  ) : (
                    // Independent and Boutique land on the calculator with themselves
                    // preselected; that page's own CTA is what opens the live demo.
                    <Button href={`${PRICING_PAGE}?plan=${p.slug}#calculator`} variant={p.featured ? 'inverse' : 'primary'} size="lg" className="w-full">
                      {p.cta} <ArrowUpRight />
                    </Button>
                  )}
                  <Button onClick={openDemoAccess} variant={p.featured ? 'ghost-inverse' : 'secondary'} size="lg" className="mt-3 w-full">
                    Start free trial <ArrowUpRight />
                  </Button>
                </div>

                <ul className={`mt-8 space-y-3 border-t pt-7 text-base ${p.featured ? 'border-white/10' : 'border-border'}`}>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check />
                      <span className={p.featured ? 'text-white/85' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          )
        })}
      </ul>

      <Reveal delay={120} className="mt-16 grid gap-10 lg:mt-20 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <h3 className="text-2xl font-semibold tracking-tight">Questions hotels ask first.</h3>
          <p className="mt-3 max-w-xs text-base leading-relaxed text-muted-foreground">Prices are indicative for the concept product and shown in euros, excluding VAT.</p>
        </div>
        <div className="lg:col-span-9"><FAQ items={faqs as [string, string][]} /></div>
      </Reveal>
    </section>
  )
}
