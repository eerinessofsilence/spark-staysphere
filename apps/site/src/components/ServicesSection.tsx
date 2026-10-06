import { AnimatedHeading } from './AnimatedHeading'
import { FadeIn, Panel, Parallax } from './motion'
import { Chip, Shot } from './ui'

export function ServicesSection() {
  return (
    <section id="services" className="container-site pt-24 sm:pt-32 lg:pt-40" aria-labelledby="services-heading">
      <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
        <Panel className="order-2 lg:order-1 lg:col-span-7">
          <div className="relative rounded-card bg-tint-sage p-6 sm:p-10 lg:p-12">
            <div aria-hidden className="absolute -bottom-10 -left-10 size-72 rounded-full bg-tint-sand blur-3xl" />
            <Shot src="/ui/d-room-services.webp" alt="Add services list" width={1900} height={716} className="relative" />
            <div className="relative mt-5 grid gap-5 sm:grid-cols-[1.6fr_1fr]">
              <div className="overflow-hidden rounded-card bg-card shadow-soft-lg">
                <Shot src="/ui/d-room-dining.webp" alt="Order from the kitchen" width={1900} height={1164} className="shot-flat aspect-[4/3] rounded-none object-cover object-left-top" />
              </div>
              <Parallax amount={30}>
                <div className="overflow-hidden rounded-card bg-card shadow-soft-lg">
                  <Shot src="/ui/d-book-summary.webp" alt="Summary with services added" width={800} height={1437} className="shot-flat aspect-[3/4] rounded-none object-cover object-top" />
                </div>
              </Parallax>
            </div>
          </div>
        </Panel>
        <div className="order-1 lg:order-2 lg:col-span-5">
          <AnimatedHeading id="services-heading" className="text-display text-4xl sm:text-5xl lg:text-6xl" text="Turn a booking into a stay." />
          <FadeIn delay={0.15}><p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">Services live inside the room page and again as a step in checkout. Each one is priced by the booking engine, per stay, per guest or per night, and lands in the total the moment it is added.</p></FadeIn>
          <FadeIn delay={0.25}><p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">More value per booking, without breaking the guest experience.</p></FadeIn>
          <FadeIn delay={0.3} className="mt-8 flex flex-wrap gap-2"><Chip tone="sand">Breakfast</Chip><Chip tone="sage">Transfers</Chip><Chip tone="clay">Experiences</Chip><Chip tone="stone">Hotel services</Chip><Chip tone="rose">Extras</Chip></FadeIn>
        </div>
      </div>
    </section>
  )
}
