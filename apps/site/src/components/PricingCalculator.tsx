import { useState } from 'react'
import { useMenu } from '../lib/menu'
import { plans, planBySlug } from '../lib/plans'
import { CMS_MODULES } from '../lib/modules'
import { AnimatedHeading } from './AnimatedHeading'
import { Button } from './ui'

export function PricingCalculator() {
  const { openDemoRequest, openDemoAccess } = useMenu()
  const [plan, setPlan] = useState(() => planBySlug(new URLSearchParams(window.location.search).get('plan')))
  const [rooms, setRooms] = useState('20')
  const [properties, setProperties] = useState('1')
  return <section id="calculator" className="container-site pt-40 sm:pt-52" aria-labelledby="calculator-heading">
    <AnimatedHeading as="h1" id="calculator-heading" className="text-display text-4xl sm:text-5xl lg:text-6xl" text="Plan your Guest + CMS setup." />
    <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Tell us about your property. The proposal covers content, 360° media and deployment; reservations stay with your existing booking provider.</p>
    <div className="mt-12 grid gap-8 lg:grid-cols-2">
      <div className="rounded-card bg-card p-7 shadow-soft">
        <div role="group" aria-label="Property size" className="flex flex-wrap gap-2">{plans.map((option) => <button key={option.slug} type="button" aria-pressed={plan.slug === option.slug} onClick={() => setPlan(option)} className={`min-h-11 rounded-full px-5 text-sm font-semibold ${plan.slug === option.slug ? 'bg-ink text-primary-foreground' : 'bg-stone text-ink'}`}>{option.name}</button>)}</div>
        <label className="mt-8 block text-base font-medium" htmlFor="rooms">Rooms in total</label><input id="rooms" type="number" min="1" value={rooms} onChange={(event) => setRooms(event.target.value)} className="mt-2 min-h-12 w-full rounded-tile border border-border p-3 text-base" />
        <label className="mt-5 block text-base font-medium" htmlFor="properties">Properties</label><input id="properties" type="number" min="1" value={properties} onChange={(event) => setProperties(event.target.value)} className="mt-2 min-h-12 w-full rounded-tile border border-border p-3 text-base" />
        <Button onClick={() => openDemoRequest({ title: 'Request a Guest + CMS proposal', message: `Setup: ${plan.name}\nRooms: ${rooms}\nProperties: ${properties}\nScope: Guest + CMS, media, 360° orbit and external booking link.\nPlease confirm scope and pricing.` })} size="lg" className="mt-8 w-full">Request a proposal</Button>
        <Button onClick={openDemoAccess} variant="secondary" size="lg" className="mt-3 w-full">Explore the demo</Button>
      </div>
      <div className="rounded-card bg-stone p-7"><h2 className="text-2xl font-semibold">The CMS edition</h2><ul className="mt-6 space-y-5">{CMS_MODULES.map((module) => <li key={module.id}><h3 className="text-lg font-semibold">{module.name}</h3><p className="mt-1 text-sm text-muted-foreground">{module.detail}</p></li>)}</ul></div>
    </div>
  </section>
}
