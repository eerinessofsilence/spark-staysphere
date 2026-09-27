import type { ReactNode } from 'react';
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
