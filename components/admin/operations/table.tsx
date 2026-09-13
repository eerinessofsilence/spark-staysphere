import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TableCard({
  caption,
  className,
  children,
}: {
  caption: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-x-auto rounded-[28px] bg-card shadow-soft contain-inline-size">
      <table className={cn('w-full border-collapse text-sm', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-4 py-3 text-left text-sm font-normal text-muted-foreground', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-top', className)}>{children}</td>;
}
