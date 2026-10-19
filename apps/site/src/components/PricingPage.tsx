import { useReveal } from '../lib/useReveal'
import { useSmoothScroll } from '../lib/useSmoothScroll'
import { Footer } from './Footer'
import { MenuProvider } from './MenuProvider'
import { Nav } from './Nav'
import { PricingCalculator } from './PricingCalculator'
import { RequestDemoDialog } from './RequestDemoDialog'

/** /pricing/ is dedicated to the plan configurator. Cards and FAQ stay on the product page. */
export function PricingPage() {
  useSmoothScroll()
  useReveal()
  return (
    <MenuProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <Nav />
      <main id="main">
        <PricingCalculator />
      </main>
      <Footer />
      <RequestDemoDialog />
    </MenuProvider>
  )
}
