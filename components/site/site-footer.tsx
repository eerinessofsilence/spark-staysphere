import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-ink text-[#F2F1EC]">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <p className="eyebrow text-cyan">SPARK StaySphere 360</p>
          <p className="text-display mt-3 max-w-md text-3xl">See the stay. Book the room.</p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#A4ABAC]">
            A white-label direct-booking front end for independent hotels. Asteria Cove is a
            fictional demo property used to show the guest journey end to end.
          </p>
        </div>

        <nav aria-label="Footer" className="text-sm">
          <h2 className="eyebrow mb-4 text-[#A4ABAC]">Explore</h2>
          <ul className="space-y-1">
            {[
              { href: '/', label: 'The hotel' },
              { href: '/rooms', label: 'All rooms' },
              { href: '/admin', label: 'Hotel admin demo' },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center text-[#F2F1EC] hover:text-cyan"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm">
          <h2 className="eyebrow mb-4 text-[#A4ABAC]">Demo notice</h2>
          <p className="leading-relaxed text-[#A4ABAC]">
            Inventory, rates, comparison prices, and payments are simulated in memory and reset
            when the server restarts. No card data is collected and no reservation is made with
            any real property.
          </p>
        </div>
      </div>
    </footer>
  );
}
