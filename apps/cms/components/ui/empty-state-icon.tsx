import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './empty-state-icon.module.css';

export function EmptyStateIcon({ children, motion = 'float', className }: {
  children: ReactNode;
  motion?: 'float' | 'sway' | 'search';
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn(styles.icon, styles[motion], className)}>
      {children}
    </span>
  );
}
