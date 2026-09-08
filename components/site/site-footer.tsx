import Link from 'next/link';
import { EnvelopeIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/**
 * Service matter, deliberately quiet: the closing band above it already makes
 * the case and carries the screen's one italic phrase, so the footer does not
 * compete with a second photograph and a second call to action. It carries
 * what nothing else does — where the property is, how to reach it, and the
 * navigation the header gave up when the search moved into it.
 *
 * The demo disclosure is a footnote at the bottom rather than a column of body
 * copy: it has to be present and findable, not to take a third of the panel.
 */

const navigation = [
  { href: '/', label: 'The hotel' },
  { href: '/rooms', label: 'All rooms' },
  { href: '/admin', label: 'Hotel admin', keepStay: false },
];

interface SiteFooterProps {
  stayQuery?: string;
  /**
   * Set on a page that floats a bar over the bottom edge on phones — the room
   * detail's book bar. Without it the bar sits on the last line of the
   * footnote, which is exactly the line that says the booking is a demo.
   */
  clearsFloatingBar?: boolean;
}

export function SiteFooter({ stayQuery, clearsFloatingBar }: SiteFooterProps) {
  const suffix = stayQuery ? `?${stayQuery}` : '';

  return (
    <footer className={cn('mt-24 px-3 pb-3 sm:px-6 sm:pb-6', clearsFloatingBar && 'pb-24 lg:pb-6')}>
      <div className="mx-auto max-w-[1400px] rounded-[28px] bg-ink px-6 py-10 text-[#F7F5F0] sm:px-10 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-8">
          <div>
            <p className="text-display text-2xl">
              Spark <span className="text-white/50">/ StaySphere</span>
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">
              A white-label direct-booking front end for independent hotels.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
            <nav aria-label="Footer" className="flex flex-col text-sm">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.keepStay === false ? item.href : `${item.href}${suffix}`}
                  className="flex min-h-11 items-center text-white/70 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <address className="flex flex-col text-sm not-italic">
              <span className="flex min-h-11 items-center gap-2 text-white/70">
                <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                Limassol, Cyprus
              </span>
              <a
                href="mailto:stay@asteriacove.example"
                className="flex min-h-11 items-center gap-2 text-white/70 transition-colors hover:text-white"
              >
                <EnvelopeIcon className="size-4 shrink-0" aria-hidden="true" />
                stay@asteriacove.example
              </a>
            </address>
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-white/45">
            Asteria Cove is a fictional property. Rates, availability, comparison prices, and
            payments are simulated — no card data is collected and no reservation is made anywhere.
            Photographs and 360° captures are licensed stand-ins for the property's own, credited
            in <code className="text-white/60">public/images/CREDITS.md</code>.
          </p>
          <p className="mt-4 text-xs text-white/35">
            © {new Date().getFullYear()} Spark StaySphere — demo build.
          </p>
        </div>
      </div>
    </footer>
  );
}
