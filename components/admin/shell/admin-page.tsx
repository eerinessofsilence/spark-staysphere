import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AdminPage({
  width = 'wide',
  children,
}: {
  width?: 'wide' | 'narrow';
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      className={cn(
        width === 'wide' ? 'container-page' : 'container-form',
        'pt-4 pb-16 lg:pt-10',
      )}
    >
      {children}
    </main>
  );
}

/**
 * One size for every admin page's title, section landing or detail alike —
 * the "Compact heading" token (`DESIGN_SYSTEM.md`'s type scale), level with
 * its actions, the way `/admin`'s dashboard has always set it. A room's name
 * or a booking reference used to run at display size on the theory that the
 * text was "the record, not a repeat of the nav" — but next to every other
 * page in the sidebar it just read as a heading that had forgotten which app
 * it was in.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-display text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
