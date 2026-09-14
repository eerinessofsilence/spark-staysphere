import type { ReactNode } from 'react';
import { SectionLabel } from '@/components/site/section-label';
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

export function AdminPageHeader({
  title,
  label,
  description,
  actions,
  compact = false,
}: {
  title: string;
  label?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /**
   * The sidebar nav already names the section a guest is on, so a section
   * landing page doesn't repeat it at display size — the "Compact heading"
   * token (`DESIGN_SYSTEM.md`'s type scale) instead, level with its actions.
   * Detail pages (a booking reference, a room name) keep the full title:
   * that text is the record, not a repeat of the nav.
   */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display text-2xl">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </header>
    );
  }

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {label ? <SectionLabel>{label}</SectionLabel> : null}
        <h1 className={cn('text-display text-5xl sm:text-6xl', label && 'mt-4')}>{title}</h1>
        {description ? <p className="mt-4 text-base text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
