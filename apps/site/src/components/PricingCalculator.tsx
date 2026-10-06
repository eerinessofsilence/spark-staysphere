import { useMemo, useState } from 'react'
import { useMenu } from '../lib/menu'
import { includedModules, optionalModules, type ModuleOption } from '../lib/modules'
import { eur, eurUnit, planBySlug, quote, type PlanSlug } from '../lib/plans'
import { AnimatedHeading } from './AnimatedHeading'
import { FadeIn } from './motion'
import { SOLUTIONS } from './SolutionsMenu'
import { ArrowRight, ArrowUpRight, Button } from './ui'

/** Where a slider should land when the plan changes: keep the value if it fits, else the plan's included allowance. */
const fit = (value: number, range: { min: number; max: number; included: number }) => (value >= range.min && value <= range.max ? value : range.included)

function Field({ id, label, value, unit, min, max, step = 1, onChange, hint }: { id: string; label: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (v: number) => void; hint?: string }) {
  const fixed = min === max
  // The number box is its own text while it's being typed — a controlled
  // input tied straight to the (rounded, clamped) value fights the caret on
  // every keystroke. It resyncs whenever the value changes from elsewhere
  // (the slider, or a plan switch refitting the range) — adjusted during
  // render, React's own pattern for this, rather than an effect that would
  // just cause a second, avoidable render — and commits back on blur/Enter.
  const [text, setText] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(String(value))
  }
  const commit = (raw: string) => {
    // `Number('')` is 0, not NaN — without this guard, clearing the box and
    // blurring would silently commit the minimum instead of leaving the
    // value alone.
    if (raw.trim() === '') {
      setText(String(value))
      return
    }
    const n = Math.round(Number(raw))
    onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-base font-semibold tracking-tight">
          {label}
        </label>
        <output htmlFor={id} className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
          <span className="ml-1.5 text-sm font-medium text-muted-foreground">{unit}</span>
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={fixed}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 w-full accent-ink disabled:opacity-40"
      />
      <div className="mt-2 flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground tabular-nums">{min}</span>
        <label htmlFor={`${id}-exact`} className="flex items-center gap-2 text-sm text-muted-foreground">
          or type it
          <input
            id={`${id}-exact`}
            type="number"
            inputMode="numeric"
            aria-label={`${label}, exact number`}
            min={min}
            max={max}
            step={step}
            value={text}
            disabled={fixed}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
            className="min-h-11 w-20 rounded-tile border border-border bg-canvas px-2.5 py-1 text-center text-base font-semibold text-ink tabular-nums transition-colors [appearance:textfield] focus:border-ink focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <span className="text-sm text-muted-foreground tabular-nums">{max}</span>
      </div>
      {hint && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

const steps = [
  { title: 'Your property', description: 'Set rooms and channels' },
  { title: 'Modules', description: 'Explore included and optional modules' },
  { title: 'Review your price', description: 'Choose a billing period' },
] as const

const optionalGroups = [
  { category: 'operations', title: 'Operations', description: 'Tools for the hotel team.' },
  { category: 'distribution', title: 'Distribution', description: 'Rates and sales channels.' },
  { category: 'guest', title: 'Guest experience', description: 'Guest messaging and room discovery.' },
] as const

function ModuleChoices({ title, description, modules, selected, onToggle }: { title: string; description: string; modules: ModuleOption[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {modules.map((module) => {
          const active = selected.includes(module.id)
          return (
            <button key={module.id} type="button" aria-pressed={active} onClick={() => onToggle(module.id)} className={`flex min-h-20 w-full cursor-pointer items-center justify-between gap-3 rounded-tile border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${active ? 'border-ink bg-stone/70' : 'border-border bg-canvas hover:bg-stone/40'}`}>
              <span><span className="block text-sm font-semibold">{module.name}</span><span className="mt-1 block text-xs text-muted-foreground">{module.detail}</span><span className="mt-2 block text-sm font-semibold">+{eur.format(module.price)} / month</span></span>
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${active ? 'bg-ink text-primary-foreground' : 'bg-stone text-ink'}`} aria-hidden>{active ? '✓' : '+'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The staged configurator uses the PMS module catalog and the site's plan quote model. */
export function PricingCalculator() {
  const { openDemoRequest, openDemoAccess } = useMenu()
  const [slug, setSlugState] = useState<PlanSlug>(() => planBySlug(new URLSearchParams(window.location.search).get('plan')).slug)
  const plan = planBySlug(slug)
  const [step, setStep] = useState(1)
  const [yearly, setYearly] = useState(true)
  const [rooms, setRooms] = useState(plan.rooms.included)
  const [channels, setChannels] = useState(plan.channels.included)
  const [properties, setProperties] = useState(3)
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const toggleModule = (id: string) => setSelectedModules((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const included = includedModules(slug)
  const available = optionalModules(slug)
  const additions = available.filter((item) => selectedModules.includes(item.id))
  const moduleCost = additions.reduce((sum, item) => sum + item.price, 0)

  // Changing plan refits the sliders to the new ranges in the same event,
  // so there is never a render with a value outside its slider.
  const setSlug = (next: PlanSlug) => {
    const p = planBySlug(next)
    setSlugState(next)
    setRooms((r) => fit(r, p.rooms))
    setChannels((c) => fit(c, p.channels))
    setStep(1)
  }

  const q = useMemo(() => quote(plan, { rooms, channels, yearly, properties }), [plan, rooms, channels, yearly, properties])
  const yearlyQuote = useMemo(() => quote(plan, { rooms, channels, yearly: true, properties }), [plan, rooms, channels, properties])
  const totalMonthly = q.monthly + moduleCost
  const totalYearly = q.yearly + moduleCost * 12
  const isGroup = plan.slug === 'group'
  const atRoomCeiling = !isGroup && rooms === plan.rooms.max && plan.slug !== 'boutique'

  const orderMessage = `Plan: ${plan.name}\nProperties: ${q.properties}\nRooms in total: ${rooms}\nConnected channels: ${channels}\nBilling: ${yearly ? 'yearly' : 'monthly'}\nBase estimate: ${eur.format(q.monthly)} / month\nIncluded modules: ${included.map((item) => item.name).join(', ')}\nSelected modules: ${additions.length ? additions.map((item) => `${item.name} (+${eur.format(item.price)}/month)`).join(', ') : 'None'}\nTotal estimate: ${eur.format(totalMonthly)} / month, excluding VAT\nPlease confirm the final price and payment details.`
  const continueAction = <Button onClick={() => { setStep(3); openDemoRequest({ title: 'Request final price and payment details', message: orderMessage }) }} variant="inverse" size="lg" className="w-full">Continue to order <ArrowUpRight /></Button>

  return (
    <section id="calculator" className="container-site pt-32 sm:pt-40 lg:pt-44" aria-labelledby="calculator-heading">
      <div className="max-w-3xl">
        <AnimatedHeading as="h1" id="calculator-heading" className="text-display text-4xl sm:text-5xl lg:text-6xl" text="Build your direct-booking plan." />
        <FadeIn delay={0.15}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Choose a plan, tell us about your property, and see the monthly estimate update as you go. No commission on direct bookings.
          </p>
        </FadeIn>
      </div>

      <FadeIn delay={0.25} className="mt-14">
        <div role="tablist" aria-label="Choose a plan" className="grid gap-3 sm:grid-cols-3">
          {SOLUTIONS.map((solution, index) => (
            <button
              key={solution.slug}
              id={`plan-tab-${solution.slug}`}
              type="button"
              role="tab"
              aria-selected={solution.slug === slug}
              aria-controls="pricing-config"
              onClick={() => setSlug(solution.slug)}
              onKeyDown={(event) => {
                const nextIndex = event.key === 'ArrowRight' ? (index + 1) % SOLUTIONS.length : event.key === 'ArrowLeft' ? (index + SOLUTIONS.length - 1) % SOLUTIONS.length : event.key === 'Home' ? 0 : event.key === 'End' ? SOLUTIONS.length - 1 : -1
                if (nextIndex < 0) return
                event.preventDefault()
                const nextSlug = SOLUTIONS[nextIndex].slug
                setSlug(nextSlug)
                document.getElementById(`plan-tab-${nextSlug}`)?.focus()
              }}
              tabIndex={solution.slug === slug ? 0 : -1}
              className={`flex min-h-20 cursor-pointer items-center gap-4 rounded-card border px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${solution.slug === slug ? 'border-ink bg-ink text-primary-foreground shadow-soft' : 'border-border bg-card text-ink hover:bg-stone/60'}`}
            >
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${solution.slug === slug ? 'bg-white/10' : 'bg-stone'}`}><solution.Icon /></span>
              <span>
                <span className="block text-lg font-semibold tracking-tight">{solution.name}</span>
                <span className={`block text-sm ${solution.slug === slug ? 'text-white/65' : 'text-muted-foreground'}`}>{planBySlug(solution.slug).tagline}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="sticky top-24 z-20 mt-4 flex items-center justify-between gap-4 rounded-full bg-ink px-5 py-3 text-primary-foreground shadow-soft-lg lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-xs text-white/65">{plan.name} · {yearly ? 'yearly' : 'monthly'}</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{eur.format(totalMonthly)}<span className="ml-1 text-xs font-normal text-white/65">/ month</span></p>
          </div>
          <a href="#price-summary" className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Details <ArrowRight /></a>
        </div>

        <div id="pricing-config" role="tabpanel" aria-labelledby={`plan-tab-${slug}`} className="mt-6 grid items-start gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            {steps.map((item, index) => {
              const number = index + 1
              const open = number === step
              return (
                <div key={item.title} className="overflow-hidden rounded-card bg-card shadow-soft">
                  <button
                    type="button"
                    id={`pricing-step-${number}`}
                    aria-expanded={open}
                    aria-controls={`pricing-step-panel-${number}`}
                    aria-current={open ? 'step' : undefined}
                    onClick={() => setStep(number)}
                    className="flex min-h-20 w-full cursor-pointer items-center gap-4 px-6 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ink sm:px-8"
                  >
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${open ? 'bg-ink text-primary-foreground' : 'bg-stone text-ink'}`}>0{number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold tracking-tight">{item.title}</span>
                      <span className="block text-sm text-muted-foreground">{item.description}</span>
                    </span>
                    <ArrowRight className={`size-5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                  </button>
                  <div id={`pricing-step-panel-${number}`} role="region" aria-labelledby={`pricing-step-${number}`} hidden={!open} className="border-t border-border px-6 py-7 sm:px-8">
                    {number === 1 && (
                      <div>
                        <p className="text-base leading-relaxed text-muted-foreground">{plan.tagline} Your selections update the estimate immediately.</p>
                        <div className="mt-8 space-y-8">
                          {isGroup && <Field id="properties" label="Properties" value={properties} unit="in the group" min={2} max={20} onChange={setProperties} hint="One account and one contact for the portfolio." />}
                          <Field
                            id="rooms"
                            label="Rooms"
                            value={rooms}
                            unit={isGroup ? 'across all properties' : 'in the property'}
                            min={plan.rooms.min}
                            max={plan.rooms.max}
                            step={isGroup ? 10 : 1}
                            onChange={setRooms}
                            hint={atRoomCeiling ? `Independent stops at ${plan.rooms.max} rooms. Boutique has a higher limit.` : `${plan.rooms.included * q.properties} rooms included; ${eurUnit.format(plan.rooms.perExtra)} per room per month above that.`}
                          />
                          <Field
                            id="channels"
                            label="Connected channels"
                            value={channels}
                            unit={channels === 1 ? 'channel' : 'channels'}
                            min={plan.channels.min}
                            max={plan.channels.max}
                            onChange={setChannels}
                            hint={plan.channels.max === 1 ? 'Independent is direct-only. Boutique adds connected channels.' : `Your direct channel plus ${plan.channels.included - 1} connected; ${eur.format(plan.channels.perExtra)} per extra channel per month${isGroup ? ', per property' : ''}.`}
                          />
                        </div>
                        {atRoomCeiling && <button type="button" onClick={() => setSlug('boutique')} className="mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-stone px-5 text-sm font-semibold text-ink hover:bg-stone/70">Switch to Boutique <ArrowRight /></button>}
                        <button type="button" onClick={() => setStep(2)} className="mt-8 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink hover:text-accent-strong">See what is included <ArrowRight /></button>
                      </div>
                    )}
                    {number === 2 && (
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tight">Included in the base package</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">These {included.length} modules are included in this plan. Add the tools your hotel needs below.</p>
                        <ul className="mt-5 grid gap-x-4 gap-y-3 rounded-tile bg-tint-sage p-5 sm:grid-cols-2">
                          {included.map((module) => <li key={module.id} className="flex items-start gap-2 text-sm font-medium text-tint-sage-ink"><span aria-hidden>✓</span><span>{module.name}</span></li>)}
                        </ul>
                        {optionalGroups.map((group) => {
                          const modules = available.filter((module) => module.category === group.category)
                          return modules.length ? <ModuleChoices key={group.category} title={group.title} description={group.description} modules={modules} selected={selectedModules} onToggle={toggleModule} /> : null
                        })}
                        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Module prices are the PMS demo catalog's monthly estimates. Selecting a module does not activate an external integration.</p>
                        <button type="button" onClick={() => setStep(3)} className="mt-8 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink hover:text-accent-strong">Review your price <ArrowRight /></button>
                      </div>
                    )}
                    {number === 3 && (
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tight">Choose your billing cycle.</h3>
                        <div role="group" aria-label="Billing period" className="mt-6 grid gap-3 sm:grid-cols-2">
                          {([['Monthly', false], ['Yearly', true]] as const).map(([label, value]) => (
                            <button key={label} type="button" aria-pressed={yearly === value} onClick={() => setYearly(value)} className={`min-h-20 cursor-pointer rounded-tile border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${yearly === value ? 'border-ink bg-stone/60' : 'border-border hover:bg-stone/40'}`}>
                              <span className="block text-base font-semibold">{label}{value && <span className="ml-2 rounded-full bg-tint-sage px-2 py-1 text-xs text-tint-sage-ink">−20% on plan</span>}</span>
                              <span className="mt-1 block text-sm text-muted-foreground">{value ? `${eur.format(yearlyQuote.yearly + moduleCost * 12)} billed once a year` : 'Billed monthly, cancel any time'}</span>
                            </button>
                          ))}
                        </div>
                        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Your estimate is shown in the summary. Prices are indicative for the concept product, in euros, excluding VAT.</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <aside id="price-summary" aria-label="Price summary" className="flex scroll-mt-28 flex-col rounded-card bg-ink p-7 text-primary-foreground shadow-soft-lg sm:p-8 lg:sticky lg:top-28 lg:col-span-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Your estimate</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{plan.name}</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/75">{yearly ? 'Yearly' : 'Monthly'}</span>
          </div>

          <p className="mt-8 flex items-baseline gap-2">
            {isGroup && <span className="text-sm text-white/55">from</span>}
            <span aria-live="polite" className="text-display text-5xl tabular-nums">{eur.format(totalMonthly)}</span>
            <span className="text-sm text-white/55">/ month</span>
          </p>
          <p className="mt-2 text-sm text-white/50">
            {yearly ? `${eur.format(totalYearly)} billed yearly` : 'billed monthly, cancel any time'}
            {yearly && <span className="ml-2 rounded-full bg-tint-sage px-2 py-0.5 text-sm font-medium text-tint-sage-ink">−20% on plan</span>}
          </p>

          <dl className="mt-8 space-y-4 border-t border-white/10 pt-7 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-white/70">
                {isGroup ? `${q.properties} properties × ` : ''}
                {plan.name === 'Group' ? 'Boutique rate' : `${plan.name} plan`}
                {isGroup && <span className="ml-1 text-white/45">(−15% portfolio)</span>}
              </dt>
              <dd className="tabular-nums">{eur.format(q.base * q.properties)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/70">
                {q.extraRooms > 0 ? `${q.extraRooms} rooms above the included ${plan.rooms.included * q.properties}` : `${rooms} rooms, within the ${plan.rooms.included * q.properties} included`}
              </dt>
              <dd className="tabular-nums">{q.extraRooms > 0 ? eur.format(q.roomsCost) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/70">
                {q.extraChannels > 0 ? `${q.extraChannels} extra ${q.extraChannels === 1 ? 'channel' : 'channels'}` : `${channels} ${channels === 1 ? 'channel' : 'channels'}, included`}
              </dt>
              <dd className="tabular-nums">{q.extraChannels > 0 ? eur.format(q.channelsCost) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-4"><dt className="text-white/70">{included.length} included modules</dt><dd>Included</dd></div>
          </dl>

          <div aria-live="polite" className="mt-6 border-t border-white/10 pt-6">
            <p className="text-sm font-semibold">Selected modules ({additions.length})</p>
            {additions.length ? <ul className="mt-3 space-y-2 text-sm text-white/70">{additions.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.name}</span><span className="shrink-0">+{eur.format(item.price)}</span></li>)}</ul> : <p className="mt-2 text-sm text-white/55">None selected</p>}
          </div>

          <div className="mt-auto pt-8">
            {continueAction}
            <Button onClick={openDemoAccess} variant="ghost-inverse" size="lg" className="mt-3 w-full">Start free trial <ArrowUpRight /></Button>
            <p className="mt-3 text-xs leading-relaxed text-white/55">Explore the Asteria Cove demo hotel in the PMS. Demo access is separate from this price estimate.</p>
            <p className="mt-4 text-xs leading-relaxed text-white/50">
              Sends this configuration for a final quote and payment instructions. No payment is taken on this site. Module estimates are from the PMS demo catalog; VAT is excluded.
            </p>
          </div>
          </aside>
        </div>
      </FadeIn>
    </section>
  )
}
