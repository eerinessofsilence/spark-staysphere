import type { ReactNode } from 'react';
import Link from 'next/link';
import { LanguagePicker } from '@/components/site/language-picker';
import { SiteMenu } from '@/components/site/site-menu';
import { cn } from '@/lib/utils';

interface SiteHeaderProps {
  /** Query string carrying the current stay so navigation never loses the dates. */
  stayQuery?: string;
  /**
   * The compact stay search. It takes the place the nav links used to hold —
   * on a booking site the search is the navigation. Shown from `lg` up, where
   * there is room for it; narrower screens keep the full bar on the page.
   */
  search?: ReactNode;
  className?: string;
}

export function SiteHeader({ stayQuery, search, className }: SiteHeaderProps) {
  const suffix = stayQuery ? `?${stayQuery}` : '';

  return (
    <header className={cn('sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4', className)}>
      <div className="glass mx-auto flex h-14 max-w-[1400px] items-center gap-2 rounded-full pr-2 pl-4 shadow-soft sm:h-16 sm:pl-6">
        <Link href={`/${suffix}`} className="flex min-h-11 items-center gap-2 rounded-full">
          <img src="/brand/spark-logo.svg" alt="Spark" className="h-6 w-auto sm:h-7" />
          <span className="hidden text-[17px] text-muted-foreground sm:inline">/ StaySphere</span>
        </Link>

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
