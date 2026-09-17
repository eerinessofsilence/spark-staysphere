import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { iconButton } from '@/lib/ui';
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

/** One step up the trail. No `href` for a sidebar group, which has no page of its own. */
export interface AdminCrumb {
  label: string;
  href?: string;
}

/**
 * The way back: a round arrow button — the same shape every other back
 * control in the product uses — plus the trail behind it, the sidebar group
 * then the list the record lives in. The trail's own links still work; the
 * arrow is for the thumb that just wants out, to wherever it came from,
 * without reading the words first. Both go to the same place: the nearest
 * link in the trail, i.e. the list the record lives in.
 *
 * The record itself is not repeated in the trail — it is the title directly
 * below, and saying it twice reads as a mistake. Trail links are 14px text,
 * so each carries an invisible overlay to reach a finger-sized target
 * without making the row any taller.
 */
function AdminBreadcrumbs({ items }: { items: AdminCrumb[] }) {
  const back = [...items].reverse().find((item) => item.href);
  return (
    <div className="flex items-center gap-3">
      {back ? (
        <Link href={back.href!} aria-label={`Back to ${back.label}`} className={iconButton('light', 'size-8 shrink-0')}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRightIcon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              ) : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="relative font-medium text-foreground transition-colors after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] hover:text-accent-strong"
                >
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
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
  breadcrumbs,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Ancestors only — the page itself is `title`. */
  breadcrumbs?: AdminCrumb[];
}) {
  return (
    <header>
      {breadcrumbs && breadcrumbs.length > 0 ? <AdminBreadcrumbs items={breadcrumbs} /> : null}
      <div
        className={cn(
          'flex flex-wrap justify-between gap-4',
          // Top-aligned when there's a second line underneath the title for
          // actions to line up with; centred against the title alone
          // otherwise, so a button isn't left hanging below a bare h1's
          // shorter box.
          description ? 'items-start' : 'items-center',
          breadcrumbs && 'mt-3',
        )}
      >
        <div className="min-w-0">
          <h1 className="text-display text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
