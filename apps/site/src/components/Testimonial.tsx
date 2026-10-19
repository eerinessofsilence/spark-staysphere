import { FadeIn } from './motion'

const QUOTE = 'Explore the hotel, look inside the room, and continue to the hotel’s booking website when you are ready.'
const NAME = 'Guest + CMS'
const ROLE = 'The StaySphere approach'

/**
 * The one voice on the page that isn't the product's own: a fictional
 * hotelier's word, the same fictional-property framing the footer already
 * states outright. Narrow container, centred — a pause between the case for
 * the product and the price of it.
 */
export function Testimonial() {
  return (
    <section className="container-narrow pt-24 sm:pt-32 lg:pt-40" aria-labelledby="testimonial-heading">
      <h2 id="testimonial-heading" className="sr-only">The Guest + CMS experience</h2>
      <FadeIn>
        <figure className="mx-auto max-w-3xl text-center">
          <div>
            <p className="text-display text-2xl leading-snug sm:text-3xl lg:text-4xl">{QUOTE}</p>
          </div>
          <figcaption className="mt-6 text-base text-muted-foreground">
            <span className="font-semibold text-ink">{NAME}</span> · {ROLE}
          </figcaption>
        </figure>
      </FadeIn>
    </section>
  )
}
