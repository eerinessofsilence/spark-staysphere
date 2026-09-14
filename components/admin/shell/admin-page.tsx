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
        'mx-auto w-full px-4 pt-4 pb-16 sm:px-8 lg:pt-10',
        width === 'wide' ? 'max-w-[1400px]' : 'max-w-[900px]',
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
}: {
  title: string;
  label?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
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
