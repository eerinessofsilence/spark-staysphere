import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowsUpDownIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function TableCard({
  caption,
  className,
  attached,
  children,
}: {
  caption: string;
  className: string;
  /** A `Pagination` follows immediately, sharing this card rather than floating below it as its own — see that component's own `attached`. */
  attached?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative overflow-x-auto contain-inline-size',
        attached ? 'bg-card' : 'rounded-[18px] bg-card shadow-soft',
      )}
    >
      <table className={cn('w-full border-collapse text-sm', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-4 py-3 text-left text-sm font-medium text-muted-foreground', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('px-4 py-3 align-middle', className)}>{children}</td>;
}

/**
 * A `Th` that sorts by navigating: `href` already points at this column's
 * next direction (asc → desc → off), computed by the caller — this stays a
 * plain link so the page's own server-rendered order is the one truth,
 * never a client re-sort of what the server already paginated.
 */
export function SortableTh({
  children,
  href,
  direction,
  align = 'left',
}: {
  children?: ReactNode;
  href: string;
  /** This column's own direction when it is the one sorting the table. */
  direction?: 'asc' | 'desc';
  align?: 'left' | 'right';
}) {
  const Icon = direction === 'asc' ? ChevronUpIcon : direction === 'desc' ? ChevronDownIcon : ArrowsUpDownIcon;
  return (
    <th scope="col" className={cn('px-4 py-3 text-sm font-medium', align === 'right' ? 'text-right' : 'text-left')}>
      <Link
        href={href}
        className={cn(
          'inline-flex items-center gap-1 text-muted-foreground hover:text-foreground',
          align === 'right' && 'flex-row-reverse',
          direction && 'text-foreground',
        )}
      >
        {children}
        <Icon className={cn('size-3.5', !direction && 'opacity-50')} aria-hidden="true" />
      </Link>
    </th>
  );
}
