import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SiteHeaderProps {
  /** Query string carrying the current stay so navigation never loses the dates. */
  stayQuery?: string;
  className?: string;
}

const navigation = [
  { href: '/', label: 'The hotel' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/admin', label: 'Admin' },
];

export function SiteHeader({ stayQuery, className }: SiteHeaderProps) {
  const suffix = stayQuery ? `?${stayQuery}` : '';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border/70 bg-canvas/85 backdrop-blur-md',
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link
          href={`/${suffix}`}
          className="flex min-h-11 items-center gap-2.5 rounded-lg pr-2 focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-[10px] bg-ink text-cyan"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="7.5" />
              <path d="M4.5 12h15M12 4.5c2.4 2.2 3.6 4.8 3.6 7.5s-1.2 5.3-3.6 7.5c-2.4-2.2-3.6-4.8-3.6-7.5S9.6 6.7 12 4.5Z" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold tracking-[0.14em] uppercase">Spark</span>
            {/* The second line is the first thing to go when space is tight. */}
            <span className="hidden text-[10px] tracking-[0.18em] text-muted-foreground uppercase sm:block">
              StaySphere 360
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href === '/admin' ? item.href : `${item.href}${suffix}`}
              className={cn(
                'flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground sm:px-3',
                // The logo already goes home; drop the duplicate link on narrow screens.
                item.href === '/' && 'hidden md:flex',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href={`/rooms${suffix}`}
          className="ml-1 flex min-h-11 shrink-0 items-center rounded-xl bg-cyan px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-cyan/85 sm:ml-2 sm:px-4"
        >
          Book<span className="hidden sm:inline">&nbsp;a room</span>
        </Link>
      </div>
    </header>
  );
}
