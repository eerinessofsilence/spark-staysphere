import type { ReactNode } from 'react';
import Link from 'next/link';
import { LanguagePicker } from '@/components/site/language-picker';
import { SiteMenu } from '@/components/site/site-menu';
import { cn } from '@/lib/utils';

interface SiteHeaderProps {
  /** Query string carrying the current stay so navigation never loses the dates. */
  stayQuery?: string;
  /**
   * The compact stay search. On a booking site the search is most of the
   * navigation, so it still takes the header's own centre; the two links a
   * returning guest looks for sit beside it. Shown from `lg` up, where there
   * is room for both; narrower screens keep the full bar on the page.
   */
  search?: ReactNode;
  className?: string;
}

const navLinkClass =
  'min-h-11 rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors flex items-center hover:bg-stone/60 hover:text-foreground';

export function SiteHeader({ stayQuery, search, className }: SiteHeaderProps) {
  const suffix = stayQuery ? `?${stayQuery}` : '';

  return (
    <header className={cn('sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4', className)}>
      <div className="glass mx-auto flex h-14 max-w-[1400px] items-center gap-2 rounded-full pr-2 pl-4 shadow-soft sm:h-16 sm:pl-6">
        <Link href={`/${suffix}`} className="flex min-h-11 items-center gap-2 rounded-full">
          {/* Two artworks rather than one recoloured: the mark is white by
              night and ink by day, and swapping them in CSS keeps the right
              one painted from the first frame, before any script runs. */}
          <img
            src="/brand/spark-logo-on-light.svg"
            alt="Spark"
            className="h-6 w-auto sm:h-7 dark:hidden"
          />
          <img
            src="/brand/spark-logo.svg"
            alt=""
            aria-hidden="true"
            className="hidden h-6 w-auto sm:h-7 dark:block"
          />
        </Link>

        {/* From `lg` there is room beside the search for the two links a
            returning guest actually goes looking for; everything else
            (sign in, hotel admin) stays behind the menu, where a first-time
            visitor never needs to see it. Below `lg` all of it lives there
            together, so a phone has exactly one nav to open. */}
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          <Link href={`/rooms${suffix}`} className={navLinkClass}>
            All rooms
          </Link>
          <Link href={`/trips${suffix}`} className={navLinkClass}>
            My trips
          </Link>
        </nav>

        <div className="flex flex-1 justify-center">
          {search ? <div className="hidden lg:block">{search}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <LanguagePicker />
          <SiteMenu stayQuery={stayQuery} />
        </div>
      </div>
    </header>
  );
}
