import { useSmoothScroll } from './lib/useSmoothScroll'
import { useReveal } from './lib/useReveal'
import { MenuProvider } from './components/MenuProvider'
import { Nav } from './components/Nav'
import { RequestDemoDialog } from './components/RequestDemoDialog'
import { Hero } from './components/Hero'
import { ProjectIntro } from './components/ProjectIntro'
import { BookingFlow } from './components/BookingFlow'
import { RoomDetails } from './components/RoomDetails'
import { ServicesSection } from './components/ServicesSection'
import { EndToEnd } from './components/EndToEnd'
import { ProductPrinciples } from './components/ProductPrinciples'
import { Testimonial } from './components/Testimonial'
import { Pricing } from './components/Pricing'
import { FinalCTA } from './components/FinalCTA'
import { Footer } from './components/Footer'

export default function App() {
  useSmoothScroll()
  useReveal()
  return (
    <MenuProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <ProjectIntro />
        <BookingFlow />
        <RoomDetails />
        <ServicesSection />
        <EndToEnd />
        <ProductPrinciples />
        <Testimonial />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
      <RequestDemoDialog />
    </MenuProvider>
  )
}
