import Link from 'next/link';
import { pill } from '@/lib/ui';
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
    <header className={cn('sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4', className)}>
      <div className="glass mx-auto flex h-14 max-w-[1400px] items-center gap-2 rounded-full border border-white/60 pr-2 pl-4 shadow-soft sm:h-16 sm:pl-6">
        <Link href={`/${suffix}`} className="flex min-h-11 items-center gap-2.5 rounded-full">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-ink text-[#F7F5F0]">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M12 2.5c2.6 2.7 4 6 4 9.5s-1.4 6.8-4 9.5c-2.6-2.7-4-6-4-9.5s1.4-6.8 4-9.5Z" />
              <path d="M2.5 12c2.7-2.6 6-4 9.5-4s6.8 1.4 9.5 4c-2.7 2.6-6 4-9.5 4s-6.8-1.4-9.5-4Z" opacity=".55" />
            </svg>
          </span>
          <span className="text-display text-[17px] leading-none">
            Spark<span className="hidden text-muted-foreground sm:inline"> / StaySphere</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-auto flex items-center">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href === '/admin' ? item.href : `${item.href}${suffix}`}
              className={cn(
                'flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-4',
                item.href === '/' && 'hidden md:flex',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href={`/rooms${suffix}`} className={pill('primary', 'h-10 px-4 sm:h-11 sm:px-5')}>
          <span>
            Book<span className="hidden sm:inline"> a room</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
