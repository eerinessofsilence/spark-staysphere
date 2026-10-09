import { FadeIn } from './motion'

const QUOTE = 'Guests book in under two minutes and never see another platform’s name on the way there. That’s the whole pitch, and it’s why we moved everything onto it.'
const NAME = 'Elena Markou'
const ROLE = 'General Manager, Asteria Cove'

/**
 * The one voice on the page that isn't the product's own: a fictional
 * hotelier's word, the same fictional-property framing the footer already
 * states outright. Narrow container, centred — a pause between the case for
 * the product and the price of it.
 */
export function Testimonial() {
  return (
    <section className="container-narrow pt-24 sm:pt-32 lg:pt-40" aria-labelledby="testimonial-heading">
      <h2 id="testimonial-heading" className="sr-only">What a hotelier says about StaySphere</h2>
      <FadeIn>
        <figure className="mx-auto max-w-3xl text-center">
          <blockquote>
            <p className="text-display text-2xl leading-snug sm:text-3xl lg:text-4xl">“{QUOTE}”</p>
          </blockquote>
          <figcaption className="mt-6 text-base text-muted-foreground">
            <span className="font-semibold text-ink">{NAME}</span> · {ROLE}
          </figcaption>
        </figure>
      </FadeIn>
    </section>
  )
}
