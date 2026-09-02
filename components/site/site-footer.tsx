import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-24 px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-[1400px] rounded-[28px] bg-ink px-6 py-12 text-[#F7F5F0] sm:px-10 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-display text-3xl sm:text-4xl">
              See the stay. <span className="text-accent-italic text-accent-strong">Book the room.</span>
            </p>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60">
              Spark StaySphere is a white-label direct-booking front end for independent hotels.
              Asteria Cove is a fictional property used to show the guest journey end to end.
            </p>
          </div>

          <nav aria-label="Footer" className="text-sm">
            <p className="mb-4 text-white/50">Explore</p>
            <ul className="space-y-1">
              {[
                { href: '/', label: 'The hotel' },
                { href: '/rooms', label: 'All rooms' },
                { href: '/admin', label: 'Hotel admin demo' },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-11 items-center hover:text-accent-strong">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="text-sm">
            <p className="mb-4 text-white/50">Demo notice</p>
            <p className="leading-relaxed text-white/60">
              Inventory, rates, comparison prices, and payments are simulated in memory and reset
              when the server restarts. No card data is collected and no reservation is made with
              any real property. Photography is licensed stock standing in for the property's own.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
