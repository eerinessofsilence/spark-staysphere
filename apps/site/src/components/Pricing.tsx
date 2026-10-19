import { useMenu } from '../lib/menu'
import { PRICING_PAGE } from '../lib/nav'
import { plans } from '../lib/plans'
import { AnimatedHeading } from './AnimatedHeading'
import { Button, Reveal } from './ui'
import { FAQ } from './FAQ'

const faqs: [string, string][] = [
  ['Is this a PMS?', 'This edition includes Guest and CMS. Reservations, front desk, housekeeping, accounting and channel management belong to the separate PMS project.'],
  ['Where do guests book?', 'Connect the hotel’s existing booking website in CMS. Without a booking link, Guest remains a room showcase.'],
  ['What do the prices in Guest mean?', 'Room prices are optional reference prices. Final prices and availability are confirmed by the hotel’s booking provider.'],
  ['Can I explore a demo?', 'Open the sample CMS or the public Guest showcase. Local demo access does not create an account or start a billed subscription.'],
]
export function Pricing() {
  const { openDemoAccess } = useMenu()
  return <section id="pricing" className="container-site pt-32 sm:pt-40 lg:pt-52" aria-labelledby="pricing-heading">
    <AnimatedHeading id="pricing-heading" className="text-display text-4xl sm:text-5xl lg:text-6xl" text="Guest + CMS, sized for your hotel." />
    <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Discuss your rooms, media and deployment needs. Pricing for the independent CMS edition is agreed in your proposal.</p>
    <ul className="mt-14 grid gap-5 lg:grid-cols-3">{plans.map((plan, index) => <Reveal as="li" key={plan.slug} delay={index * 90}>
      <article className="flex h-full flex-col rounded-card bg-card p-7 shadow-soft">
        <h3 className="text-2xl font-semibold">{plan.name}</h3><p className="mt-4 text-base text-muted-foreground">{plan.tagline}</p>
        <ul className="mt-6 flex-1 space-y-3 text-base">{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
        <Button href={`${PRICING_PAGE}?plan=${plan.slug}`} size="lg" className="mt-8 w-full">Request a quote</Button>
        <Button onClick={openDemoAccess} variant="secondary" size="lg" className="mt-3 w-full">Explore the demo</Button>
      </article>
    </Reveal>)}</ul>
    <div className="mt-16"><FAQ items={faqs} /></div>
  </section>
}
